/**
 * Build plates — a rendered object per module, in the register of an engraved
 * figure: registration corners, leader lines, a designation, contact shadow.
 *
 * The drawing itself is `render3d`; this file is the plate around it. Software
 * rasterisation rather than WebGL because these have to keep drawing in the
 * `fallback` tier, which is defined by not having WebGL at all — and because
 * they repaint twice in a visit, on scroll-in and on ground inversion, so a
 * GPU pipeline would buy nothing for seven more contexts.
 *
 * The canvases are `aria-hidden`: every claim they carry is in the figcaption
 * and the prose beside them.
 */

import { PLATES, type Note, type Plate } from '../data/builds';
import {
  grain, palette, projectPoint, renderScene, stroke3d,
  type Cam, type Palette, type Treatment,
} from './render3d';
import type { Mesh } from './mesh';

const W = 460;
const H = 340;
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/**
 * The board. Two studies across the top, the resolved object below — process
 * reading down to outcome, with the hero nearest the caption.
 *
 * Each view's scale comes from `fitFor()` rather than from a hand-tuned focal
 * length, so an object that changes shape reframes itself.
 */
interface View {
  treatment: Treatment;
  label: string;
  cx: number;
  cy: number;
  /** Baseline for this view's caption. */
  ly: number;
}

const VIEWS: View[] = [
  { treatment: 'flat',   label: '01 BLOCKED',  cx: 118, cy: 72,  ly: 134 },
  { treatment: 'clay',   label: '02 CLAY',     cx: 342, cy: 72,  ly: 134 },
  { treatment: 'render', label: '03 RENDERED', cx: 230, cy: 232, ly: 322 },
];

/** The hero — the only view that turns, and the only one carrying leaders. */
const HERO = VIEWS[2];

/** Geometry is deterministic, so build each object once per page load. */
const MESHES = new Map<string, Mesh>();
const meshFor = (id: string, plate: Plate): Mesh => {
  let m = MESHES.get(id);
  if (!m) { m = plate.build(); MESHES.set(id, m); }
  return m;
};

/* One scratch buffer for all seven plates — they paint one at a time, and a
   canvas per figure would be seven more backing stores for no gain. */
let scratchCanvas: HTMLCanvasElement | null = null;
function scratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
    scratchCanvas.width = w;
    scratchCanvas.height = h;
  }
  return scratchCanvas.getContext('2d');
}

function label(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  align: CanvasTextAlign = 'left', size = 8,
) {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.letterSpacing = '0.09em';
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
}

