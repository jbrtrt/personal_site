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
  bevelBox, capsuleProfile, cylinderProfile, extrude, group, lathe,
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
  strokes?: Stroke[];
  /**
   * The clay stage only: what the object *does*, rather than what it is.
   *
   * The middle plate is the process study. It carries geometry the other two
   * never show — a hand at the key, a sample being poured, the skeleton a pose
   * model would extract — because an object drawn three times says the same
   * thing three times however it is shaded. The line study is the outline and
   * the hero is the finished thing; this is the one that explains.
   *
   * `build` is merged onto the plate's own mesh, so the framing solves for both
   * together and the process element cannot drift off the object it belongs to.
   */
  clay?: { build?: () => Mesh; strokes?: Stroke[] };
}

interface Stroke { points: V3[]; accent?: boolean; width?: number }

/* ── shared materials ─────────────────────────────────────────────────────
   Seven bodies cover all seven objects. Keeping the set small is what makes
   the plates read as one series rather than seven separate renders. */

const SHELL = MAT(0.90, 0.24, 26);          // moulded housing
const TRIM = MAT(0.54, 0.30, 44);           // dark inset, recessed detail
const SIGNAL = MAT(0.86, 0.34, 40, 1);      // the one accent element
const METAL = MAT(0.96, 0.62, 70);          // machined, polished
/* Raised from 0.84. It is the lowest albedo of the bodies and it clothes the
   thinnest forms on the page — two figures made of tapered limbs — so it lost
   twice: against the dark field, and against its own clay study, which is not
   allowed to be darker than a render that is already the dimmest of the seven. */
const SKIN = MAT(0.94, 0.16, 14);           // matte, soft falloff
const GLASS = MAT(1.00, 0.55, 90, 0, 0.30); // see-through
const WATER = MAT(0.94, 0.34, 60, 0, 0.20); // see-through, and heavier

const STD: Mat[] = [SHELL, TRIM, SIGNAL, METAL, SKIN, GLASS, WATER];
const M = { shell: 0, trim: 1, signal: 2, metal: 3, skin: 4, glass: 5, water: 6 };

/* ── shared sub-assemblies ────────────────────────────────────────────────────
 *
 * Five slots, and every object is divided into the same five. The clay stage
 * shades by these rather than by material (see `PART_TONES` in `render3d.ts`),
 * which is the whole of its assembly reading — no extra lines on the drawing.
 *
 * Five and not seven because seven boards have to read as one set: a slot that
 * only two objects use tells you nothing about either. Not every object fills
 * every slot, and an object that has no `frame` simply skips it rather than
 * inventing one. */
const P = {
  /** The housing, the chassis, the largest thing. */
  body: 0,
  /** What carries the working parts. */
  frame: 1,
  /** What actually does the job. */
  works: 2,
  /** What a person touches or reads. */
  face: 3,
  /** What passes through — the sample, the card, the person. */
  subject: 4,
};

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

/**
 * A dock with a slide bay, and an optic on a stem looking down into it.
 *
 * The first version laid the optical module on its side at one end of a wide
 * flat dock, and it read as a sled with a cannon on it: the barrel pointed
 * along the counter at nothing, the consumable floated unattached, and the
 * whole thing was too low and too long to be an appliance. What fixes it is
 * putting the optical path where the object's own logic puts it — vertical,
 * above the bay, with daylight between the lens and the slide. A reader is
 * legible the moment you can see what it is looking at.
 */
