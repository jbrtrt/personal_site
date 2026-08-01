/**
 * The build plates — one object per module, modelled rather than charted.
 *
 * These were charts once: Bland–Altman bands, urea kinetics, a forest plot. The
 * charts were honest but they were *arguments*, and the prose beside them was
 * already making those arguments better. What the prose could not do was show
 * the thing.
 *
 * Each plate now draws its object three times — blocked, clay, rendered — which
 * is what makes the section read as design work rather than as seven product
 * shots. See `ui/figure.ts` for the board; this file is only the geometry.
 *
 * ── On honesty ──────────────────────────────────────────────────────────────
 * An object drawing makes no empirical claim, which is the point: nothing here
 * can overstate a result because nothing here reports one. Every number stayed
 * in the prose and the spec tables, where it is attributable. Leader labels name
 * parts and commitments — never measurements.
 *
 * ── On the renderer's one hard rule ─────────────────────────────────────────
 * Painter's algorithm has no depth buffer, so *solids must not intersect*. An
 * intersecting solid draws wholly in front or wholly behind, and near-concentric
 * surfaces interleave into a torn edge. Everything below abuts instead: bands
 * land on their host radius via `bandProfile()`, and limbs meet torsos at
 * sphere joints of matching radius.
 */

import {
  bevelBox, capsuleProfile, cylinderProfile, extrude, lathe,
  merge, norm, place, roundedRect, sphere, sweepArc,
  type Mesh, type V3,
} from '../ui/mesh';
import { MAT, type Cam, type Mat } from '../ui/render3d';

/** A leader line: a point on the object, and the corner it labels from. */
export interface Note {
  /** Model-space point the leader springs from. */
  at: V3;
  text: string;
  /** Which corner of the hero band the label sits in. */
  side: 'tl' | 'tr' | 'bl';
}

export interface Plate {
  /** Figure number, in reading order. */
  n: number;
  /** Small caps designation, bottom right of the board. */
  designation: string;
  mats: Mat[];
  cam: Cam;
  ground: number;
  shadow: number;
  notes: Note[];
  /** Built on first paint and cached — see `figure.ts`. */
  build: () => Mesh;
  /** A soft light source inside the object, drawn under the geometry. */
  glow?: { at: V3; r: number };
  /** Polylines inked over the finished object — a trace on a screen, an arrow
      on a page. Drawn only on the hero, and only at the rendered stage. */
  strokes?: { points: V3[]; accent?: boolean; width?: number }[];
}

/* ── shared materials ─────────────────────────────────────────────────────
   Seven bodies cover all seven objects. Keeping the set small is what makes
   the plates read as one series rather than seven separate renders. */

const SHELL = MAT(0.90, 0.24, 26);          // moulded housing
const TRIM = MAT(0.54, 0.30, 44);           // dark inset, recessed detail
const SIGNAL = MAT(0.86, 0.34, 40, 1);      // the one accent element
const METAL = MAT(0.96, 0.62, 70);          // machined, polished
const SKIN = MAT(0.84, 0.16, 14);           // matte, soft falloff
const GLASS = MAT(1.00, 0.55, 90, 0, 0.30); // see-through
const WATER = MAT(0.94, 0.34, 60, 0, 0.20); // see-through, and heavier

const STD: Mat[] = [SHELL, TRIM, SIGNAL, METAL, SKIN, GLASS, WATER];
const M = { shell: 0, trim: 1, signal: 2, metal: 3, skin: 4, glass: 5, water: 6 };

/**
 * A raised band around a cylinder, chamfered down to meet it exactly.
 *
 * A plain cylinder used as a band brings its own end caps, and those caps run
 * from the axis outward — so they intersect the body they are supposed to sit
 * on, and the painter's sort has to pick one per face. That shows up as a torn
 * edge. Landing the profile back on the host radius keeps the two surfaces
 * from ever crossing.
 */
const bandProfile = (host: number, r: number, len: number, cham = 0.02): Array<[number, number]> =>
  [[host, -len / 2], [r, -len / 2 + cham], [r, len / 2 - cham], [host, len / 2]];

/** The house camera. Objects differ in size, so `f` does the framing. */
const cam = (f: number, over: Partial<Cam> = {}): Cam =>
  ({ yaw: -0.62, pitch: 0.34, dist: 5.4, f, ...over });

/* ── M1 · ViveSense — the countertop dock and its clip-on optic ──────────── */

