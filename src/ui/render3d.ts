/**
 * A software renderer for the build plates.
 *
 * Painter's algorithm into Canvas 2D: project, cull, sort back-to-front, fill.
 * The one thing that lifts this out of "faceted polygons" is the fill itself —
 * lighting is evaluated per *vertex*, a plane is fitted through those values,
 * and the polygon is filled with the linear gradient that plane describes. That
 * is Gouraud shading expressed in the only primitive Canvas 2D has for it, and
 * it is why a 32-segment lathe reads as a turned surface rather than a barrel.
 *
 * Everything is drawn in the page's own two inks. The value ramp runs between
 * whichever of `--fg`/`--bg` is darker and whichever is lighter, so the objects
 * render as ink on paper above the fold and as light on board below it without
 * a second palette — lit is always lighter, shadow always darker.
 */

import { faceNormal, norm, dot, type Mesh, type Poly, type V3 } from './mesh';

/* ── palette ─────────────────────────────────────────────────────────────── */

export type RGB = [number, number, number];

export interface Palette {
  /** Deepest shadow and brightest lit value, ordered by luminance. */
  deep: RGB;
  pale: RGB;
  accent: RGB;
  /** For plate furniture — rules, leaders, labels. */
  line: string;
  label: string;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseColor(css: string, fallback: RGB): RGB {
  const s = css.trim();
  if (HEX.test(s)) {
    const h = s.slice(1);
    const n = h.length === 3 ? h.split('').map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
    return n.map((p) => parseInt(p, 16)) as RGB;
  }
  const m = s.match(/-?[\d.]+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : fallback;
}

/** sRGB relative luminance — used only to decide which ink is the shadow. */
function luma([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const css = ([r, g, b]: RGB) =>
  `rgb(${Math.round(clamp(r, 0, 255))} ${Math.round(clamp(g, 0, 255))} ${Math.round(clamp(b, 0, 255))})`;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Build the render palette from the element's own custom properties, so a
 * ground inversion needs no bookkeeping here — just a repaint.
 */
export function palette(el: Element): Palette {
  const s = getComputedStyle(el);
  const get = (k: string, fb: RGB) => parseColor(s.getPropertyValue(k), fb);

  const fg = get('--fg', [23, 18, 14]);
  const bg = get('--bg', [235, 226, 211]);
  const accent = get('--accent', [169, 58, 36]);

  const fgDark = luma(fg) < luma(bg);
  const ink = fgDark ? fg : bg;      // the darker of the two
  const paper = fgDark ? bg : fg;    // the lighter of the two

  return {
    /* Pulled off the extremes at both ends: a plate that bottoms out at pure
       ink loses its form in the shadows, and one that tops out at pure paper
       dissolves into the page. */
    deep: mix(ink, paper, 0.06),
    pale: mix(paper, ink, 0.05),
    accent,
    line: s.getPropertyValue('--fg-faint').trim() || css(mix(ink, paper, 0.45)),
    label: s.getPropertyValue('--fg-faint').trim() || css(mix(ink, paper, 0.35)),
  };
}

/* ── materials ───────────────────────────────────────────────────────────── */

export interface Mat {
  /** Albedo: scales the whole value range. 1 is a white body, 0.4 a dark one. */
  tone: number;
  /** Specular strength, 0–1. */
  spec: number;
  /** Specular exponent. High and tight reads as glass or polish. */
  gloss: number;
  /** 0 neutral ink, 1 fully the accent colour. */
  hue?: number;
  /** Below 1 the surface is see-through — glass, a lens cover. */
  alpha?: number;
}

export const MAT = (tone: number, spec = 0.2, gloss = 24, hue = 0, alpha = 1): Mat =>
  ({ tone, spec, gloss, hue, alpha });

/* ── camera ──────────────────────────────────────────────────────────────── */

export interface Cam {
  /** Turntable angle, radians. */
  yaw: number;
  /** Elevation, radians. Positive looks down on the object. */
  pitch: number;
  /** Camera distance in model units. */
  dist: number;
  /** Focal length in pixels — with `dist`, this sets both size and how much
      perspective the object shows. */
  f: number;
  /** Screen offset from the plate centre, in pixels. */
  ox?: number;
  oy?: number;
}

/** World → camera. The camera sits at the origin looking down −Z. */
function toView(p: V3, cam: Cam): V3 {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x = p[0] * cy - p[2] * sy;
  const z = p[0] * sy + p[2] * cy;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  return [x, p[1] * cp - z * sp, p[1] * sp + z * cp - cam.dist];
}

/** Rotation only — for normals. */
function rotate(n: V3, cam: Cam): V3 {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x = n[0] * cy - n[2] * sy;
  const z = n[0] * sy + n[2] * cy;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  return [x, n[1] * cp - z * sp, n[1] * sp + z * cp];
}

/** Camera → screen. Guards the near plane so a stray vertex cannot fling. */
function project(v: V3, cam: Cam, cx: number, cy: number): [number, number] {
  const d = Math.max(-v[2], 0.05);
  return [cx + (cam.f * v[0]) / d + (cam.ox ?? 0), cy - (cam.f * v[1]) / d + (cam.oy ?? 0)];
}

/** Exposed so callers can hang annotation leaders off a model-space point. */
export const projectPoint = (p: V3, cam: Cam, cx: number, cy: number) =>
  project(toView(p, cam), cam, cx, cy);

/* ── lighting ────────────────────────────────────────────────────────────── */

/* Fixed in camera space, not world space: the plates are lit from the upper
   left like every other engraved figure, and a light that swung around with
   each object's turntable angle would make the set look unrelated. */
const KEY: V3 = norm([-0.52, 0.74, 0.62]);
const FILL: V3 = norm([0.68, 0.18, 0.42]);
const AMB = 0.20;

function shade(n: V3, v: V3, m: Mat): number {
  const lam = Math.max(dot(n, KEY), 0);
  const fil = Math.max(dot(n, FILL), 0);

  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  const eye: V3 = [-v[0] / len, -v[1] / len, -v[2] / len];

  const h = norm([KEY[0] + eye[0], KEY[1] + eye[1], KEY[2] + eye[2]]);
  const s = m.spec * Math.max(dot(n, h), 0) ** m.gloss;

  /* A little light picked up at grazing angles. It is what separates a dark
     body from a dark background without drawing an outline around it. */
  const rim = 0.16 * (1 - Math.max(dot(n, eye), 0)) ** 3;

  return AMB + 0.66 * lam + 0.20 * fil + s + rim;
}

function toneOf(value: number, m: Mat, p: Palette): RGB {
  const t = clamp(value * m.tone, 0, 1);
  const base = mix(p.deep, p.pale, t);
  if (!m.hue) return base;
  const acc = mix(mix(p.accent, p.deep, 0.5), mix(p.accent, p.pale, 0.45), t);
  return mix(base, acc, m.hue);
}

/* ── the fill ────────────────────────────────────────────────────────────── */

/**
 * Least-squares plane through the per-vertex values, expressed as a linear
 * gradient. For a triangle the fit is exact; for a quad it is the closest
 * plane, which is what a renderer interpolating across two triangles would
 * average to anyway.
 */
function gradientFor(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  vals: number[],
  m: Mat,
  p: Palette,
): string | CanvasGradient {
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, sxv = 0, syv = 0, sv = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const v = vals[i];
    sxx += x * x; sxy += x * y; sx += x;
    syy += y * y; sy += y;
    sxv += x * v; syv += y * v; sv += v;
  }

  const det =
    sxx * (syy * n - sy * sy) - sxy * (sxy * n - sy * sx) + sx * (sxy * sy - syy * sx);

  const mean = sv / n;
  if (Math.abs(det) < 1e-9) return css(toneOf(mean, m, p));

  const a =
    (sxv * (syy * n - sy * sy) - sxy * (syv * n - sy * sv) + sx * (syv * sy - syy * sv)) / det;
  const b =
    (sxx * (syv * n - sy * sv) - sxv * (sxy * n - sy * sx) + sx * (sxy * sv - syv * sx)) / det;

  const g = Math.hypot(a, b);
  // Under about one value unit per 200px the ramp is invisible; skip the cost.
  if (g < 5e-4) return css(toneOf(mean, m, p));

  const ux = a / g, uy = b / g;
  let lo = Infinity, hi = -Infinity, lx = 0, ly = 0, hx = 0, hy = 0;
  for (const [x, y] of pts) {
    const t = x * ux + y * uy;
    if (t < lo) { lo = t; lx = x; ly = y; }
    if (t > hi) { hi = t; hx = x; hy = y; }
  }
  if (hi - lo < 0.4) return css(toneOf(mean, m, p));

  const c = (sv - a * sx - b * sy) / n;
  const grad = ctx.createLinearGradient(lx, ly, hx, hy);
  grad.addColorStop(0, css(toneOf(a * lx + b * ly + c, m, p)));
  grad.addColorStop(1, css(toneOf(a * hx + b * hy + c, m, p)));
  return grad;
}

/* ── the pass ────────────────────────────────────────────────────────────── */

interface Ready {
  pts: Array<[number, number]>;
  vals: number[];
  z: number;
  m: Mat;
}

export interface Scene {
  mesh: Mesh;
  mats: Mat[];
  cam: Cam;
  /** Y of the plane the contact shadow lands on, in model space. */
  ground?: number;
  /** Radius of that shadow. */
  shadow?: number;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  p: Palette,
  cx: number,
  cy: number,
) {
  const { mesh, mats, cam } = scene;

  if (scene.shadow) contactShadow(ctx, scene, p, cx, cy);

  const queue: Ready[] = [];

  for (const poly of mesh) {
    const view = poly.v.map((v) => toView(v, cam));

    // Centroid, used for both the backface test and the sort key.
    let ccx = 0, ccy = 0, ccz = 0;
    for (const v of view) { ccx += v[0]; ccy += v[1]; ccz += v[2]; }
    const k = 1 / view.length;
    const c: V3 = [ccx * k, ccy * k, ccz * k];

    const fn = faceNormal({ v: view, m: poly.m } as Poly);
    const m = mats[poly.m] ?? mats[0];

    /* A face is visible when its normal points back toward the camera. Skip
       the test for anything see-through: the whole point of glass is that the
       far wall shows through it. */
    if ((m.alpha ?? 1) >= 1 && dot(fn, c) > 0) continue;

    const vn = poly.vn?.map((n) => rotate(n, cam));
    queue.push({
      pts: view.map((v) => project(v, cam, cx, cy)),
      vals: view.map((v, i) => shade(vn ? vn[i] : fn, v, m)),
      z: c[2],
      m,
    });
  }

  // Farthest first. Camera looks down −Z, so that is ascending z.
  queue.sort((a, b) => a.z - b.z);

  for (const r of queue) {
    ctx.beginPath();
    r.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();

    const paint = gradientFor(ctx, r.pts, r.vals, r.m, p);
    const alpha = r.m.alpha ?? 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = paint;
    ctx.fill();

    /* Canvas antialiases every polygon against what is under it, so abutting
       faces leave a lighter hairline along every shared edge — a wireframe the
       object did not ask for. Stroking each face in its own fill covers it.
       Only on opaque faces: a translucent stroke lands *on top of* its own
       fill and on the face behind it, which draws the grid instead of hiding
       it — the exact failure this is here to prevent. */
    if (alpha >= 1) {
      ctx.strokeStyle = paint;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Contact shadow. The ground plane maps to an ellipse under any affine view,
 * so rather than projecting a disc vertex by vertex, project its centre and
 * two radii and let the transform carry the shape.
 */
function contactShadow(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  p: Palette,
  cx: number,
  cy: number,
) {
  const r = scene.shadow!;
  const y = scene.ground ?? 0;
  const o = projectPoint([0, y, 0], scene.cam, cx, cy);
  const ax = projectPoint([r, y, 0], scene.cam, cx, cy);
  const az = projectPoint([0, y, r], scene.cam, cx, cy);

  ctx.save();
  ctx.transform(ax[0] - o[0], ax[1] - o[1], az[0] - o[0], az[1] - o[1], o[0], o[1]);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const [dr, dg, db] = p.deep;
  g.addColorStop(0, `rgba(${dr | 0}, ${dg | 0}, ${db | 0}, 0.34)`);
  g.addColorStop(0.55, `rgba(${dr | 0}, ${dg | 0}, ${db | 0}, 0.13)`);
  g.addColorStop(1, `rgba(${dr | 0}, ${dg | 0}, ${db | 0}, 0)`);

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── seams ───────────────────────────────────────────────────────────────── */

/**
 * A great circle drawn on a sphere, hidden where it passes round the back.
 *
 * Classifying faces into panels was the first attempt and it read as
 * camouflage: at any subdivision cheap enough to draw seven times, the patch
 * boundary follows triangle edges, so a seam comes out as a zigzag. A curve
 * sampled on the sphere and clipped at the silhouette is exact at any
 * subdivision, and costs one polyline instead of a finer mesh.
 */
export function seam(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  centre: V3,
  axis: V3,
  r: number,
  cx: number,
  cy: number,
  colour: string,
  width = 1.4,
  steps = 190,
) {
  const a = norm(axis);
  // Any vector not parallel to the axis gives the first basis direction.
  const seed: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm([
    a[1] * seed[2] - a[2] * seed[1],
    a[2] * seed[0] - a[0] * seed[2],
    a[0] * seed[1] - a[1] * seed[0],
  ]);
  const v = norm([
    a[1] * u[2] - a[2] * u[1],
    a[2] * u[0] - a[0] * u[2],
    a[0] * u[1] - a[1] * u[0],
  ]);

  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  let drawing = false;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const n: V3 = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
    const p: V3 = [centre[0] + n[0] * r, centre[1] + n[1] * r, centre[2] + n[2] * r];

    const pc = toView(p, cam);
    // Front-facing when the surface normal leans back toward the camera.
    if (dot(rotate(n, cam), pc) < -0.02) {
      const [sx, sy] = project(pc, cam, cx, cy);
      if (drawing) ctx.lineTo(sx, sy);
      else { ctx.moveTo(sx, sy); drawing = true; }
    } else {
      drawing = false;
    }
  }
  ctx.stroke();
  ctx.restore();
}

/* ── grain ───────────────────────────────────────────────────────────────── */

let grainTile: CanvasPattern | null = null;

/**
 * The field behind the page is grained; a perfectly smooth render sits on top
 * of the paper instead of in it. One 64px tile, built once and reused by all
 * seven plates.
 */
export function grain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (!grainTile) {
    const t = document.createElement('canvas');
    t.width = t.height = 64;
    const tc = t.getContext('2d');
    if (!tc) return;
    const img = tc.createImageData(64, 64);
    let seed = 20260731;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const v = 128 + ((seed / 2147483648) - 0.5) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
    grainTile = ctx.createPattern(t, 'repeat');
  }
  if (!grainTile) return;

  /* Overlay leaves mid-grey alone and pushes the rest either way, so the same
     tile roughens the paper ground and the board ground without inverting. */
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = grainTile;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
