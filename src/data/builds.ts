/**
 * The build plates — one object per module, modelled rather than charted.
 *
 * These were charts once: Bland–Altman bands, urea kinetics, a forest plot. The
 * charts were honest but they were *arguments*, and the prose beside them was
 * already making those arguments better. What the prose could not do was show
 * the thing. So each module now gets the object itself, drawn in the register of
 * an engraved plate — three-quarter view, lit from the upper left, labelled with
 * leaders, sitting on its own contact shadow.
 *
 * ── On honesty ──────────────────────────────────────────────────────────────
 * An object drawing makes no empirical claim, which is the point: nothing here
 * can overstate a result because nothing here reports one. Every number stayed
 * in the prose, where it is attributable. The leader labels name parts and
 * commitments — never measurements — so no plate asserts anything the page
 * cannot stand behind.
 *
 * Geometry is in model units, roughly "the object is about two units across",
 * and each plate carries the camera that frames it.
 */

import {
  bevelBox, capsuleProfile, cylinderProfile, extrude, lathe, material,
  merge, norm, place, roundedRect, sphere, sweepArc,
  type Mesh, type V3,
} from '../ui/mesh';
import { MAT, type Cam, type Mat } from '../ui/render3d';

/** A leader line: a point on the object, and the plate corner it labels from. */
export interface Note {
  /** Model-space point the leader springs from. */
  at: V3;
  text: string;
  /** Which corner the label sits in. `br` is reserved for the designation. */
  side: 'tl' | 'tr' | 'bl';
}

export interface Plate {
  /** Figure number, in reading order. */
  n: number;
  /** Small caps designation, bottom right of the plate. */
  designation: string;
  mats: Mat[];
  cam: Cam;
  ground: number;
  shadow: number;
  notes: Note[];
  /** Built on first paint and cached — see `mesh()`. */
  build: () => Mesh;
  /** A soft light source inside the object, drawn under the geometry. */
  glow?: { at: V3; r: number };
  /** Great circles inked onto a sphere after the geometry — a ball's seams. */
  seams?: { centre: V3; axis: V3; r: number }[];
}

/* ── shared materials ─────────────────────────────────────────────────────
   Five bodies cover all seven objects. Keeping the set small is what makes
   the plates read as one series rather than seven separate renders. */

const SHELL = MAT(0.90, 0.24, 26);          // moulded housing
const TRIM = MAT(0.54, 0.30, 44);           // dark inset, recessed detail
const SIGNAL = MAT(0.86, 0.34, 40, 1);      // the one accent element
const METAL = MAT(0.96, 0.62, 70);          // machined, polished
const ROUGH = MAT(0.80, 0.08, 6);           // mineral, unpolished
const GLASS = MAT(1.00, 0.55, 90, 0, 0.34); // see-through
const PANEL = MAT(0.60, 0.22, 30);          // the darker half of a ball

const STD: Mat[] = [SHELL, TRIM, SIGNAL, METAL, ROUGH, GLASS, PANEL];
const M = { shell: 0, trim: 1, signal: 2, metal: 3, rough: 4, glass: 5, panel: 6 };

/** The house camera. Objects differ in size, so `f` does the framing. */
const cam = (f: number, over: Partial<Cam> = {}): Cam =>
  ({ yaw: -0.62, pitch: 0.34, dist: 5.4, f, ...over });

/* ── M1 · ViveSense — the reader and its slide ───────────────────────────── */