function optic(): Mesh {
  // Countertop language: low, soft-cornered, nothing that looks like a bench.
  const dock = bevelBox(1.9, 0.36, 1.12, 0.13, M.shell);

  const readout = place(extrude(roundedRect(0.52, 0.36, 0.06), 0.02, M.trim), { pos: [-0.55, 0.19, 0] });

  // The optical module sits *on* the dock — abutting, never sunk into it.
  const head = place(bevelBox(0.72, 0.44, 0.62, 0.09, M.shell), { pos: [0.38, 0.4, 0] });
  const barrel = place(lathe(cylinderProfile(0.15, 0.15), 24, M.metal), { pos: [0.38, 0.4, 0.385], rot: [Math.PI / 2, 0, 0] });
  const lens = place(lathe(cylinderProfile(0.115, 0.03), 24, M.signal), { pos: [0.38, 0.4, 0.47], rot: [Math.PI / 2, 0, 0] });

  /* The clip is what makes it a clip-on rather than a box: an arch landing on
     the dock's top face at both ends. */
  const clip = place(sweepArc(0.25, 0.032, 0.02 * Math.PI, 0.98 * Math.PI, 22, 8, M.metal), { pos: [-0.02, 0.19, 0] });

  // The consumable, entering the module's left face.
  const slide = place(extrude(roundedRect(0.66, 0.3, 0.05), 0.05, M.shell), { pos: [-0.33, 0.4, 0] });
  const window_ = place(extrude(roundedRect(0.17, 0.16, 0.03), 0.06, M.signal), { pos: [-0.52, 0.4, 0] });

  const feet = [-0.7, 0.7].flatMap((x) =>
    [-0.36, 0.36].map((z) =>
      place(lathe(cylinderProfile(0.07, 0.07), 12, M.trim), { pos: [x, -0.21, z] })),
  );

  return merge(dock, readout, head, barrel, lens, clip, slide, window_, ...feet);
}

/* ── M2 · NEPHRA ONE — the implant, unchanged ────────────────────────────── */