/** Corner ticks. The plate's edge, without a box drawn around the object. */
function registration(ctx: CanvasRenderingContext2D, p: Palette) {
  const m = 12;
  const len = 9;
  ctx.strokeStyle = p.line;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  for (const [x, sx] of [[m, 1], [W - m, -1]] as const) {
    for (const [y, sy] of [[m, 1], [H - m, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x + sx * len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * len);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* Labels live in the corners of the *hero band* and the leader reaches in from
   there. Board corners were the obvious place and they are wrong here: a leader
   from the top of the board to the hero crosses both studies on its way down.
   Free-floating elbows were tried first and they wander: a leader whose elbow
   is derived from the projected point moves with the camera, so a label that
   clears the object on one plate crosses it on the next. Corners are fixed,
   which makes the seven read as one set. */
const INSET = { x: 22, top: 172, bot: 44 };

function leader(ctx: CanvasRenderingContext2D, n: Note, cam: Cam, p: Palette) {
  const [px, py] = projectPoint(n.at, cam, HERO.cx, HERO.cy);

  ctx.font = `500 8px ${MONO}`;
  const width = ctx.measureText(n.text).width + n.text.length * 0.74; // letter-spacing

  const left = n.side === 'tl' || n.side === 'bl';
  const top = n.side === 'tl' || n.side === 'tr';

  const ty = top ? INSET.top : H - INSET.bot;
  const tx = left ? INSET.x : W - INSET.x;

  // The leader springs from the end of the text that faces the object.
  const hx = left ? tx + width + 7 : tx - width - 7;
  const hy = ty - 3;

  ctx.strokeStyle = p.line;
  ctx.fillStyle = p.line;
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.9;

  ctx.beginPath();
  ctx.arc(px, py, 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(px, py);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = p.label;
  label(ctx, n.text, tx, ty, left ? 'left' : 'right');
}

/** The light inside the object, laid down before the geometry covers it. */
function glow(ctx: CanvasRenderingContext2D, plate: Plate, cam: Cam, v: View, p: Palette) {
  if (!plate.glow) return;
  const [gx, gy] = projectPoint(plate.glow.at, cam, v.cx, v.cy);
  const r = (cam.f * plate.glow.r) / cam.dist;
  const [ar, ag, ab] = p.accent;

  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  g.addColorStop(0, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0.30)`);
  g.addColorStop(0.45, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0.10)`);
  g.addColorStop(1, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Where each plate has been turned to. Survives repaints; resets on nothing. */
const ANGLE = new Map<string, { yaw: number; pitch: number }>();

/* Each view's usable area, inset from the board edges and clear of the
   captions. Objects are fitted to these rather than to the whole canvas. */
const BAND = { hero: { w: 396, h: 138 }, study: { w: 184, h: 90 } };

interface Fit { f: number; ox: number; oy: number; kStudy: number }
const FITS = new Map<string, Fit>();

/**
 * Frame the object against its own projected bounds.
 *
 * Hand-tuning a focal length per plate was the first approach and every object
 * needed re-tuning whenever its geometry moved — seven numbers, each wrong in a
 * different direction, none of them re-derivable. Measuring the projection
 * instead makes framing a property of the object.
 *
 * Fitted once, at the *authored* angle: a fit that tracked rotation would make
 * the object breathe as it turned.
 */
function fitFor(id: string, plate: Plate, mesh: Mesh): Fit {
  const hit = FITS.get(id);
  if (hit) return hit;

  // Project at a reference focal length; everything below is a ratio.
  const probe: Cam = { ...plate.cam, f: 1000, ox: 0, oy: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const poly of mesh) {
    for (const v of poly.v) {
      const [sx, sy] = projectPoint(v, probe, 0, 0);
      if (sx < x0) x0 = sx;
      if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy;
      if (sy > y1) y1 = sy;
    }
  }

  const w = Math.max(x1 - x0, 1e-3);
  const h = Math.max(y1 - y0, 1e-3);
  const scale = Math.min(BAND.hero.w / w, BAND.hero.h / h);

  /* The projected centre is rarely the model origin — an object with a long
     tail on one side hangs off centre — so the offset recentres what was
     actually measured. */
  const fit: Fit = {
    f: 1000 * scale,
    ox: -((x0 + x1) / 2) * scale,
    oy: -((y0 + y1) / 2) * scale,
    kStudy: Math.min(BAND.study.w / (w * scale), BAND.study.h / (h * scale)),
  };
  FITS.set(id, fit);
  return fit;
}

/** The camera for one view, at that plate's current rotation. */
function camFor(plate: Plate, id: string, v: View, fit: Fit): Cam {
  const a = ANGLE.get(id);
  const k = v === HERO ? 1 : fit.kStudy;
  return {
    ...plate.cam,
    f: fit.f * k,
    ox: fit.ox * k,
    oy: fit.oy * k,
    yaw: plate.cam.yaw + (v === HERO ? a?.yaw ?? 0 : 0),
    pitch: plate.cam.pitch + (v === HERO ? a?.pitch ?? 0 : 0),
  };
}

/**
 * @param quick  Reduced quality: the hero drops to the blocked pass and the
 *   studies are not redrawn at all. Used while a plate is being dragged.
 */
function render(canvas: HTMLCanvasElement, id: string, plate: Plate, quick = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const wantW = Math.round(W * dpr);
  if (canvas.width !== wantW) {
    canvas.width = wantW;
    canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const p = palette(canvas);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.textBaseline = 'alphabetic';

  registration(ctx, p);

  const mesh = meshFor(id, plate);
  const fit = fitFor(id, plate, mesh);

  for (const v of VIEWS) {
    const cam = camFor(plate, id, v, fit);
    const treatment: Treatment = quick && v === HERO ? 'flat' : v.treatment;

    if (v === HERO) glow(ctx, plate, cam, v, p);

    renderScene(
      ctx,
      {
        mesh,
        mats: plate.mats,
        cam,
        ground: plate.ground,
        shadow: plate.shadow,
        treatment,
      },
      p,
      v.cx,
      v.cy,
    );

    // Inked lines are part of the finished object, not of the studies.
    if (v === HERO && treatment === 'render') {
      for (const s of plate.strokes ?? []) {
        stroke3d(ctx, cam, s.points, v.cx, v.cy,
          s.accent ? css(p.accent) : `rgba(${p.deep.map((n) => n | 0).join(',')}, 0.55)`,
          s.width ?? 1.4);
      }
    }
  }

  /* Grain, confined to what has actually been drawn.
     `overlay` deposits alpha across the whole rect, which turns the plate from
     a window onto the page into a tinted box sitting on top of it — the field
     stops showing through and the figure grows a visible edge. So: keep the
     pre-grain alpha, grain the whole rect, then multiply that alpha back.
     `destination-in` leaves RGB alone, so the texture survives on the object
     and the empty plate goes back to being empty. */
  const mask = scratch(canvas.width, canvas.height);
  if (mask) {
    mask.setTransform(1, 0, 0, 1, 0, 0);
    mask.clearRect(0, 0, canvas.width, canvas.height);
    mask.drawImage(canvas, 0, 0);
  }
  grain(ctx, W, H);
  if (mask) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask.canvas, 0, 0);
    ctx.restore();
  }

  // Type stays off the grain so it stays crisp.
  ctx.fillStyle = p.label;
  ctx.globalAlpha = 0.7;
  for (const v of VIEWS) label(ctx, v.label, v.cx, v.ly, 'center', 7);
  ctx.globalAlpha = 1;

  for (const n of plate.notes) leader(ctx, n, camFor(plate, id, HERO, fit), p);

  ctx.fillStyle = p.label;
  ctx.globalAlpha = 0.75;
  label(ctx, plate.designation, W - 24, H - 8, 'right');
  ctx.globalAlpha = 1;
}

const css = ([r, g, b]: [number, number, number]) => `rgb(${r | 0} ${g | 0} ${b | 0})`;

/**
 * Mount every `[data-figure]` canvas. Plates draw when they come into view and
 * redraw when the ground inverts — never per frame; nothing here moves.
 */
export function mountFigures(root: ParentNode = document) {
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-figure]')];
  if (!canvases.length) return;

  const live = new Set<HTMLCanvasElement>();

  const paint = (canvas: HTMLCanvasElement) => {
    const id = canvas.dataset.figure!;
    const plate = PLATES[id];
    if (plate) render(canvas, id, plate);
  };

  if (!('IntersectionObserver' in window)) {
    canvases.forEach((el) => { live.add(el); paint(el); });
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLCanvasElement;
          if (e.isIntersecting) { live.add(el); paint(el); }
          else live.delete(el);
        }
      },
      { rootMargin: '160px 0px' },
    );
    canvases.forEach((el) => io.observe(el));
  }

  /* The ground inversion changes every colour these are drawn in, and it is
     scrubbed by scroll rather than fired once, so watch the attribute instead
     of trying to guess when it settles. */
  let pending = 0;
  const repaint = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => live.forEach(paint), 120);
  };
  new MutationObserver(repaint).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-ground'],
  });
  window.addEventListener('resize', repaint);

  canvases.forEach(turnable);
}