function reader(): Mesh {
  const body = bevelBox(2.0, 0.54, 1.24, 0.10, M.shell);

  // Optical turret, offset so the plate is not symmetric about its own axis.
  const turret = place(lathe(cylinderProfile(0.27, 0.16), 28, M.metal), { pos: [0.44, 0.3, 0] });
  const lens = place(lathe(cylinderProfile(0.185, 0.03), 28, M.signal), { pos: [0.44, 0.385, 0] });

  // Read-out window, sunk into the top.
  const window_ = place(extrude(roundedRect(0.62, 0.34, 0.06), 0.03, M.trim), { pos: [-0.42, 0.255, 0] });

  /* The slide, half in. A closed reader is a box; the thing that says what it
     is for is the consumable sticking out of it. */
  const slide = place(extrude(roundedRect(1.15, 0.46, 0.05), 0.06, M.shell), { pos: [-1.62, -0.1, 0.2] });
  const port = place(extrude(roundedRect(0.26, 0.2, 0.04), 0.07, M.signal), { pos: [-1.95, -0.1, 0.2] });

  const slot = place(extrude(roundedRect(0.16, 0.56, 0.03), 0.14, M.trim), { pos: [-0.98, -0.1, 0.2] });

  const feet = [-0.7, 0.7].flatMap((x) =>
    [-0.4, 0.4].map((z) =>
      place(lathe(cylinderProfile(0.08, 0.08), 12, M.trim), { pos: [x, -0.3, z] })),
  );

  return merge(body, turret, lens, window_, slot, slide, port, ...feet);
}

/* ── M2 · NEPHRA ONE — the implant ───────────────────────────────────────── */

function implant(): Mesh {
  const shell = place(lathe(capsuleProfile(0.40, 1.1, 10), 32, M.shell), { rot: [0, 0, Math.PI / 2] });

  // The filtration stage, called out as the only accent band on the body.
  const band = place(lathe(cylinderProfile(0.458, 0.34), 32, M.signal), { pos: [0.12, 0, 0], rot: [0, 0, Math.PI / 2] });
  const seam = place(lathe(cylinderProfile(0.447, 0.035), 32, M.trim), { pos: [-0.5, 0, 0], rot: [0, 0, Math.PI / 2] });

  /* Two vascular ports. Angled apart rather than colinear — a straight tube
     through a capsule reads as a battery. */
  const ports = [1, -1].map((s) =>
    place(lathe(cylinderProfile(0.105, 0.62), 20, M.metal), {
      rot: [0, 0, Math.PI / 2 + s * 0.22],
      pos: [s * 1.02, s * 0.1, 0],
    }),
  );
  const cuffs = [1, -1].map((s) =>
    place(lathe(cylinderProfile(0.135, 0.1), 20, M.trim), {
      rot: [0, 0, Math.PI / 2 + s * 0.22],
      pos: [s * 0.85, s * 0.06, 0],
    }),
  );

  return merge(shell, band, seam, ...ports, ...cuffs);
}

/* ── M3 · stoneidx — the specimen ────────────────────────────────────────── */

function specimen(): Mesh {
  /* Deterministic seeds: these stones must be the same stones after a ground
     inversion repaints them. */
  const big = place(sphere(0.54, 2, M.rough, 0.46, 7), { pos: [-0.12, 0.5, 0], rot: [0.3, 0.7, 0.2] });
  const mid = place(sphere(0.34, 2, M.rough, 0.55, 23), { pos: [0.78, 0.31, 0.3], rot: [0.9, 0.2, 1.1] });
  const small = place(sphere(0.23, 2, M.rough, 0.62, 41), { pos: [0.4, 0.21, -0.7], rot: [0.4, 1.8, 0.6] });

  /* A tray. Without it three lumps float; with it they are a specimen, which
     is the whole difference between a rock and a finding. */
  const tray = place(extrude(roundedRect(2.5, 1.7, 0.16), 0.06, M.trim), { pos: [0.1, -0.03, 0] });
  const rule = place(extrude(roundedRect(0.9, 0.05, 0.02), 0.02, M.signal), { pos: [-0.75, 0.03, 0.66] });

  return merge(tray, rule, big, mid, small);
}

/* ── M4 · Ocula — the bedside hub ────────────────────────────────────────── */