function optic(): Mesh {
  // Countertop language: low, soft-cornered, nothing that looks like a bench.
  const dock = place(bevelBox(1.3, 0.3, 0.82, 0.06, M.shell), { pos: [0, 0.15, 0] });
  const feet = [-0.5, 0.5].flatMap((x) =>
    [-0.29, 0.29].map((z) =>
      place(lathe(cylinderProfile(0.06, 0.05), 12, M.trim), { pos: [x, -0.025, z] })),
  );

  // The bay the consumable lands in, and the small readout beside it.
  const bay = place(extrude(roundedRect(0.86, 0.26, 0.05), 0.02, M.trim), { pos: [0, 0.31, 0.2] });
  const readout = place(extrude(roundedRect(0.3, 0.2, 0.04), 0.02, M.trim), { pos: [-0.45, 0.31, -0.06] });

  /* The consumable, seated in the bay and overhanging the front edge — it has
     to be the part a hand can obviously take hold of. */
  const slide = place(extrude(roundedRect(0.28, 0.72, 0.04), 0.045, M.shell), { pos: [0, 0.3425, 0.3] });
  const window_ = place(extrude(roundedRect(0.13, 0.13, 0.03), 0.018, M.signal), { pos: [0, 0.374, 0.5] });

  // The stem, its clamp collar, and the arm the optic hangs from.
  const stem = place(lathe(cylinderProfile(0.075, 0.58), 16, M.shell), { pos: [0, 0.59, -0.26] });
  const collar = place(lathe(bandProfile(0.075, 0.108, 0.11), 20, M.metal), { pos: [0, 0.72, -0.26] });
  const arm = place(bevelBox(0.2, 0.14, 0.62, 0.045, M.shell), { pos: [0, 0.95, -0.02] });

  /* The optic is a separate body on a metal joint — that is the whole of
     'clip-on'. It comes off; the dock stays on the counter. */
  const joint = place(bevelBox(0.3, 0.025, 0.28, 0.008, M.metal), { pos: [0, 0.8675, 0.2] });
  const head = place(bevelBox(0.44, 0.235, 0.4, 0.05, M.shell), { pos: [0, 0.7375, 0.2] });
  const barrel = place(lathe(cylinderProfile(0.12, 0.14), 20, M.metal), { pos: [0, 0.55, 0.2] });
  const lens = place(lathe(cylinderProfile(0.095, 0.03), 20, M.signal), { pos: [0, 0.465, 0.2] });

  /* Five pieces, and the split is the object's argument: a dock that stays on
     the counter, a stem that positions, an optic that comes off it, a bay and a
     readout the user deals with, and a consumable that passes through. */
  return merge(
    group(merge(dock, ...feet), P.body),
    group(merge(stem, collar, arm), P.frame),
    group(merge(joint, head, barrel, lens), P.works),
    group(merge(bay, readout), P.face),
    group(merge(slide, window_), P.subject),
  );
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

  /* Three pieces. The implant has no frame — the shell *is* the frame — and
     nothing passes through it that a drawing can show, so those two slots stay
     empty rather than being filled for symmetry. The ports take `face` because
     they are the only part anyone handles. */
  return merge(
    group(merge(shell, seam), P.body),
    group(band, P.works),
    group(merge(...ports, ...cuffs), P.face),
  );
}

/* ── M3 · Microplastics — the reader, and the cell in its path ───────────── */

/**
 * A sample cell standing between a source and a detector.
 *
 * This was a drinking glass with particles in it, on the argument that the
 * sample is the ordinary part. The argument was sound and the drawing was not:
 * a tumbler of water reads as a drink, the module's own spec table says the
 * form is a reader and a sample cell, and the plate showed neither. A square
 * cell is the one shape that cannot be mistaken for glassware, and putting it
 * in an optical path says what the hardware is without claiming a result for it.
 */