/* ── turning the hero ────────────────────────────────────────────────────── */

/** Pitch is clamped so the object can never flip or sink below its own shadow. */
const PITCH_MIN = -0.18;
const PITCH_MAX = 0.96;

/**
 * Drag the hero to turn it. No zoom, no pan.
 *
 * This inverts a deliberate property of the rest of the file — plates draw
 * twice in a visit, never per frame. Three things pay for it: only the dragged
 * plate repaints, only the hero view moves, and while the pointer is down the
 * hero drops to the blocked pass, which skips the per-vertex gradient fit that
 * dominates the frame.
 */
function turnable(canvas: HTMLCanvasElement) {
  const id = canvas.dataset.figure!;
  const plate = PLATES[id];
  if (!plate) return;

  let dragging = false;
  let pid: number | null = null;
  let lastX = 0, lastY = 0;
  /* Touch only: until a gesture has proved itself horizontal, it belongs to the
     page. Capturing every touch that starts on a plate would trap the reader on
     a phone, where the plate is most of the column width. */
  let claimed = true;
  let startX = 0, startY = 0;
  let queued = false;

  const angle = () => {
    let a = ANGLE.get(id);
    if (!a) { a = { yaw: 0, pitch: 0 }; ANGLE.set(id, a); }
    return a;
  };

  const draw = (quick: boolean) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render(canvas, id, plate, quick);
    });
  };

  /** The hero occupies the lower band; the studies are not handles. */
  const onHero = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return (e.clientY - r.top) / r.height > 0.4;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!onHero(e)) return;
    dragging = true;
    pid = e.pointerId;
    lastX = startX = e.clientX;
    lastY = startY = e.clientY;
    claimed = e.pointerType !== 'touch';
    canvas.dataset.turning = '';
    /* The field behind the page takes pointer input too — a click depolarizes
       and a traced circle induces the spiral that unlocks the egg. Turning a
       render must not do either. */
    e.stopPropagation();
    if (claimed) e.preventDefault();
  });

  const move = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pid) return;

    if (!claimed) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dy > 10 && dy > dx) { end(e); return; }   // it was a scroll
      if (dx < 10 || dx <= dy) return;              // not yet decided
      claimed = true;
    }

    e.stopPropagation();
    e.preventDefault();

    const a = angle();
    a.yaw += (e.clientX - lastX) * 0.011;

    /* Clamp the *absolute* pitch, not the offset — the limit is about where the
       camera ends up relative to the ground plane the contact shadow sits on,
       and each plate starts from its own authored angle. */
    const want = plate.cam.pitch + a.pitch + (e.clientY - lastY) * 0.007;
    a.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, want)) - plate.cam.pitch;

    lastX = e.clientX;
    lastY = e.clientY;
    draw(true);
  };

  const end = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false;
    pid = null;
    delete canvas.dataset.turning;
    draw(false);          // back to full quality
  };

  /* Bound to the window, not the canvas: a drag that leaves the element
     otherwise never receives its pointerup and sticks. */
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
