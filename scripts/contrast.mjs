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

/** Lay `top` over `bottom` at alpha `a`, both opaque hex. */
function blend(bottom, top, a) {
  const b = parse(bottom), t = parse(top);
  const c = [0, 1, 2].map((i) => Math.round(t[i] * a + b[i] * (1 - a)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
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
  ['paper', '--fg-soft',  '--bg', BODY, '.mod__body · .bio__p · .hero__lede · .gap__turn'],
  ['paper', '--fg-faint', '--bg', BODY, '.chrome · .eyebrow · .fig__cap · .mod__caveat · footer'],
  ['paper', '--accent',   '--bg', BODY, '.mod__id · .hero__role · .pub__v · .pubs__toggle'],
  ['paper', '--violet',   '--bg', BODY, '.pub[data-kind=patent] .pub__v'],
  ['paper', '--signal',   '--bg', UI,   ':focus-visible ring · .gap__lock · .egg border · beat dot'],

  // ── circuit board ──────────────────────────────────────────────────────
  ['board', '--fg',       '--bg', BODY, 'body copy, headings'],
  ['board', '--fg-soft',  '--bg', BODY, '.mod__body · .bio__p · .mod__belief'],
  ['board', '--fg-faint', '--bg', BODY, '.chrome · .eyebrow · .fig__cap · .mod__caveat · footer'],
  ['board', '--accent',   '--bg', BODY, '.mod__id · .register__h · .pub__v · .pubs__toggle'],
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

/* ── the background text actually sits on ────────────────────────────────────
   The pairs above check tokens against tokens, which is the thing a fix can
   act on. But `body`'s background colour is not what the reader sees: a
   fixed WebGL canvas sits behind everything, and *that* is the background.
   Auditing only the token is how a section can pass here and still be hard to
   read on screen — which is exactly what happened when the board sections were
   lifted to make the circuit substrate legible.

   So the shader is modelled below at its worst case per section and the text
   is checked against the result. Same arithmetic as render.frag.glsl; if that
   file changes, this has to change with it. */

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map((v) => v * k);
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const to255 = (c) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));

// Constants lifted verbatim from render.frag.glsl.
const PAPER = [0.969, 0.945, 0.910];
const GRID_MIN = [0.769, 0.329, 0.243];
const GRID_MAJ = [0.706, 0.271, 0.196];
const INK_C = [0.090, 0.071, 0.055];
const BOARD_C = [0.039, 0.063, 0.055];
const COPPER_C = [0.784, 0.604, 0.306];
const NA_C = [0.910, 0.690, 0.294];
const K_C = [0.557, 0.435, 0.839];
const NA_HOT_C = [1.000, 0.835, 0.478];
const BLACKOUT = [0.018, 0.024, 0.022];
const PEN = [0.55, 0.16, 0.11];

/**
 * @param uBoard  ground position, 0 paper → 1 board
 * @param uDim    the section's dim
 * @param w       wave presence 0..1 — 1 is a front sitting right under the text
 * @param lit     true → brightest possible pixel, false → darkest
 */
/**
 * @param onCond  true → the pixel is on a live conductor. Charge only exists
 *   on the routing now, so this is the difference between "the background"
 *   and "a lit hairline happens to cross this glyph".
 */
function composite(uBoard, uDim, uWave, lit, onCond) {
  const conductor = onCond ? 1 : 0;
  const current = uWave * conductor;
  const spark = uWave * conductor;
  const residue = uWave * conductor;

  /* Off a conductor the ruling, routing and vias are all absent too — they
     are the same hairlines. What is left covering real area is the ground
     itself plus the hatch and solder-mask tooth, which are put at their
     approximate coverage rather than at 1.0. */
  const minorMask = onCond ? 1 : 0;
  const majorMask = onCond ? 1 : 0;
  const tr = conductor;
  const pad = onCond && lit ? 1 : 0;
  const hatch = onCond ? 1 : 0.3;

  let paper = PAPER;
  paper = mix(paper, GRID_MIN, minorMask * 0.085);
  paper = mix(paper, GRID_MAJ, majorMask * 0.30);
  paper = mix(paper, scale(GRID_MAJ, 0.75), residue * 0.16);
  paper = mix(paper, PEN, current * 0.30);
  paper = mix(paper, INK_C, spark * 0.16);

  let board = BOARD_C;
  board = add(board, scale([0.011, 0.018, 0.015], hatch));
  board = add(board, scale([0.013, 0.021, 0.017], onCond ? 0.7 : 0.2));
  board = mix(board, scale(COPPER_C, 0.26), tr * 0.94);
  board = add(board, scale(COPPER_C, pad * 0.20));
  board = add(board, scale(NA_C, current * 0.95));
  board = add(board, scale(NA_HOT_C, spark * 0.85));
  board = add(board, scale(K_C, residue * 0.22));

  const pa = 1 - smoothstep(0.04, 0.44, uBoard);
  const ba = smoothstep(0.56, 0.96, uBoard);
  const bg = uBoard < 0.5
    ? mix(PAPER, BLACKOUT, smoothstep(0, 1, uBoard * 2))
    : mix(BLACKOUT, BOARD_C, smoothstep(0, 1, (uBoard - 0.5) * 2));

  const bare = (1 - pa) * (1 - ba);
  let col = bg;
  col = mix(col, paper, pa);
  col = mix(col, board, ba);
  col = add(col, scale(NA_C, current * 0.95 * bare));
  col = add(col, scale(NA_HOT_C, spark * 1.05 * bare));
  col = col.map((v) => v + (lit ? 0.011 : -0.011));            // film grain
  // Vignette: 1.0 at centre, ~0.85 at the edge of the text column.
  col = scale(col, lit ? 1 : 0.92);
  col = mix(bg, col, uDim);
  return `#${to255(col).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Section → [uBoard, uDim, uWave, kind]. Must match DIM/WAVE in main.ts. */
const SCENES = [
  ['hero',     0,    0.62, 1.00, 'paper'],
  ['lead',     0,    0.42, 0.16, 'paper'],
  ['gap',      null, 0.55, 0.85, 'sweep'],
  ['builds',   1,    0.78, 0.14, 'board'],
  ['evidence', 1,    0.62, 0.10, 'board'],
  ['ledger',   1,    0.70, 0.12, 'board'],
  ['contact',  0,    0.55, 0.30, 'paper'],
];

/* Text tokens over the field, with the threshold each actually needs.
   1.4.3 allows 3:1 for large text — but only where the type really is large,
   so the exemption is granted per scene rather than waved at the whole page.
   `--fg` in the hero is the 3.2rem+ name and in the gap it is the pull quote;
   everywhere else `--fg` is body copy and gets the full 4.5. */
const OVER_FIELD = [['--fg', BODY], ['--fg-soft', BODY], ['--fg-faint', BODY], ['--accent', BODY]];
const LARGE_FG = new Set(['hero', 'gap']);

/** Must match INK_FLIP in main.ts. */
const INK_FLIP = 0.26;

console.log('\n── text over the live field · worst-case shader background ─────');
console.log('   (a wave front directly under the type, on a rule or a trace)\n');

for (const [scene, groundPos, dim, wave, kind] of SCENES) {
  /* The gap scrubs across the whole inversion while the ink flips once, at
     34%. Both sides of that flip have to hold, so sweep it. */
  const steps = kind === 'sweep'
    ? Array.from({ length: 51 }, (_, i) => i / 50)
    : [groundPos];

  const scrim = scene === 'gap' ? 0.9 : 0;
  for (const [tok, base] of OVER_FIELD) {
    const need = tok === '--fg' && LARGE_FG.has(scene) ? UI : base;
    let worst = Infinity;
    let worstAt = null;
    for (const b of steps) {
      // Which palette the ink is using at this point in the scrub.
      const onBoard = kind === 'sweep' ? b > INK_FLIP : kind === 'board';
      const resolveGround = onBoard ? board : paper;
      const fg = resolveGround(tok);
      for (const lit of [true, false]) {
        // No wave, and a front sitting directly under the type.
        for (const w of [0, wave]) {
          let bgc = composite(b, dim, w, lit, false);
          // .sec--gap lays a scrim of the live ground over the field.
          if (scrim) bgc = blend(bgc, resolveGround('--bg'), scrim);
          const r = ratio(fg, bgc);
          if (r < worst) { worst = r; worstAt = { b, lit, w }; }
        }
      }
    }
    const pass = worst >= need;
    if (!pass) failed++;
    const where = kind === 'sweep' ? ` @ board ${worstAt.b.toFixed(2)}` : '';
    console.log(
      `  ${pass ? '✓' : '✗'} ${scene.padEnd(9)} ${tok.padEnd(11)} ` +
      `${worst.toFixed(2).padStart(6)}:1  need ${need.toFixed(1)}${where}`,
    );
  }
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
