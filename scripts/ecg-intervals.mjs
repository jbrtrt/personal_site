// Mirror of the wavelet table in src/ecg/waveform.ts
const SINUS = [
  { t:   0, a:  0.13, w: 26 }, { t: 152, a: -0.06, w:  8 },
  { t: 170, a:  1.05, w:  9 }, { t: 190, a: -0.20, w: 11 },
  { t: 330, a:  0.26, w: 46 },
];
const PVC = [
  { t: 150, a: -0.34, w: 26 }, { t: 196, a:  1.32, w: 34 },
  { t: 250, a: -0.52, w: 30 }, { t: 400, a: -0.42, w: 72 },
];
const sample = (shape, dt) => shape.reduce((v,g) => {
  const d = (dt - g.t)/g.w; return v + (Math.abs(d) < 4 ? g.a*Math.exp(-0.5*d*d) : 0);
}, 0);

function measure(shape, name) {
  const N = 700, s = [];
  for (let t = -40; t < N; t++) s.push([t, sample(shape, t)]);
  const absPeak = Math.max(...s.map(([,v]) => Math.abs(v)));
  const thr = 0.05;                       // 0.05 mV ≈ half a small square
  const on = (from,to) => { for (const [t,v] of s) if (t>=from && t<=to && Math.abs(v)>thr) return t; return null; };
  const off = (from,to) => { let last=null; for (const [t,v] of s) if (t>=from && t<=to && Math.abs(v)>thr) last=t; return last; };

  const pOn = on(-40,120), pOff = off(-40,120);
  const qrsOn = on(120,300), qrsOff = off(120,300);
  const tOff = off(qrsOff ?? 300, 700);
  const rPeak = s.reduce((b,[t,v]) => v > b[1] ? [t,v] : b, [0,-9])[0];

  console.log(`\n── ${name} ──`);
  if (pOn !== null) console.log(`  P wave      ${pOn} → ${pOff} ms   (dur ${pOff-pOn} ms)`);
  else              console.log(`  P wave      absent`);
  console.log(`  QRS         ${qrsOn} → ${qrsOff} ms   (dur ${qrsOff-qrsOn} ms)`);
  if (pOn !== null) console.log(`  PR interval ${qrsOn - pOn} ms  (P onset → QRS onset)`);
  console.log(`  R peak      ${rPeak} ms,  amplitude ${sample(shape,rPeak).toFixed(2)} mV`);
  console.log(`  QT          ${tOff - qrsOn} ms`);
  console.log(`  peak |mV|   ${absPeak.toFixed(2)}`);
  // T concordance: sign of T peak vs sign of dominant QRS deflection
  const tRange = s.filter(([t]) => t > (qrsOff??300) && t < 620);
  const tExt = tRange.reduce((b,[t,v]) => Math.abs(v) > Math.abs(b[1]) ? [t,v] : b, [0,0]);
  const qrsExt = s.filter(([t]) => t>=qrsOn && t<=qrsOff)
                  .reduce((b,[t,v]) => Math.abs(v) > Math.abs(b[1]) ? [t,v] : b, [0,0]);
  console.log(`  T wave      ${tExt[1].toFixed(2)} mV  → ${Math.sign(tExt[1])===Math.sign(qrsExt[1]) ? 'CONCORDANT' : 'DISCORDANT'} with QRS`);
}

measure(SINUS, 'sinus beat');
measure(PVC, 'PVC');

console.log('\nReference (normal adult, lead II):');
console.log('  P duration  <120 ms      PR 120–200 ms');
console.log('  QRS         <120 ms      QT 350–450 ms');
console.log('  PVC QRS     >120 ms, T discordant');
