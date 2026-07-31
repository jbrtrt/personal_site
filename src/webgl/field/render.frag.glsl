/* ─────────────────────────────────────────────────────────────
   The two grounds, drawn by one shader.

   ECG chart paper and a printed circuit board share a lattice
   here on purpose: the paper's 5 mm major grid and the board's
   trace pitch are the same lines. So when uBoard moves 0 → 1 the
   grid does not cross-fade into an unrelated texture — the ruling
   you were already reading thickens into copper and starts
   carrying current. Physician register becomes engineer register
   without the geometry ever moving.

   The current in the traces is driven by the excitable medium
   above them. The tissue's depolarization IS the board's current.
   ───────────────────────────────────────────────────────────── */

precision highp float;

uniform sampler2D uField;
uniform vec2  uRes;
uniform float uMM;        // pixels per millimetre of chart paper
uniform float uBoard;     // 0 = paper, 1 = circuit
uniform float uReveal;    // global wake-up fade
uniform float uTime;
uniform float uDim;       // pulled down behind dense type

varying vec2 vUv;

const vec3 PAPER      = vec3(0.969, 0.945, 0.910);
const vec3 GRID_MIN   = vec3(0.769, 0.329, 0.243);
const vec3 GRID_MAJ   = vec3(0.706, 0.271, 0.196);
const vec3 INK        = vec3(0.090, 0.071, 0.055);

const vec3 BOARD      = vec3(0.039, 0.063, 0.055);
const vec3 COPPER     = vec3(0.784, 0.604, 0.306);
const vec3 NA         = vec3(0.910, 0.690, 0.294);   // sodium
const vec3 K          = vec3(0.557, 0.435, 0.839);   // potassium

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* Derivative-aware ruling: stays one pixel wide at any scale. */
float ruling(vec2 p, float weight) {
  vec2 d = abs(fract(p + 0.5) - 0.5) / max(fwidth(p), vec2(1e-5));
  return 1.0 - smoothstep(0.0, weight, min(d.x, d.y));
}

/* Orthogonal routing on the lattice the major grid already drew.
   `pad` comes back as a proper annular ring with a drilled centre — a via
   is a plated hole, and drawing it as a filled dot is the tell that nobody
   has looked at a board. */
float routing(vec2 p, out float pad) {
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;

  float d = 1e9;
  if (hash21(cell) < 0.58)              d = min(d, abs(f.y));
  if (hash21(cell + 31.7) < 0.58)       d = min(d, abs(f.x));
  if (hash21(cell + 11.3) < 0.22)       d = min(d, abs(abs(f.x) - abs(f.y)) * 0.7071);

  float trace = 1.0 - smoothstep(0.030, 0.058, d);

  float r = length(f);
  float ring = (1.0 - smoothstep(0.108, 0.132, r)) - (1.0 - smoothstep(0.044, 0.058, r)) * 0.88;
  pad = hash21(cell + 71.3) > 0.86 ? max(ring, 0.0) : 0.0;

  return max(trace, pad);
}