function hub(): Mesh {
  /* The dome is generated rather than listed. Each lathe rung is filled with
     one linear gradient, so a coarse profile shows Mach bands where the rungs
     meet; sampling the curve finely is cheaper than hand-listing points and
     removes the banding. */
  const dome: Array<[number, number]> = [[0, -0.34], [0.58, -0.34], [0.65, -0.27]];
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    dome.push([0.65 * Math.cos((t * Math.PI) / 2) ** 0.62, -0.27 + 0.71 * Math.sin((t * Math.PI) / 2)]);
  }
  const body = lathe(dome, 40, M.shell);

  /* The consent ring: the only part that ever leaves the house. It sits under
     the body rather than around it — a ring that intersects the shell
     serrates, because the painter's sort has to pick one of them per face. */
  const ring = place(lathe(cylinderProfile(0.6, 0.045), 40, M.signal), { pos: [0, -0.368, 0] });

  const barrel = place(lathe(cylinderProfile(0.18, 0.12), 28, M.trim), { pos: [0, 0.03, 0.56], rot: [Math.PI / 2, 0, 0] });
  const glass = place(lathe(cylinderProfile(0.145, 0.03), 28, M.glass), { pos: [0, 0.03, 0.63], rot: [Math.PI / 2, 0, 0] });

  return merge(body, ring, barrel, glass);
}

/* ── M5 · FlopCheck — the ball ───────────────────────────────────────────── */

/* ── M5 · FlopCheck — the ball ───────────────────────────────────────────── */

function ball(): Mesh {
  const R = 0.8;

  /* No panel classification. The seams are drawn as curves on the surface
     afterwards (see `seams` below), which is exact at any subdivision — face
     classification produced a zigzag at every subdivision cheap enough to
     draw. */
  const skin = sphere(R, 3, M.shell);

  // The contact, marked where the plate says the impulse arrived.
  const d = norm([0.42, 0.4, 0.82]);
  const mark = place(sphere(0.075, 1, M.signal), { pos: [d[0] * R, d[1] * R, d[2] * R] });

  return merge(place(skin, { pos: [0, R, 0] }), place(mark, { pos: [0, R, 0] }));
}

/* ── M6 · Lantern ────────────────────────────────────────────────────────── */

function lantern(): Mesh {
  const foot = lathe([
    [0, -0.66], [0.44, -0.66], [0.47, -0.6], [0.4, -0.53], [0.24, -0.48], [0.23, -0.42],
  ], 32, M.shell);

  const glass = lathe([
    [0.23, -0.42], [0.4, -0.3], [0.44, 0.0], [0.39, 0.27], [0.25, 0.38],
  ], 32, M.glass);

  const cap = lathe([
    [0.25, 0.38], [0.36, 0.43], [0.31, 0.5], [0.14, 0.58], [0.11, 0.64], [0, 0.66],
  ], 32, M.shell);

  const core = place(material(sphere(0.14, 2), M.signal), { pos: [0, -0.1, 0] });

  /* The handle is the argument: whatever the thing says, a person is one reach
     away from it. */
  const handle = place(
    sweepArc(0.3, 0.028, 0.06 * Math.PI, 0.94 * Math.PI, 26, 8, M.metal),
    { pos: [0, 0.46, 0] },
  );

  return merge(foot, core, glass, cap, handle);
}

/* ── M7 · notes2anki — the stack ─────────────────────────────────────────── */

function cards(): Mesh {
  const stack = [0, 1, 2, 3, 4].map((i) =>
    place(extrude(roundedRect(1.45, 0.98, 0.1), 0.05, i === 4 ? M.shell : M.shell), {
      pos: [0, -0.3 + i * 0.075, 0],
      rot: [0, (i - 2) * 0.055, 0],
    }),
  );

  // The adopted card, edged so it reads as the one that won.
  const edge = place(extrude(roundedRect(1.45, 0.07, 0.03), 0.056, M.signal), {
    pos: [0, 0.005, 0.46],
    rot: [0, 0.11, 0],
  });

  /* One card off the stack. Most rewrites are discarded, and a stack alone
     would only show the ones that survived. */
  const dropped = place(extrude(roundedRect(1.3, 0.88, 0.1), 0.045, M.trim), {
    pos: [1.15, -0.33, 0.78],
    rot: [0, -0.5, 0.1],
  });

  return merge(...stack, edge, dropped);
}

/* ── the seven ───────────────────────────────────────────────────────────── */

