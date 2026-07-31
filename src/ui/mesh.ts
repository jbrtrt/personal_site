/**
 * A very small 3D kit.
 *
 * The build objects are rendered by a software rasteriser into Canvas 2D
 * rather than by three.js, for three reasons that all point the same way:
 * the figures have to keep drawing in the `fallback` tier, which is defined
 * by *not having WebGL*; seven more WebGL contexts alongside the field
 * simulation is close to the browser's per-page limit; and these things
 * redraw twice in a visit — when they scroll into view and when the ground
 * inverts — so a GPU pipeline buys nothing.
 *
 * Everything is built from a handful of primitives and composed with
 * transforms. Hand-authored vertex lists for seven objects would be an
 * enormous amount of data to review and no easier to adjust.
 */

export type V3 = [number, number, number];

export interface Poly {
  /** Vertices, counter-clockwise seen from outside. */
  v: V3[];
  /** Vertex normals — present when the surface should read as smooth. */
  vn?: V3[];
  /** Index into the object's material list. */
  m: number;
}

export type Mesh = Poly[];

/* ── vector helpers ──────────────────────────────────────────────────────── */

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Face normal from the first three vertices. */
export function faceNormal(p: Poly): V3 {
  return norm(cross(sub(p.v[1], p.v[0]), sub(p.v[2], p.v[0])));
}

/* ── transforms ──────────────────────────────────────────────────────────── */

export interface Xf {
  pos?: V3;
  /** Euler angles in radians, applied X then Y then Z. */
  rot?: V3;
  scale?: V3 | number;
}

function apply(p: V3, xf: Xf): V3 {
  let [x, y, z] = p;

  const s = xf.scale ?? 1;
  if (typeof s === 'number') { x *= s; y *= s; z *= s; }
  else { x *= s[0]; y *= s[1]; z *= s[2]; }

  if (xf.rot) {
    const [rx, ry, rz] = xf.rot;
    if (rx) { const c = Math.cos(rx), n = Math.sin(rx); [y, z] = [y * c - z * n, y * n + z * c]; }
    if (ry) { const c = Math.cos(ry), n = Math.sin(ry); [x, z] = [x * c + z * n, -x * n + z * c]; }
    if (rz) { const c = Math.cos(rz), n = Math.sin(rz); [x, y] = [x * c - y * n, x * n + y * c]; }
  }

  const t = xf.pos;
  return t ? [x + t[0], y + t[1], z + t[2]] : [x, y, z];
}

/** Transform a mesh. Normals get the rotation but never the translation. */
export function place(mesh: Mesh, xf: Xf): Mesh {
  const rotOnly: Xf = { rot: xf.rot };
  return mesh.map((p) => ({
    v: p.v.map((q) => apply(q, xf)),
    vn: p.vn?.map((n) => norm(apply(n, rotOnly))),
    m: p.m,
  }));
}

export const merge = (...parts: Mesh[]): Mesh => parts.flat();

/** Re-label every polygon in a mesh with one material. */
export const material = (mesh: Mesh, m: number): Mesh => mesh.map((p) => ({ ...p, m }));

/* ── primitives ──────────────────────────────────────────────────────────── */

/**
 * A box with its edges cut back. Nothing manufactured has a truly sharp
 * corner, and the chamfer is most of what makes a rendered box read as an
 * object rather than as a cube.
 */