function sampleCell(): Mesh {
  const base = place(bevelBox(1.4, 0.24, 0.62, 0.05, M.shell), { pos: [0, 0.12, 0] });
  const feet = [-0.55, 0.55].flatMap((x) =>
    [-0.2, 0.2].map((z) =>
      place(lathe(cylinderProfile(0.055, 0.045), 12, M.trim), { pos: [x, -0.0225, z] })),
  );

  /* Two pillars carry the optics; the cell drops into the well between them.
     Slimmer than the span they bridge — heavier and they read as bookends with
     something standing between them rather than as an instrument. */
  const walls = [-0.55, 0.55].map((x) =>
    place(bevelBox(0.16, 0.5, 0.32, 0.04, M.shell), { pos: [x, 0.49, 0] }));
  const well = place(extrude(roundedRect(0.52, 0.52, 0.05), 0.06, M.trim), { pos: [0, 0.27, 0] });

  /* Reversed outlines. `extrude` winds inward by default — see the note on it —
     which means the backface test drops the wall *nearest* the camera and keeps
     the far one. For everything else on these plates that is invisible and
     useful, but this is the one solid with something inside it, and a missing
     near wall stops hiding the particles: they show through an opaque cell at
     the clay stage. Reversing the outline flips every polygon the extrude emits,
     so this cell alone gets true outward normals. */
  const cell = place(extrude([...roundedRect(0.4, 0.4, 0.05, 2)].reverse(), 0.74, M.glass), { pos: [0, 0.67, 0] });
  // Held clear of the cell wall on every side, so the two surfaces never cross.
  const water = place(extrude([...roundedRect(0.32, 0.32, 0.04, 2)].reverse(), 0.56, M.water), { pos: [0, 0.62, 0] });

  /* Deterministic scatter: these must be the same particles after a ground
     inversion repaints them, and the same ones at every angle of rotation.

     A tight plume in the path rather than a scatter through the whole volume.
     Two reasons, and they agree: particles in the beam are the composition, and
     a wide cloud leaks through the painter's sort. The cell wall is one quad and
     sorts on its own centroid, which sits 0.2 from the axis along ±x and ±z —
     but the nearest point of a square cell is a *corner*, so a mote out near
     that corner beats the flat wall's centroid and draws in front of it. Pitch
     compounds it by mixing height into depth. Held inside 0.06 and level with
     the wall's mid-height, every mote sorts behind the wall that encloses it,
     which is what the clay stage needs — there the cell is opaque. */
  let h = 20260731;
  const rand = () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
  const motes = Array.from({ length: 18 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.06;
    return place(sphere(0.011 + rand() * 0.009, 1, M.signal), {
      pos: [Math.cos(a) * r, 0.5 + rand() * 0.2, Math.sin(a) * r],
    });
  });

  /* Source on one side, detector on the other. The lit face is the source; the
     detector reads dark, which is the only thing distinguishing them. */
  const optics = [-1, 1].flatMap((s) => [
    place(lathe(cylinderProfile(0.09, 0.2), 20, M.metal), { pos: [s * 0.37, 0.63, 0], rot: [0, 0, Math.PI / 2] }),
    place(lathe(cylinderProfile(0.07, 0.03), 20, s < 0 ? M.signal : M.trim), {
      pos: [s * 0.255, 0.63, 0], rot: [0, 0, Math.PI / 2],
    }),
  ]);

  /* The cell, its water and the particulate are one sub-assembly — the sample.
     It is the thing that arrives, gets read and leaves, and the instrument is
     everything else. */
  return merge(
    group(merge(base, ...feet), P.body),
    group(merge(...walls, well), P.frame),
    group(merge(...optics), P.works),
    group(merge(cell, water, ...motes), P.subject),
  );
}

/** The path itself — drawn, because a beam is not a solid. */
const BEAM: V3[] = [[-0.235, 0.63, 0], [0.235, 0.63, 0]];

/* ── M4 · Ocula — the ambulatory recorder ────────────────────────────────── */