function implant(): Mesh {
  const shell = place(lathe(capsuleProfile(0.40, 1.1, 10), 32, M.shell), { rot: [0, 0, Math.PI / 2] });

  const band = place(lathe(bandProfile(0.4, 0.458, 0.34), 32, M.signal), { pos: [0.12, 0, 0], rot: [0, 0, Math.PI / 2] });
  const seam = place(lathe(bandProfile(0.4, 0.44, 0.05, 0.012), 32, M.trim), { pos: [-0.5, 0, 0], rot: [0, 0, Math.PI / 2] });

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

/* ── M3 · Microplastics — a glass of water, particles suspended ──────────── */

function tumbler(): Mesh {
  /* Slightly flared, thick-based: a drinking glass, not laboratory ware. The
     whole point of this plate is that the sample is ordinary. */
  const glass = lathe([
    [0, -0.52], [0.36, -0.52], [0.38, -0.46], [0.365, -0.3],
    [0.385, 0.0], [0.41, 0.3], [0.43, 0.54],
  ], 40, M.glass);

  // Held clear of the glass wall at every height, so the two never cross.
  const water = lathe([
    [0, -0.44], [0.325, -0.44], [0.34, -0.1], [0.36, 0.22], [0, 0.22],
  ], 40, M.water);

  /* Deterministic scatter: these must be the same particles after a ground
     inversion repaints them, and the same ones at every angle of rotation. */
  let h = 20260731;
  const rand = () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
  const motes = Array.from({ length: 22 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.28;
    return place(sphere(0.012 + rand() * 0.011, 1, M.signal), {
      pos: [Math.cos(a) * r, -0.4 + rand() * 0.58, Math.sin(a) * r],
    });
  });

  return merge(glass, water, ...motes);
}

/* ── M4 · Ocula — the ambulatory recorder ────────────────────────────────── */

function recorder(): Mesh {
  const body = bevelBox(1.05, 0.17, 0.66, 0.05, M.shell);
  const screen = place(extrude(roundedRect(0.76, 0.4, 0.04), 0.02, M.trim), { pos: [0, 0.085, 0.02] });
  const key = place(lathe(cylinderProfile(0.05, 0.03), 16, M.metal), { pos: [0.42, 0.1, -0.2] });

  /* Leads leaving one edge. The arc is authored in XY, so it is rotated into
     the ground plane rather than standing up out of it. */
  const leads = [0.12, -0.14].map((z, i) =>
    place(sweepArc(0.46, 0.02, 0.04 * Math.PI, 0.6 * Math.PI, 18, 7, M.trim), {
      pos: [-0.52, -0.06, z],
      rot: [Math.PI / 2, 0.35 + i * 0.45, 0],
    }),
  );

  return merge(body, screen, key, ...leads);
}

/** Two beats of the trace on the recorder's screen, in model space. */
const TRACE: V3[] = (() => {
  const pts: V3[] = [];
  const y = 0.108;
  for (let i = 0; i <= 84; i++) {
    const t = i / 84;
    const u = (t * 2) % 1;
    let v = 0;
    v += 0.16 * Math.exp(-(((u - 0.16) / 0.05) ** 2));
    v -= 0.10 * Math.exp(-(((u - 0.34) / 0.014) ** 2));
    v += 0.92 * Math.exp(-(((u - 0.40) / 0.017) ** 2));
    v -= 0.24 * Math.exp(-(((u - 0.46) / 0.020) ** 2));
    v += 0.30 * Math.exp(-(((u - 0.68) / 0.060) ** 2));
    pts.push([-0.33 + t * 0.66, y, 0.02 - v * 0.15]);
  }
  return pts;
})();

/* ── M5 · FlopCheck — two figures, and the contact between them ──────────── */

/**
 * A tapered limb between two points, with no end caps.
 *
 * Orientation is derived rather than authored: `lathe` builds along +Y and
 * `place()` applies X then Y then Z, so a point (0, L, 0) lands at
 * (−cos rx · sin rz, cos rx · cos rz, sin rx) · L. Solving that against the
 * wanted direction gives the two angles below.
 *
 * Caps are omitted on purpose — the joints are spheres of matching radius, so
 * the surface reads continuous instead of seamed and nothing intersects.
 */
function limb(from: V3, to: V3, profile: Array<[number, number]>, m: number, seg = 10): Mesh {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(d[0], d[1], d[2]) || 1e-4;
  const u = norm(d);

  const rx = Math.asin(Math.max(-1, Math.min(1, u[2])));
  const rz = Math.atan2(-u[0], u[1]);

  return place(lathe(profile.map(([r, t]): [number, number] => [r, (t - 0.5) * len]), seg, m), {
    rot: [rx, 0, rz],
    pos: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
  });
}

/** A plain taper — arms, legs, neck. */
const bone = (from: V3, to: V3, r0: number, r1: number, m: number, seg = 10): Mesh =>
  limb(from, to, [[r0, 0], [r1, 1]], m, seg);

/* Chest, waist, pelvis. A single taper between two joint spheres was the first
   attempt and it read as a snowman: the spheres were wider than the cone, so
   the torso became two balls with a neck between them. A profile with real
   shoulders and a waist costs four more rungs and removes the need for the
   spheres at all. */
const TORSO: Array<[number, number]> = [
  [0.115, 0], [0.152, 0.08], [0.148, 0.26], [0.118, 0.46],
  [0.132, 0.66], [0.152, 0.84], [0.118, 0.97], [0.075, 1],
];

const joint = (at: V3, r: number, m: number): Mesh => place(sphere(r, 1, m), { pos: at });

interface Pose {
  hip: V3; neck: V3; head: V3;
  shoulder: [V3, V3]; elbow: [V3, V3]; hand: [V3, V3];
  knee: [V3, V3]; foot: [V3, V3];
}

function person(p: Pose, m: number): Mesh {
  const parts: Mesh[] = [
    limb(p.hip, p.neck, TORSO, m, 14),
    bone(p.neck, p.head, 0.052, 0.048, m, 10),
    place(sphere(0.125, 2, m), { pos: p.head }),
  ];

  /* Joints sit just *inside* the limb they cap, so they fill the elbow without
     bulging out of it — a sphere wider than its bone is what makes a figure
     read as a mannequin. */
  for (const i of [0, 1]) {
    parts.push(
      bone(p.shoulder[i], p.elbow[i], 0.056, 0.044, m),
      bone(p.elbow[i], p.hand[i], 0.044, 0.032, m),
      joint(p.shoulder[i], 0.055, m),
      joint(p.elbow[i], 0.043, m),
      joint(p.hand[i], 0.038, m),
    );

    const hipSide: V3 = [p.hip[0] + (i ? 0.075 : -0.075), p.hip[1] - 0.02, p.hip[2]];
    parts.push(
      bone(hipSide, p.knee[i], 0.082, 0.056, m),
      bone(p.knee[i], p.foot[i], 0.056, 0.042, m),
      joint(p.knee[i], 0.056, m),
      joint(p.foot[i], 0.046, m),
    );
  }

  return merge(...parts);
}

function contact(): Mesh {
  // The challenger: upright, weight forward, trailing leg through.
  const a: Pose = {
    hip: [-0.7, 0.92, 0.08], neck: [-0.64, 1.42, 0.04], head: [-0.61, 1.6, 0.03],
    shoulder: [[-0.81, 1.37, 0.05], [-0.47, 1.37, 0.04]],
    elbow: [[-0.98, 1.12, 0.14], [-0.36, 1.14, -0.08]],
    hand: [[-1.02, 0.86, 0.26], [-0.26, 0.9, -0.2]],
    knee: [[-0.88, 0.5, -0.02], [-0.42, 0.58, 0.24]],
    foot: [[-0.94, 0.06, -0.1], [-0.14, 0.44, 0.38]],
  };

  /* The one going down: hips dropping, torso rotating away, arms out. Placed
     clearly forward in depth so the painter's sort never has to choose between
     the two of them. */
  const b: Pose = {
    hip: [0.22, 0.74, 0.52], neck: [0.42, 1.18, 0.46], head: [0.51, 1.34, 0.43],
    shoulder: [[0.28, 1.14, 0.52], [0.58, 1.16, 0.4]],
    elbow: [[0.16, 0.88, 0.68], [0.82, 1.3, 0.36]],
    hand: [[0.02, 0.66, 0.8], [1.02, 1.46, 0.32]],
    knee: [[0.04, 0.34, 0.62], [0.48, 0.4, 0.44]],
    foot: [[-0.14, 0.04, 0.54], [0.7, 0.06, 0.38]],
  };

  // The contact itself, marked where the plate says the impulse arrived.
  const mark = place(sphere(0.075, 1, M.signal), { pos: [-0.2, 0.46, 0.4] });

  return merge(person(a, M.skin), person(b, M.skin), mark);
}

/* ── M6 · Lantern — the bedside unit ─────────────────────────────────────── */

function lanternUnit(): Mesh {
  // Weighted, so it cannot be knocked off a bedside table.
  const base = lathe([
    [0, -0.34], [0.48, -0.34], [0.52, -0.29], [0.48, -0.24],
    [0.22, -0.2], [0.17, -0.08], [0.15, 0.06],
  ], 32, M.shell);

  /* Screen and face are built together and tilted as one, so the face can sit
     proud of the shell without ever crossing it. */
  const panel = merge(
    bevelBox(1.02, 0.66, 0.08, 0.035, M.shell),
    place(bevelBox(0.86, 0.5, 0.02, 0.02, M.trim), { pos: [0, 0.02, 0.05] }),
  );
  const screen = place(panel, { pos: [0, 0.36, 0.02], rot: [-0.2, 0, 0] });

  // One physical key. There is nothing else to press.
  const key = place(lathe(cylinderProfile(0.085, 0.045), 20, M.signal), {
    pos: [0, -0.13, 0.24], rot: [Math.PI / 2 - 0.35, 0, 0],
  });

  const cord = place(sweepArc(0.5, 0.022, 0.06 * Math.PI, 0.66 * Math.PI, 18, 7, M.trim), {
    pos: [-0.38, -0.32, -0.12], rot: [Math.PI / 2, 0.6, 0],
  });

  return merge(base, screen, key, cord);
}

/* ── M7 · ActiveDoc — the page, marked, and the card it made ─────────────── */

function pageAndCard(): Mesh {
  const sheet = extrude(roundedRect(1.5, 1.06, 0.02), 0.014, M.shell);

  /* Ruled text. Formatting is the input this project reads as meaning, so the
     page has to carry structure rather than a grey block: two rows indented,
     the last one short. */
  const lines: Mesh[] = [];
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const indent = i === 3 || i === 4 ? 0.14 : 0;
    const w = (i === rows - 1 ? 0.6 : 1.1) - indent;
    lines.push(place(extrude(roundedRect(w, 0.022, 0.008), 0.006, M.trim), {
      pos: [-0.55 + indent + w / 2, 0.01, -0.4 + i * 0.1],
    }));
  }

  // The highlighted block: two rows lifted out of the page.
  const mark = place(extrude(roundedRect(0.78, 0.14, 0.012), 0.005, M.signal), { pos: [-0.08, 0.008, -0.05] });

  /* The card it produced, lying across the corner — above the sheet, never
     through it. */
  const card = place(extrude(roundedRect(0.7, 0.46, 0.06), 0.026, M.shell), {
    pos: [0.98, 0.05, 0.62], rot: [0, -0.42, 0],
  });
  const edge = place(extrude(roundedRect(0.7, 0.04, 0.02), 0.028, M.signal), {
    pos: [1.06, 0.05, 0.81], rot: [0, -0.42, 0],
  });

  return merge(sheet, ...lines, mark, card, edge);
}