export function bevelBox(w: number, h: number, d: number, bev: number, m = 0): Mesh {
  const x = w / 2, y = h / 2, z = d / 2, b = Math.min(bev, x, y, z);
  const out: Mesh = [];

  // Six faces, each inset by the bevel.
  const faces: Array<[V3, V3, V3, V3]> = [
    [[-x + b, y, -z + b], [x - b, y, -z + b], [x - b, y, z - b], [-x + b, y, z - b]],          // +Y
    [[-x + b, -y, z - b], [x - b, -y, z - b], [x - b, -y, -z + b], [-x + b, -y, -z + b]],      // -Y
    [[-x + b, -y + b, z], [x - b, -y + b, z], [x - b, y - b, z], [-x + b, y - b, z]],          // +Z
    [[x - b, -y + b, -z], [-x + b, -y + b, -z], [-x + b, y - b, -z], [x - b, y - b, -z]],      // -Z
    [[x, -y + b, z - b], [x, -y + b, -z + b], [x, y - b, -z + b], [x, y - b, z - b]],          // +X
    [[-x, -y + b, -z + b], [-x, -y + b, z - b], [-x, y - b, z - b], [-x, y - b, -z + b]],      // -X
  ];
  for (const f of faces) out.push({ v: [f[0], f[1], f[2], f[3]], m });

  /* The chamfers themselves. Twelve edge strips and eight corner triangles is
     the pedantic version; the edge strips carry nearly all of the read, and
     the corners are filled by the strips overlapping at this scale. */
  const edges: Array<[V3, V3, V3, V3]> = [
    [[-x + b, y, z - b], [x - b, y, z - b], [x - b, y - b, z], [-x + b, y - b, z]],
    [[x - b, y, -z + b], [-x + b, y, -z + b], [-x + b, y - b, -z], [x - b, y - b, -z]],
    [[-x + b, -y + b, z], [x - b, -y + b, z], [x - b, -y, z - b], [-x + b, -y, z - b]],
    [[x - b, -y + b, -z], [-x + b, -y + b, -z], [-x + b, -y, -z + b], [x - b, -y, -z + b]],
    [[x - b, y, z - b], [x - b, y - b, z], [x, y - b, z - b], [x, y, z - b]],
    [[-x + b, y - b, z], [-x + b, y, z - b], [-x, y, z - b], [-x, y - b, z - b]],
    [[x - b, y - b, -z], [x - b, y, -z + b], [x, y, -z + b], [x, y - b, -z + b]],
    [[-x + b, y, -z + b], [-x + b, y - b, -z], [-x, y - b, -z + b], [-x, y, -z + b]],
    [[x - b, -y, z - b], [x - b, -y + b, z], [x, -y + b, z - b], [x, -y, z - b]],
    [[-x + b, -y + b, z], [-x + b, -y, z - b], [-x, -y, z - b], [-x, -y + b, z - b]],
    [[x - b, -y + b, -z], [x - b, -y, -z + b], [x, -y, -z + b], [x, -y + b, -z + b]],
    [[-x + b, -y, -z + b], [-x + b, -y + b, -z], [-x, -y + b, -z + b], [-x, -y, -z + b]],
  ];
  for (const e of edges) out.push({ v: [e[0], e[1], e[2], e[3]], m });

  return out;
}

/**
 * Surface of revolution around the Y axis. The workhorse here — capsules,
 * pucks, lantern glass, flared bases and plain cylinders are all profiles.
 *
 * @param profile  [radius, y] pairs, bottom to top.
 * @param smooth   Shade across segments instead of faceting them.
 */
export function lathe(profile: Array<[number, number]>, seg = 32, m = 0, smooth = true): Mesh {
  const out: Mesh = [];
  const step = (Math.PI * 2) / seg;

  for (let i = 0; i < seg; i++) {
    const a0 = i * step, a1 = (i + 1) * step;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);

    for (let j = 0; j < profile.length - 1; j++) {
      const [r0, y0] = profile[j];
      const [r1, y1] = profile[j + 1];

      // A zero-radius rung is a pole: emit a triangle, not a degenerate quad.
      const v: V3[] = [];
      const n: V3[] = [];
      const push = (r: number, y: number, c: number, s: number) => {
        v.push([r * c, y, r * s]);
        // Profile tangent rotated a quarter turn gives the surface normal.
        const dr = r1 - r0, dy = y1 - y0;
        n.push(norm([dy * c, -dr, dy * s]));
      };

      if (r0 === 0) { push(r0, y0, c0, s0); push(r1, y1, c1, s1); push(r1, y1, c0, s0); }
      else if (r1 === 0) { push(r0, y0, c0, s0); push(r0, y0, c1, s1); push(r1, y1, c0, s0); }
      else { push(r0, y0, c0, s0); push(r0, y0, c1, s1); push(r1, y1, c1, s1); push(r1, y1, c0, s0); }

      out.push(smooth ? { v, vn: n, m } : { v, m });
    }
  }
  return out;
}

