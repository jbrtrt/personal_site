/**
 * Figure specifications for the Build section.
 *
 * The register is deliberately *journal figure*, not circuit: axes, ticks,
 * units, a numbered caption. Nothing here glows and nothing carries current —
 * the electrical argument belongs to the substrate behind the page, and a
 * second one running through the work would flatten both.
 *
 * ── On honesty ──────────────────────────────────────────────────────────────
 * A figure asserts that someone measured something. Where the numbers exist
 * they are used and the caption names them. Where they do not, the figure
 * draws the *criterion*, the *model* or the *decision rule* instead of
 * inventing observations, and is marked `schematic`, which makes the renderer
 * stamp it. On a page whose closing line is about running tests before
 * trusting results, a fabricated scatter plot would be the single most
 * expensive thing on it.
 *
 * `forest.cohorts` is the one figure waiting on real data: paste the 19
 * per-cohort AUCs and it draws them without any other change.
 */

export interface Axis {
  label: string;
  min: number;
  max: number;
  ticks: number[];
  /** Tick formatter — defaults to the raw number. */
  fmt?: (v: number) => string;
}

export type Spec =
  /** Bland–Altman acceptance band: bias and limits of agreement. */
  | { kind: 'agreement'; x: Axis; y: Axis; bias: number; loa: number; band: string }
  /** Two solute-concentration traces over a week. */
  | { kind: 'clearance'; x: Axis; y: Axis; series: { label: string; key: 'intermittent' | 'continuous'; accent?: boolean }[] }
  /** Forest plot. `cohorts` may be empty; the pooled estimate still draws. */
  | { kind: 'forest'; x: Axis; null: number; pooled: { label: string; est: number; lo: number; hi: number }; cohorts: { label: string; est: number; lo: number; hi: number }[] }
  /** One year as a single bar, split by who observes it. */
  | { kind: 'yearbar'; total: number; observed: number; x: Axis; segments: { label: string; hours: number; accent?: boolean }[] }
  /** Pose skeleton, impulse vectors, feasible-response envelope. */
  | { kind: 'envelope'; joints: [number, number][]; bones: [number, number][]; impulse: { at: number; dx: number; dy: number }; envelope: number; observed: number }
  /** Escalation rungs against a stream of utterances. */
  | { kind: 'ladder'; x: Axis; rungs: { label: string; unbuilt?: boolean }[]; path: [number, number][]; gates: number[] }
  /** Two judges, one adoption region. */
  | { kind: 'bakeoff'; x: Axis; y: Axis; threshold: number; n: number };

export interface BuildFigure {
  /** Figure number, in reading order. */
  n: number;
  spec: Spec;
  /** True when the figure draws a criterion or a model rather than results. */
  schematic?: boolean;
}

/* ── NEPHRA ONE · single-pool urea kinetics ───────────────────────────────
   Not drawn by hand and not invented: dC/dt = (G − K·C)/V integrated at ten
   minute steps over one week, with the same weekly clearance delivered two
   ways. Intermittent runs K = 250 mL/min for four hours on three days;
   continuous spreads the identical volume of clearance across all 168 hours,
   which works out at 17.9 mL/min. The sawtooth is what the arithmetic does,
   and the gap between the two curves is the entire argument for the device. */
const G = 6.25;        // urea generation, mg/min
const V = 35_000;      // distribution volume, mL
const WEEK = 7 * 24 * 60;
const STEP = 10;       // min
const K_HD = 250;      // mL/min during a session
const SESSION = 4 * 60;
const SESSION_STARTS = [1, 3, 5].map((d) => d * 24 * 60 + 8 * 60);   // Mon/Wed/Fri, 08:00
const K_CONT = (K_HD * SESSION * SESSION_STARTS.length) / WEEK;      // ≈ 17.9 mL/min

function integrate(clearanceAt: (t: number) => number, c0: number): [number, number][] {
  const out: [number, number][] = [];
  let c = c0;
  for (let t = 0; t <= WEEK; t += STEP) {
    out.push([t / 1440, c * 100]);            // days, and mg/mL → mg/dL
    const k = clearanceAt(t);
    c += ((G - k * c) / V) * STEP;
  }
  return out;
}

const onDialysis = (t: number) => SESSION_STARTS.some((s) => t >= s && t < s + SESSION);

/* Two passes: the first settles the initial condition so the plotted week is
   the periodic steady state rather than a transient nobody would recognise. */