void main() {
  vec2 px = vUv * uRes;
  vec2 mm = px / uMM;          // chart-paper millimetres
  vec2 maj = mm / 5.0;         // 5 mm majors — and the trace pitch

  vec2 fld = texture2D(uField, vUv).rg;
  float u = fld.r;
  float v = fld.g;

  /* A narrow excited band reads as a drawn front; a wide one reads
     as a blob and swallows the type sitting on top of it. Narrowed
     further once the whole field was quietened — at a quarter of the
     old amplitude a broad band stops reading as a wavefront at all
     and just looks like the page is dirty. */
  float front = smoothstep(0.46, 0.80, u);
  float tail  = smoothstep(0.12, 0.58, v) * (1.0 - front * 0.9);

  /* Leading edge of the wave — where the gradient is steepest.
     This is the part a real electrode actually sees. */
  vec2 t = 1.0 / uRes;
  float gx = texture2D(uField, vUv + vec2(t.x, 0.0)).r - texture2D(uField, vUv - vec2(t.x, 0.0)).r;
  float gy = texture2D(uField, vUv + vec2(0.0, t.y)).r - texture2D(uField, vUv - vec2(0.0, t.y)).r;
  float edge = clamp(length(vec2(gx, gy)) * 5.0, 0.0, 1.0);

  /* ── ground A · chart paper ───────────────────────────────── */
  float minorMask = ruling(mm, 1.0);
  float majorMask = ruling(maj, 1.35);

  /* The substrate carries this page; the wave only annotates it. Both
     grounds are ruled at full strength and the signal on top of them runs
     at roughly a quarter of what it did, because a background that competes
     with the prose has stopped being a background. */
  vec3 paper = PAPER;
  // The minor ruling is deliberately faint: at 1 mm it lands near the
  // pixel grid and a heavier weight beats itself into moiré.
  paper = mix(paper, GRID_MIN, minorMask * 0.085);
  paper = mix(paper, GRID_MAJ, majorMask * 0.30);
  paper = mix(paper, GRID_MAJ * 0.9, tail * 0.05);          // the stain it leaves
  paper = mix(paper, INK, front * 0.13);                    // wet ink
  paper = mix(paper, vec3(0.55, 0.16, 0.11), edge * 0.20);  // the pen itself

  /* ── ground B · circuit board ─────────────────────────────── */
  float pad;
  float tr = routing(maj, pad);

  /* Built up the way a board is: hatched ground plane, solder-mask tooth,
     then etched copper and plated vias. This is the entire circuit register
     of the site — the engineer's half of the thesis lives in the substrate
     and nowhere else, so it has to hold on its own while the tissue is
     quiet. Etched, not energised: none of it glows until the wave arrives. */
  vec3 board = BOARD;
  float hatch = ruling(vec2(mm.x + mm.y, mm.x - mm.y) * 0.25, 0.9);
  board += vec3(0.010, 0.017, 0.014) * hatch;                   // ground-plane hatch
  board += vec3(0.012, 0.020, 0.016) * ruling(mm, 1.0) * 0.7;   // solder-mask tooth
  board = mix(board, COPPER * 0.30, tr * 0.94);                 // etched routing
  board += COPPER * pad * 0.30;                                 // plated via
  board += COPPER * tr * front * 0.16;                          // current, driven by the tissue
  board += NA * front * 0.04;
  board += NA * edge * 0.22;                                     // the front stays a filament
  board += K  * tail  * 0.06;

  /* Do NOT cross-fade the two grounds directly. A linear mix of cream
     paper and near-black board spends the middle of the transition as
     flat grey — the muddiest possible frame, landing exactly on the
     thesis. Route it through a blackout instead: the paper falls away,
     leaving nothing but the bare wavefront on black, and then the
     circuit materialises around the signal that was there all along.
     Same two endpoints, but the midpoint becomes the best beat in the
     sequence rather than the worst. */
  const vec3 BLACKOUT = vec3(0.018, 0.024, 0.022);

  float pa = 1.0 - smoothstep(0.04, 0.44, uBoard);   // paper detail
  float ba = smoothstep(0.56, 0.96, uBoard);         // board detail

  vec3 bg = uBoard < 0.5
    ? mix(PAPER, BLACKOUT, smoothstep(0.0, 1.0, uBoard * 2.0))
    : mix(BLACKOUT, BOARD, smoothstep(0.0, 1.0, (uBoard - 0.5) * 2.0));

  vec3 col = bg;
  col = mix(col, paper, pa);
  col = mix(col, board, ba);

  /* Through the blackout, only the front survives. This one term is
     deliberately *not* quietened with the rest: it is the whole reason the
     transition routes through black, it lasts about one section, and there
     is no prose competing with it at that moment. */
  col += NA * edge * 1.05 * (1.0 - pa) * (1.0 - ba);

  /* film + vignette; kills the flat-vector look */
  float n = hash21(px + fract(uTime) * 91.7);
  col += (n - 0.5) * 0.022;
  float vig = 1.0 - 0.30 * pow(length(vUv - 0.5) * 1.25, 2.2);
  col *= vig;

  col = mix(bg, col, uReveal * uDim);

  gl_FragColor = vec4(col, 1.0);
}
