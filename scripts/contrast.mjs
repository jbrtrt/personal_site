/**
 * WCAG 2.1 contrast audit.
 *
 * Reads the tokens straight out of src/styles/tokens.css, resolves the var()
 * chains, and checks every foreground/background pair the stylesheets actually
 * use — on both grounds, because the site inverts and a value that passes on
 * chart paper can fail on the board.
 *
 * Thresholds are 1.4.3 / 1.4.11: 4.5:1 for body text, 3:1 for large text and
 * for non-text things that have to be identifiable — focus rings above all.
 * The fix for a failure is to lift the token, never to enlarge the type until
 * the threshold moves.
 *
 *   node scripts/contrast.mjs
 */

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** Declarations from one selector block. */
function block(selector) {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`no ${selector} block in tokens.css`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  const out = {};
  for (const [, k, v] of css.slice(open, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[k] = v.trim();
  }
  return out;
}

const base = block(':root {');
const boardOverrides = block(":root[data-ground='board']");

function resolver(scope) {
  const seen = new Set();
  return function resolve(name) {
    if (seen.has(name)) throw new Error(`circular token: ${name}`);
    const raw = scope[name] ?? base[name];
    if (raw === undefined) throw new Error(`unknown token: ${name}`);
    const m = raw.match(/^var\((--[\w-]+)\)$/);
    if (!m) return raw;
    seen.add(name);
    const v = resolve(m[1]);
    seen.delete(name);
    return v;
  };
}

const paper = resolver(base);
const boardScope = { ...base, ...boardOverrides };
const board = resolver(boardScope);

/* ── colour ──────────────────────────────────────────────────────────────── */

function parse(c) {
  const hex = c.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = c.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const p = rgba[1].split(',').map((s) => parseFloat(s));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`cannot parse colour: ${c}`);
}

const toLinear = (v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance, WCAG 2.1 §definitions. */
function luminance([r, g, b]) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Composite a possibly-translucent foreground over an opaque background. */
function over(fg, bg) {
  const a = fg[3] ?? 1;
  if (a >= 1) return fg.slice(0, 3);
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}

function ratio(fgc, bgc) {
  const bg = parse(bgc);
  const fg = over(parse(fgc), bg);
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* ── the pairs actually in use ───────────────────────────────────────────── */

const BODY = 4.5;
const UI = 3.0;

/** [token, background token, threshold, where it is used] */
const PAIRS = [
  // ── chart paper ────────────────────────────────────────────────────────
  ['paper', '--fg',       '--bg', BODY, 'body copy, headings'],
  ['paper', '--fg-soft',  '--bg', BODY, '.mod__body · .beat p · .hero__lede · .creds'],
  ['paper', '--fg-faint', '--bg', BODY, '.chrome · .eyebrow · .fig__cap · .mod__caveat · footer'],
  ['paper', '--accent',   '--bg', BODY, '.mod__id · .hero__role · .pub__v · .creds__k'],
  ['paper', '--violet',   '--bg', BODY, '.pub[data-kind=patent] .pub__v'],
  ['paper', '--signal',   '--bg', UI,   ':focus-visible ring · .gap__lock · .egg border · beat dot'],

  // ── circuit board ──────────────────────────────────────────────────────
  ['board', '--fg',       '--bg', BODY, 'body copy, headings'],
  ['board', '--fg-soft',  '--bg', BODY, '.mod__body · .beat p · .creds'],
  ['board', '--fg-faint', '--bg', BODY, '.chrome · .eyebrow · .fig__cap · .mod__caveat · footer'],
  ['board', '--accent',   '--bg', BODY, '.mod__id · .register__h · .pub__v · .creds__k'],
  ['board', '--violet',   '--bg', BODY, '.pub[data-kind=patent] .pub__v'],
  ['board', '--signal',   '--bg', UI,   ':focus-visible ring · .gap__lock · .egg border · beat dot'],

  // ── fixed pairs, ground-independent ────────────────────────────────────
  ['fixed', '--ink', '--na', BODY, '::selection'],
];

const GROUND = { paper, board, fixed: paper };
const HEADING = {
  paper: 'ground A · chart paper',
  board: 'ground B · circuit board',
  fixed: 'ground-independent pairs',
};

let failed = 0;
let lastGround = null;

console.log('\nWCAG 2.1 · 4.5:1 body · 3:1 large text and UI\n');

for (const [ground, fgTok, bgTok, need, usage] of PAIRS) {
  const resolve = GROUND[ground];
  const fg = resolve(fgTok);
  const bg = resolve(bgTok);
  const r = ratio(fg, bg);
  const pass = r >= need;
  if (!pass) failed++;

  if (ground !== lastGround) {
    const h = HEADING[ground];
    console.log(`── ${h} ${'─'.repeat(Math.max(3, 56 - h.length))}`);
    lastGround = ground;
  }
  console.log(
    `  ${pass ? '✓' : '✗'} ${fgTok.padEnd(11)} on ${bgTok.padEnd(6)} ` +
    `${fg.padEnd(8)} ${r.toFixed(2).padStart(6)}:1  need ${need.toFixed(1)}  ${usage}`,
  );
}

/* The hairlines are deliberately not gated. A 1 px rule between list rows is a
   separator, not a component whose state has to be identified, and lifting it
   to 3:1 would turn a set of quiet dividers into a table grid. Reported so the
   decision stays visible rather than forgotten. */
console.log('\n── decorative hairlines · reported, not gated ──────────────────');
for (const ground of ['paper', 'board']) {
  const resolve = GROUND[ground];
  console.log(`  · --rule on --bg  ${ratio(resolve('--rule'), resolve('--bg')).toFixed(2)}:1   (${ground})`);
}

console.log(failed ? `\n${failed} pair(s) below threshold.\n` : '\nAll gated pairs pass.\n');
process.exit(failed ? 1 : 0);