function settle(clearanceAt: (t: number) => number, c0: number) {
  let c = c0;
  for (let pass = 0; pass < 6; pass++) {
    for (let t = 0; t <= WEEK; t += STEP) c += ((G - clearanceAt(t) * c) / V) * STEP;
  }
  return c;
}

export const CURVES: Record<'intermittent' | 'continuous', [number, number][]> = {
  intermittent: integrate((t) => (onDialysis(t) ? K_HD : 0), settle((t) => (onDialysis(t) ? K_HD : 0), 0.4)),
  continuous: integrate(() => K_CONT, settle(() => K_CONT, 0.4)),
};

/* ── the figures ─────────────────────────────────────────────────────────── */

export const FIGURES: Record<string, BuildFigure> = {
  vivesense: {
    n: 1,
    schematic: true,
    spec: {
      kind: 'agreement',
      x: { label: 'mean of both methods', min: 0, max: 120, ticks: [0, 40, 80, 120], fmt: (v) => `${v}M` },
      y: { label: 'device − reference', min: -40, max: 40, ticks: [-40, -20, 0, 20, 40], fmt: (v) => `${v > 0 ? '+' : ''}${v}M` },
      bias: 0,
      loa: 24,
      band: 'acceptance band',
    },
  },

  nephra: {
    n: 2,
    spec: {
      kind: 'clearance',
      x: { label: 'days', min: 0, max: 7, ticks: [0, 1, 2, 3, 4, 5, 6, 7] },
      y: { label: 'serum urea', min: 0, max: 120, ticks: [0, 40, 80, 120], fmt: (v) => `${v}` },
      series: [
        { label: 'three sessions a week', key: 'intermittent' },
        { label: 'continuous', key: 'continuous', accent: true },
      ],
    },
  },

  stoneidx: {
    n: 3,
    spec: {
      kind: 'forest',
      x: { label: 'AUC', min: 0.5, max: 0.85, ticks: [0.5, 0.6, 0.7, 0.8], fmt: (v) => v.toFixed(1) },
      null: 0.5,
      pooled: { label: 'pooled · 19 cohorts', est: 0.713, lo: 0.702, hi: 0.724 },
      /* Paste the 19 per-cohort estimates here and they render as rows above
         the diamond. Until then the figure shows only what was measured. */
      cohorts: [],
    },
  },

  ocula: {
    n: 4,
    spec: {
      kind: 'yearbar',
      total: 8760,
      observed: 2,
      x: { label: 'hours in one year', min: 0, max: 8760, ticks: [0, 2190, 4380, 6570, 8760], fmt: (v) => (v ? `${(v / 1000).toFixed(1)}k` : '0') },
      segments: [
        { label: 'in clinic', hours: 2 },
        { label: 'everywhere else', hours: 8758, accent: true },
      ],
    },
  },

  flopcheck: {
    n: 5,
    schematic: true,
    spec: {
      kind: 'envelope',
      // Normalised figure coordinates, origin bottom-left.
      joints: [
        [0.50, 0.92], [0.50, 0.78], [0.34, 0.70], [0.66, 0.70],
        [0.24, 0.54], [0.76, 0.54], [0.50, 0.52], [0.38, 0.28],
        [0.62, 0.28], [0.36, 0.06], [0.64, 0.06],
      ],
      bones: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [1, 6], [6, 7], [6, 8], [7, 9], [8, 10]],
      impulse: { at: 3, dx: 0.20, dy: -0.05 },
      envelope: 0.22,
      observed: 0.61,
    },
  },

  lantern: {
    n: 6,
    schematic: true,
    spec: {
      kind: 'ladder',
      x: { label: 'utterances', min: 0, max: 24, ticks: [0, 6, 12, 18, 24] },
      rungs: [
        { label: 'answer' },
        { label: 'decline' },
        { label: 'name a human' },
        { label: 'page the team' },
        { label: 'clinical escalation', unbuilt: true },
      ],
      path: [[0, 0], [5, 0], [5, 1], [9, 1], [9, 0], [14, 0], [14, 2], [18, 2], [18, 3], [24, 3]],
      gates: Array.from({ length: 25 }, (_, i) => i),
    },
  },

  notes2anki: {
    n: 7,
    spec: {
      kind: 'bakeoff',
      x: { label: 'judge A win rate', min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => v.toFixed(2) },
      y: { label: 'judge B win rate', min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => v.toFixed(2) },
      threshold: 0.5,
      n: 17,
    },
  },
};