function recorder(): Mesh {
  const body = bevelBox(1.05, 0.17, 0.66, 0.05, M.shell);
  // Body's top face is 0.085; the screen lands on it rather than sinking into it.
  const screen = place(extrude(roundedRect(0.76, 0.4, 0.04), 0.02, M.trim), { pos: [0, 0.095, 0.02] });
  const key = place(lathe(cylinderProfile(0.05, 0.03), 16, M.metal), { pos: [0.42, 0.1, -0.2] });

  /* Leads leaving one edge. The arc is authored in XY, so it is rotated into
     the ground plane rather than standing up out of it. */
  const leads = [0.12, -0.14].map((z, i) =>
    place(sweepArc(0.46, 0.02, 0.04 * Math.PI, 0.6 * Math.PI, 18, 7, M.trim), {
      pos: [-0.52, -0.06, z],
      rot: [Math.PI / 2, 0.35 + i * 0.45, 0],
    }),
  );

  /* The leads are the works: everything the recorder actually does happens at
     the far end of them. */
  return merge(
    group(body, P.body),
    group(merge(...leads), P.works),
    group(merge(screen, key), P.face),
  );
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

/* Hoisted out of `contact()` so the clay stage can draw the skeleton these
   describe. The pose *is* the method's input — the clay study inks it. */

// The challenger: upright, weight forward, trailing leg through.
const POSE_A: Pose = {
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
const POSE_B: Pose = {
  hip: [0.22, 0.74, 0.52], neck: [0.42, 1.18, 0.46], head: [0.51, 1.34, 0.43],
  shoulder: [[0.28, 1.14, 0.52], [0.58, 1.16, 0.4]],
  elbow: [[0.16, 0.88, 0.68], [0.82, 1.3, 0.36]],
  hand: [[0.02, 0.66, 0.8], [1.02, 1.46, 0.32]],
  knee: [[0.04, 0.34, 0.62], [0.48, 0.4, 0.44]],
  foot: [[-0.14, 0.04, 0.54], [0.7, 0.06, 0.38]],
};

/** Where the plate says the impulse arrived. */
const CONTACT_AT: V3 = [-0.2, 0.46, 0.4];

function contact(): Mesh {
  const mark = place(sphere(0.075, 1, M.signal), { pos: CONTACT_AT });

  /* Both figures are one material, so until now the clay stage drew them as a
     single grey tangle. The sub-assembly split is the only thing that separates
     them: the challenger is the body of the drawing, the one going down is what
     the method is actually watching, and the contact is what passes between. */
  return merge(
    group(person(POSE_A, M.skin), P.body),
    group(person(POSE_B, M.skin), P.works),
    group(mark, P.subject),
  );
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

  /* The key is the `subject` slot rather than part of the face: it is the whole
     of what passes between a person and this object, and giving it the brightest
     tone is the drawing agreeing with the module's own claim. */
  return merge(
    group(base, P.body),
    group(cord, P.frame),
    group(screen, P.face),
    group(key, P.subject),
  );
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

  /* The ruled lines are the `frame` — on a page, the structure that carries the
     meaning is the formatting, which is this project's whole premise. */
  return merge(
    group(sheet, P.body),
    group(merge(...lines), P.frame),
    group(mark, P.works),
    group(merge(card, edge), P.subject),
  );
}

/** The margin arrow — drawn, not modelled. */
const ARROW: V3[] = [
  [-0.68, 0.02, 0.22], [-0.56, 0.02, 0.06], [-0.42, 0.02, -0.03], [-0.3, 0.02, -0.05],
  // back along itself to draw the head, since this is one open polyline
  [-0.37, 0.02, -0.11], [-0.3, 0.02, -0.05], [-0.37, 0.02, 0.02],
];

/* ── the seven ───────────────────────────────────────────────────────────── */

/* ── the process studies ─────────────────────────────────────────────────────
 *
 * The clay plate answers "what does it do", where the line plate answers "what
 * shape is it" and the hero answers "what is it". Two things carry that, and
 * neither of them is an added form:
 *
 *   **Assembly**, on every plate — the mesh's own `part` tags, shaded as a ramp
 *   by the clay stage. It says how many pieces the object is and where they
 *   divide, and it costs no ink at all. See `P` above and `PART_TONES` in
 *   `render3d.ts`.
 *
 *   **Construction or dimension**, one per plate, chosen by what the object's
 *   design problem actually was. Construction where the form follows from a
 *   geometric decision: an optical axis, a solid of revolution, a page's grid,
 *   the skeleton a pose model extracts. Dimension where the problem is *fit* —
 *   something that has to go inside a body, be worn, or sit on a bedside table.
 *
 * What was tried and rejected, so that it is not tried again: arrows and added
 * blocky forms, which show clutter rather than process; ghosted motion,
 * two-state and section-cut, because process does not imply motion; and a
 * stock-envelope study, which at 198×100 compresses its depth edges into the
 * front face and reads as a picture frame.
 *
 * Everything here is authored to read in the **picture plane** — X across, Y up.
 * The clay view is a front elevation (`yaw: 0`), so anything laid out along Z
 * foreshortens to nothing. `plan()` is the exception, for the one object that
 * lies flat and is therefore looked down on.
 *
 * Dimensions are drawn **unnumbered**, on the hardware plates as much as the
 * software ones. These are concept forms and nobody has committed to a
 * millimetre; a figure here would be the only invented precision on the page.
 */

/** One construction line. */
const rule = (from: V3, to: V3, width = 0.9): Stroke => ({ points: [from, to], width });

/** A closed profile in the picture plane — the rectangle a solid was made from. */
const rect = (x0: number, x1: number, y0: number, y1: number, z = 0, width = 0.9): Stroke => ({
  points: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]],
  width,
});

/** The same, in the *page* plane (XZ) — for the one object that lies flat. */
const plan = (x0: number, x1: number, z0: number, z1: number, y: number, width = 0.9): Stroke => ({
  points: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]],
  width,
});