export const PLATES: Record<string, Plate> = {
  vivesense: {
    n: 1,
    designation: 'READER · OPTICAL · WITH SLIDE',
    mats: STD,
    cam: cam(360, { yaw: -0.68, pitch: 0.38, oy: 4 }),
    ground: -0.3,
    shadow: 1.7,
    build: reader,
    notes: [
      { at: [0.44, 0.4, 0], text: 'OPTICAL PATH', side: 'tr' },
      { at: [-1.9, -0.12, 0.2], text: 'SAMPLE SLIDE', side: 'bl' },
    ],
  },

  nephra: {
    n: 2,
    designation: 'IMPLANT · CONTINUOUS FILTRATION',
    mats: STD,
    cam: cam(470, { yaw: -0.5, pitch: 0.3 }),
    ground: -0.42,
    shadow: 1.5,
    build: implant,
    notes: [
      { at: [0.12, 0.42, 0], text: 'FILTRATION STAGE', side: 'tr' },
      { at: [-1.2, -0.16, 0], text: 'VASCULAR PORT', side: 'bl' },
    ],
  },

  stoneidx: {
    n: 3,
    designation: 'SPECIMEN · CALCULI · TRAY',
    mats: STD,
    cam: cam(470, { yaw: -0.72, pitch: 0.46 }),
    ground: -0.06,
    shadow: 1.6,
    build: specimen,
    notes: [
      { at: [-0.12, 1.02, 0], text: 'CALCULUS', side: 'tl' },
      { at: [-0.75, 0.06, 0.66], text: 'THE ENCOUNTER, NOT THE PATIENT', side: 'bl' },
    ],
  },

  ocula: {
    n: 4,
    designation: 'HUB · BEDSIDE · CONSENT-GATED',
    mats: STD,
    cam: cam(600, { yaw: -0.44, pitch: 0.26 }),
    ground: -0.385,
    shadow: 1.3,
    build: hub,
    notes: [
      { at: [0, 0.03, 0.68], text: 'CAPTURE, ON DEVICE', side: 'tr' },
      { at: [-0.52, -0.36, 0.3], text: 'SUMMARIES LEAVE, LIFE STAYS', side: 'bl' },
    ],
  },

  flopcheck: {
    n: 5,
    designation: 'BALL · MATCH · CONTACT MARKED',
    mats: STD,
    cam: cam(390, { yaw: -0.55, pitch: 0.26, oy: 10 }),
    ground: 0,
    shadow: 1.15,
    build: ball,
    seams: [
      { centre: [0, 0.8, 0], axis: [0, 1, 0], r: 0.8 },
      { centre: [0, 0.8, 0], axis: [1, 0, 0], r: 0.8 },
      { centre: [0, 0.8, 0], axis: [0, 0, 1], r: 0.8 },
    ],
    notes: [
      { at: [0.5, 1.07, 0.56], text: 'POINT OF CONTACT', side: 'tr' },
      { at: [-0.6, 0.5, 0.36], text: 'DEPTH IS THE CEILING', side: 'bl' },
    ],
  },

  lantern: {
    n: 6,
    designation: 'LANTERN · BEDSIDE · CARRIED',
    mats: STD,
    cam: cam(500, { yaw: -0.5, pitch: 0.22 }),
    ground: -0.66,
    shadow: 1.1,
    glow: { at: [0, -0.1, 0], r: 1.15 },
    build: lantern,
    notes: [
      { at: [-0.28, 0.72, 0], text: 'ONE TOUCH TO A HUMAN', side: 'tl' },
      { at: [0.4, -0.2, 0.12], text: 'REFUSES BY DEFAULT', side: 'bl' },
    ],
  },

  notes2anki: {
    n: 7,
    designation: 'STACK · ADOPTED AND DISCARDED',
    mats: STD,
    cam: cam(500, { yaw: -0.6, pitch: 0.42 }),
    ground: -0.36,
    shadow: 1.7,
    build: cards,
    notes: [
      { at: [-0.7, 0.03, 0.42], text: 'ADOPTED', side: 'tl' },
      { at: [1.3, -0.3, 1.0], text: 'DISCARDED', side: 'bl' },
    ],
  },
};