/** Convenience profiles. */
export const cylinderProfile = (r: number, h: number): Array<[number, number]> =>
  [[0, -h / 2], [r, -h / 2], [r, h / 2], [0, h / 2]];

export function capsuleProfile(r: number, len: number, steps = 8): Array<[number, number]> {
  const p: Array<[number, number]> = [];
  const half = len / 2;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    p.push([Math.cos(a) * r, -half + Math.sin(a) * r]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    p.push([Math.cos(a) * r, half + Math.sin(a) * r]);
  }
  return p;
}

/** Icosphere. `noise` perturbs each vertex radially — a rock, not a ball. */
export function sphere(r: number, sub = 2, m = 0, noise = 0, seed = 1): Mesh {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts: V3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => norm(v as V3));

  let tris: Array<[number, number, number]> = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let s = 0; s < sub; s++) {
    const mid = new Map<string, number>();
    const next: Array<[number, number, number]> = [];
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      const hit = mid.get(key);
      if (hit !== undefined) return hit;
      const p = norm([
        verts[a][0] + verts[b][0], verts[a][1] + verts[b][1], verts[a][2] + verts[b][2],
      ]);
      verts.push(p);
      const idx = verts.length - 1;
      mid.set(key, idx);
      return idx;
    };
    for (const [a, b, c] of tris) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    tris = next;
  }

  /* Deterministic perturbation — a stone that reshuffles on every repaint
     would be a different stone each time the ground inverts. */
  let h = seed * 9973;
  const rand = () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
  const radii = verts.map(() => 1 + (noise ? (rand() - 0.5) * noise : 0));

  return tris.map(([a, b, c]) => ({
    v: [a, b, c].map((i): V3 => [
      verts[i][0] * r * radii[i], verts[i][1] * r * radii[i], verts[i][2] * r * radii[i],
    ]),
    vn: noise ? undefined : [verts[a], verts[b], verts[c]],
    m,
  }));
}

/** A circular cross-section swept along an arc in the XY plane — handles. */
export function sweepArc(
  radius: number, tube: number, from: number, to: number, steps = 24, ring = 10, m = 0,
): Mesh {
  const out: Mesh = [];
  const at = (i: number, j: number) => {
    const a = from + ((to - from) * i) / steps;
    const b = (j / ring) * Math.PI * 2;
    const cx = Math.cos(a) * radius, cy = Math.sin(a) * radius;
    const nx = Math.cos(a) * Math.cos(b), ny = Math.sin(a) * Math.cos(b), nz = Math.sin(b);
    return {
      p: [cx + nx * tube, cy + ny * tube, nz * tube] as V3,
      n: norm([nx, ny, nz]),
    };
  };
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      out.push({ v: [a.p, b.p, c.p, d.p], vn: [a.n, b.n, c.n, d.n], m });
    }
  }
  return out;
}

/** Extrude a closed 2D polygon (XZ plane) along Y. Cards, slabs, wedges. */
export function extrude(poly: Array<[number, number]>, h: number, m = 0): Mesh {
  const out: Mesh = [];
  const top = h / 2, bot = -h / 2;

  out.push({ v: poly.map(([x, z]): V3 => [x, top, z]), m });
  out.push({ v: [...poly].reverse().map(([x, z]): V3 => [x, bot, z]), m });

  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    out.push({ v: [[x0, bot, z0], [x1, bot, z1], [x1, top, z1], [x0, top, z0]], m });
  }
  return out;
}

/** Rounded rectangle in the XZ plane, for extruding. */
export function roundedRect(w: number, d: number, r: number, seg = 4): Array<[number, number]> {
  const x = w / 2 - r, z = d / 2 - r;
  const pts: Array<[number, number]> = [];
  const corner = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  };
  corner(x, z, 0);
  corner(-x, z, Math.PI / 2);
  corner(-x, -z, Math.PI);
  corner(x, -z, -Math.PI / 2);
  return pts;
}