/**
 * Extension lines, a dimension line between them, and terminators.
 *
 * `a`..`b` is the span, measured along `axis`. `at` is where the dimension line
 * stands off on the other axis, and `ext` is where the extension lines leave the
 * object — the two together decide how far clear of the form the whole
 * construction sits.
 *
 * Terminators are 45° ticks rather than arrowheads, and that is not a stylistic
 * choice: an arrowhead in proportion to these lines fills in to a blob at
 * 198×100, and one big enough to hold its shape is an arrow, which is the thing
 * this treatment exists to do without.
 */
function dim(axis: 'x' | 'y', a: number, b: number, at: number, ext: number, z = 0): Stroke[] {
  // Extension lines overshoot the dimension line slightly, as drawn ones do.
  const over = Math.sign(at - ext) * 0.06;
  const t = 0.055;

  /** `u` runs along the measured axis, `w` across it. */
  const pt = (u: number, w: number): V3 => (axis === 'x' ? [u, w, z] : [w, u, z]);

  return [
    { points: [pt(a, ext), pt(a, at + over)], width: 0.8 },
    { points: [pt(b, ext), pt(b, at + over)], width: 0.8 },
    { points: [pt(a, at), pt(b, at)], width: 1.1 },
    { points: [pt(a - t, at - t), pt(a + t, at + t)], width: 1.1 },
    { points: [pt(b - t, at - t), pt(b + t, at + t)], width: 1.1 },
  ];
}

/** M5 · the skeleton a pose model pulls out of the frame. */
function skeleton(p: Pose): V3[][] {
  const hipSide = (i: number): V3 => [p.hip[0] + (i ? 0.075 : -0.075), p.hip[1] - 0.02, p.hip[2]];
  return [
    [p.hip, p.neck, p.head],
    [p.shoulder[0], p.shoulder[1]],
    [p.shoulder[0], p.elbow[0], p.hand[0]],
    [p.shoulder[1], p.elbow[1], p.hand[1]],
    [hipSide(0), p.knee[0], p.foot[0]],
    [hipSide(1), p.knee[1], p.foot[1]],
  ];
}

