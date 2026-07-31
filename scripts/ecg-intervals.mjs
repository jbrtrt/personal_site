/**
 * ECG interval audit.
 *
 * Reads the wavelet tables straight out of src/ecg/waveform.ts, so this can
 * never drift from what ships — the previous version kept its own copy of the
 * numbers, which is a lie waiting to happen. Fiducial points are found from
 * the waveform itself rather than from fixed time windows: an earlier version
 * measured QRS with a hard [120, 300] ms window and reported 149 ms when the
 * true answer was "the QRS and T are fused, there is no J point at all".
 *
 * Exits non-zero if any interval leaves its reference range.
 *
 *   node scripts/ecg-intervals.mjs
 */

import { readFileSync } from 'node:fs';

const SRC = new URL('../src/ecg/waveform.ts', import.meta.url);
const src = readFileSync(SRC, 'utf8');

/** Pull `const NAME: Wavelet[] = [ … ];` out of the TypeScript source. */
function table(name) {
  const m = src.match(new RegExp(`const ${name}:\\s*Wavelet\\[\\]\\s*=\\s*\\[([\\s\\S]*?)^\\];`, 'm'));
  if (!m) throw new Error(`could not find the ${name} wavelet table in ${SRC.pathname}`);

  const rows = [...m[1].matchAll(/\{([^}]*)\}/g)].map((r) => {
    const g = {};
    for (const [, k, v] of r[1].matchAll(/(\w+)\s*:\s*(-?[\d.]+)/g)) g[k] = Number(v);
    return g;
  });
  if (!rows.length) throw new Error(`${name} parsed to zero wavelets`);
  return rows;
}

/** Must match Rhythm.sample() exactly — asymmetric past the centre. */
const sample = (shape, dt) =>
  shape.reduce((v, g) => {
    const w = g.w2 !== undefined && dt > g.t ? g.w2 : g.w;
    const d = (dt - g.t) / w;
    return v + (Math.abs(d) < 4 ? g.a * Math.exp(-0.5 * d * d) : 0);
  }, 0);

/** 0.05 mV — half a small square, the smallest deflection anyone reads off paper. */
const THR = 0.05;
const T0 = -200;
const T1 = 900;

function measure(shape) {
  const v = (t) => sample(shape, t);

  /* "Back to baseline" means back to baseline and staying there. A single
     sample under threshold is just the zero crossing between Q and R. */
  const quiet = (t, dir) => {
    for (let k = 0; k < 12; k++) if (Math.abs(v(t + dir * k)) >= THR) return false;
    return true;
  };

  let rPeak = T0;
  let rAmp = 0;
  for (let t = 0; t <= 340; t++) if (Math.abs(v(t)) > rAmp) { rAmp = Math.abs(v(t)); rPeak = t; }

  let qrsOn = rPeak;
  while (qrsOn > T0 && !quiet(qrsOn, -1)) qrsOn--;
  let qrsOff = rPeak;
  while (qrsOff < T1 && !quiet(qrsOff, +1)) qrsOff++;

  let pPeak = null;
  let pAmp = 0;
  for (let t = T0; t < qrsOn; t++) if (Math.abs(v(t)) > pAmp) { pAmp = Math.abs(v(t)); pPeak = t; }
  let pOn = null;
  let pOff = null;
  if (pAmp >= THR) {
    pOn = pPeak; while (pOn > T0 && !quiet(pOn, -1)) pOn--;
    pOff = pPeak; while (pOff < qrsOn && !quiet(pOff, +1)) pOff++;
  }

  let tPeak = qrsOff;
  let tAmp = 0;
  let tSigned = 0;
  for (let t = qrsOff; t <= T1; t++) {
    if (Math.abs(v(t)) > tAmp) { tAmp = Math.abs(v(t)); tPeak = t; tSigned = v(t); }
  }
  let tOn = tPeak; while (tOn > qrsOff && Math.abs(v(tOn)) >= THR) tOn--;
  let tOff = tPeak; while (tOff < T1 && Math.abs(v(tOff)) >= THR) tOff++;

  let qrsExt = 0;
  for (let t = qrsOn; t <= qrsOff; t++) if (Math.abs(v(t)) > Math.abs(qrsExt)) qrsExt = v(t);

  let stDev = 0;
  for (let t = qrsOff; t <= tOn; t++) stDev = Math.max(stDev, Math.abs(v(t)));

  return {
    pDur: pOn !== null ? pOff - pOn : null,
    pr: pOn !== null ? qrsOn - pOn : null,
    qrs: qrsOff - qrsOn,
    qt: tOff - qrsOn,
    r: rAmp,
    tAmp: tSigned,
    concordant: Math.sign(tSigned) === Math.sign(qrsExt),
    st: tOn - qrsOff,
    stDev,
    tDur: tOff - tOn,
  };
}

let failures = 0;
const check = (label, value, ok, expect) => {
  const pass = value !== null && ok(value);
  if (!pass) failures++;
  const shown = value === null ? 'absent' : typeof value === 'number' ? value.toFixed(value % 1 ? 2 : 0) : String(value);
  console.log(`  ${pass ? '✓' : '✗'} ${label.padEnd(22)} ${String(shown).padStart(8)}   ${expect}`);
};

const sinus = measure(table('SINUS'));
console.log('\n── sinus beat ──────────────────────────────────────────────');
check('P duration',      sinus.pDur, (x) => x < 120,             'ms, reference < 120');
check('PR interval',     sinus.pr,   (x) => x >= 120 && x <= 200, 'ms, reference 120–200');
check('QRS duration',    sinus.qrs,  (x) => x < 120,             'ms, reference < 120');
check('QT interval',     sinus.qt,   (x) => x >= 350 && x <= 450, 'ms, reference 350–450');
check('ST isoelectric',  sinus.st,   (x) => x >= 60,             'ms of J-point-to-T baseline');
check('ST deviation',    sinus.stDev, (x) => x < THR,            'mV, must stay under 0.05');
check('R amplitude',     sinus.r,    (x) => x > 0.5 && x < 2.0,  'mV, reference 0.5–2.0');
check('T concordant',    sinus.concordant ? 1 : 0, (x) => x === 1, 'upright T with an upright QRS');

const pvc = measure(table('PVC'));
console.log('\n── premature ventricular contraction ───────────────────────');
check('P wave',          pvc.pDur === null ? 1 : 0, (x) => x === 1, 'must be absent — focus is below the atria');
check('QRS duration',    pvc.qrs,  (x) => x > 120 && x < 220,     'ms, wide and bizarre');
check('QT interval',     pvc.qt,   (x) => x > 350,                'ms, prolonged');
check('R amplitude',     pvc.r,    (x) => x > sinus.r,            `mV, taller than sinus (${sinus.r.toFixed(2)})`);
check('T discordant',    pvc.concordant ? 0 : 1, (x) => x === 1,  'T opposite the dominant QRS deflection');

console.log(
  failures
    ? `\n${failures} interval(s) out of range.\n`
    : '\nAll intervals within reference range.\n',
);
process.exit(failures ? 1 : 0);