/** The margin arrow — drawn, not modelled. */
const ARROW: V3[] = [
  [-0.68, 0.02, 0.22], [-0.56, 0.02, 0.06], [-0.42, 0.02, -0.03], [-0.3, 0.02, -0.05],
  // back along itself to draw the head, since this is one open polyline
  [-0.37, 0.02, -0.11], [-0.3, 0.02, -0.05], [-0.37, 0.02, 0.02],
];

/* ── the seven ───────────────────────────────────────────────────────────── */

export const PLATES: Record<string, Plate> = {
  vivesense: {
    n: 1,
    designation: 'OPTIC · CLIP-ON · COUNTERTOP DOCK',
    mats: STD,
    cam: cam(1120, { yaw: -0.66, pitch: 0.34 }),
    ground: -0.19,
    shadow: 1.5,
    build: optic,
    notes: [
      { at: [0.38, 0.4, 0.49], text: 'OPTICAL PATH', side: 'tr' },
      { at: [-0.6, 0.4, 0], text: 'SAMPLE SLIDE', side: 'bl' },
    ],
  },

  nephra: {
    n: 2,
    designation: 'IMPLANT · CONTINUOUS FILTRATION',
    mats: STD,
    cam: cam(1120, { yaw: -0.5, pitch: 0.3 }),
    ground: -0.42,
    shadow: 1.5,
    build: implant,
    notes: [
      { at: [0.12, 0.42, 0], text: 'FILTRATION STAGE', side: 'tr' },
      { at: [-1.2, -0.16, 0], text: 'VASCULAR PORT', side: 'bl' },
    ],
  },

  microplastics: {
    n: 3,
    designation: 'SAMPLE · DRINKING WATER · PARTICULATE',
    mats: STD,
    cam: cam(1000, { yaw: -0.5, pitch: 0.16, oy: 8 }),
    ground: -0.52,
    shadow: 0.95,
    build: tumbler,
    notes: [
      { at: [0.1, 0.05, 0.22], text: 'PARTICULATE LOAD', side: 'tr' },
      { at: [-0.3, -0.42, 0.16], text: 'ANY POURED SAMPLE', side: 'bl' },
    ],
  },

  ocula: {
    n: 4,
    designation: 'RECORDER · AMBULATORY · CONTINUOUS',
    mats: STD,
    cam: cam(1180, { yaw: -0.54, pitch: 0.44 }),
    ground: -0.085,
    shadow: 1.3,
    build: recorder,
    strokes: [{ points: TRACE, accent: true, width: 1.6 }],
    notes: [
      { at: [0.12, 0.11, -0.04], text: 'ROLLING TRACE', side: 'tr' },
      { at: [-0.56, -0.05, 0.18], text: 'THE HOURS BETWEEN VISITS', side: 'bl' },
    ],
  },

  flopcheck: {
    n: 5,
    designation: 'CHALLENGE · AND THE RESPONSE TO IT',
    mats: STD,
    cam: cam(560, { yaw: -0.42, pitch: 0.14, oy: 96 }),
    ground: 0,
    shadow: 1.5,
    build: contact,
    notes: [
      { at: [0.08, 0.46, 0.42], text: 'POINT OF CONTACT', side: 'tr' },
      { at: [0.3, 0.66, 0.82], text: 'DEPTH IS THE CEILING', side: 'bl' },
    ],
  },

  lantern: {
    n: 6,
    designation: 'BEDSIDE UNIT · ONE KEY · CORDED',
    mats: STD,
    cam: cam(1000, { yaw: -0.46, pitch: 0.24, oy: 34 }),
    ground: -0.34,
    shadow: 1.15,
    glow: { at: [0, 0.34, 0.1], r: 0.85 },
    build: lanternUnit,
    notes: [
      { at: [0.22, 0.44, 0.12], text: 'REFUSES BY DEFAULT', side: 'tr' },
      { at: [0, -0.13, 0.28], text: 'ONE TOUCH TO A HUMAN', side: 'bl' },
    ],
  },

  activedoc: {
    n: 7,
    designation: 'PAGE · MARKED · AND THE CARD IT MADE',
    mats: STD,
    cam: cam(1120, { yaw: -0.5, pitch: 0.62 }),
    ground: -0.008,
    shadow: 1.4,
    build: pageAndCard,
    strokes: [{ points: ARROW, accent: true, width: 1.5 }],
    notes: [
      { at: [-0.08, 0.014, -0.05], text: 'FORMATTING IS THE MEANING', side: 'tl' },
      { at: [0.98, 0.08, 0.62], text: 'ONE CARD, GRADED', side: 'bl' },
    ],
  },
};