export const PLATES: Record<string, Plate> = {
  vivesense: {
    n: 1,
    designation: 'OPTIC · CLIP-ON · COUNTERTOP DOCK',
    mats: STD,
    cam: cam(1120, { yaw: -0.66, pitch: 0.32 }),
    ground: -0.05,
    shadow: 1.5,
    build: optic,
    /* Construction. The vertical optical axis over the bay *is* this object's
       argument — the first version laid the module on its side and it read as a
       sled with a cannon on it. Stem, arm, head, barrel, lens and slide are all
       coaxial in X, so one line states the whole of it. The two short rules are
       the lens face and the slide surface: the daylight between them is what
       makes a reader legible as a reader. */
    clay: {
      strokes: [
        rule([0, -0.09, 0.2], [0, 1.09, 0.2]),
        rule([-0.72, 0.30, 0.2], [0.72, 0.30, 0.2]),
        rect(-0.22, 0.22, 0.62, 0.855, 0.2, 1.1),
        rule([-0.3, 0.45, 0.2], [0.3, 0.45, 0.2]),
        rule([-0.3, 0.365, 0.2], [0.3, 0.365, 0.2]),
      ],
    },
    notes: [
      { at: [0, 0.46, 0.2], text: 'OPTICAL PATH', side: 'tr' },
      { at: [0, 0.37, 0.58], text: 'SAMPLE SLIDE', side: 'bl' },
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
    /* Dimension. An implant's whole design problem is fitting inside a person,
       so the two spans that were actually constrained are the overall length
       port-to-port and the diameter of the body. Both unnumbered: this is a
       concept form and a millimetre here would be invented. */
    clay: {
      strokes: [
        ...dim('x', -1.40, 1.40, -0.62, -0.10),
        ...dim('y', -0.40, 0.40, 1.58, 1.02),
      ],
    },
    notes: [
      { at: [0.12, 0.42, 0], text: 'FILTRATION STAGE', side: 'tr' },
      { at: [-1.2, -0.16, 0], text: 'VASCULAR PORT', side: 'bl' },
    ],
  },

  microplastics: {
    n: 3,
    designation: 'READER · SAMPLE CELL · SUSPENDED PARTICULATE',
    mats: STD,
    cam: cam(1000, { yaw: -0.5, pitch: 0.2 }),
    ground: -0.045,
    shadow: 1.5,
    glow: { at: [0, 0.63, 0], r: 0.55 },
    build: sampleCell,
    strokes: [{ points: BEAM, accent: true, width: 2.2 }],
    /* Construction. The cell really was extruded from that rectangle and the
       barrels really were revolved about that axis, so the drawing is stating
       its own derivation rather than decorating itself. The two short rules on
       the right are the detector barrel's revolve extent. */
    clay: {
      strokes: [
        rule([0, 0.1, 0], [0, 1.22, 0]),
        rule([-0.95, 0.63, 0], [0.95, 0.63, 0]),
        rule([-0.85, 0.12, 0], [0.85, 0.12, 0]),
        rect(-0.2, 0.2, 0.3, 1.04, 0, 1.2),
        rect(-0.16, 0.16, 0.34, 0.9),
        rule([0.27, 0.72, 0], [0.47, 0.72, 0]),
        rule([0.27, 0.54, 0], [0.47, 0.54, 0]),
      ],
    },
    notes: [
      { at: [0.04, 0.7, 0.04], text: 'PARTICULATE LOAD', side: 'tr' },
      { at: [-0.3, 0.63, 0], text: 'SOURCE AND DETECTOR', side: 'bl' },
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
    /* Dimension. It is worn, so footprint and thickness are the constraint —
       and thickness is the one that decides whether a recorder is tolerable
       under clothing for the hours between visits. Depth is the third span and
       it cannot be shown: the clay view is a front elevation, so the object's
       own depth foreshortens to nothing. */
    clay: {
      strokes: [
        ...dim('x', -0.525, 0.525, -0.30, -0.11),
        ...dim('y', -0.085, 0.105, 0.78, 0.60),
      ],
    },
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
    /* Construction, and it is software, so there is no millimetre to give — the
       skeleton and the plumb lines *are* what the method constructs. The impulse
       arrow that used to sit here is gone: process does not imply motion, and an
       arrow was the first thing rejected.
       A plumb from each head to the ground, against a ground line, is exactly
       the construction a fall check performs. It asserts no verdict — where the
       plumb falls relative to the base of support is the question, and the
       drawing states the question rather than answering it. */
    clay: {
      strokes: [
        ...skeleton(POSE_A).map((points) => ({ points, width: 1.1 })),
        ...skeleton(POSE_B).map((points) => ({ points, width: 1.1 })),
        rule([-1.1, 0, 0.2], [1.1, 0, 0.2]),
        rule([POSE_A.head[0], POSE_A.head[1], POSE_A.head[2]], [POSE_A.head[0], 0, POSE_A.head[2]]),
        rule([POSE_B.head[0], POSE_B.head[1], POSE_B.head[2]], [POSE_B.head[0], 0, POSE_B.head[2]]),
      ],
    },
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
    /* Dimension. A bedside unit is constrained by the table it stands on: how
       big the screen has to be to read from a pillow, and how far off the
       surface it sits. The lower span runs from the table itself, which is why
       it starts at the base's own footing rather than at the shell. */
    clay: {
      strokes: [
        ...dim('x', -0.43, 0.43, 0.80, 0.71),
        ...dim('y', 0.125, 0.615, 0.72, 0.56),
        ...dim('y', -0.34, 0.125, 0.94, 0.56),
      ],
    },
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
    /* Construction, necessarily — software, so there is no dimension to give
       that would not be invented. A page's grid is literally what the pipeline
       reads: the text block, the indent that marks a nested structure, and the
       extent of the block that was lifted out of it.
       Authored in the *page* plane rather than the picture plane. This is the
       one object that lies flat and the one plate whose camera looks down at it
       (pitch 0.62), so a rectangle in XZ is what projects as a rectangle. */
    clay: {
      strokes: [
        plan(-0.58, 0.58, -0.46, 0.46, 0.02),
        rule([-0.41, 0.02, -0.46], [-0.41, 0.02, 0.46]),
        plan(-0.47, 0.31, -0.125, 0.025, 0.022, 1.1),
      ],
    },
    notes: [
      { at: [-0.08, 0.014, -0.05], text: 'FORMATTING IS THE MEANING', side: 'tl' },
      { at: [0.98, 0.08, 0.62], text: 'ONE CARD, GRADED', side: 'bl' },
    ],
  },
};
