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
import { grain, palette, projectPoint, renderScene, seam, type Palette } from './render3d';
import type { Mesh } from './mesh';

const W = 460;
const H = 268;
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

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

/* Labels live in the plate's corners and the leader reaches in from there.
   Free-floating elbows were tried first and they wander: a leader whose elbow
   is derived from the projected point moves with the camera, so a label that
   clears the object on one plate crosses it on the next. Corners are fixed,
   which makes the seven read as one set. */
const INSET = { x: 22, top: 26, bot: 30 };

function leader(ctx: CanvasRenderingContext2D, n: Note, plate: Plate, p: Palette) {
  const [px, py] = projectPoint(n.at, plate.cam, W / 2, H / 2 + 6);

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

/** The light inside the lantern, laid down before the geometry covers it. */
function glow(ctx: CanvasRenderingContext2D, plate: Plate, p: Palette) {
  if (!plate.glow) return;
  const [gx, gy] = projectPoint(plate.glow.at, plate.cam, W / 2, H / 2 + 6);
  const r = (plate.cam.f * plate.glow.r) / plate.cam.dist;
  const [ar, ag, ab] = p.accent;

  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
  g.addColorStop(0, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0.30)`);
  g.addColorStop(0.45, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0.10)`);
  g.addColorStop(1, `rgba(${ar | 0}, ${ag | 0}, ${ab | 0}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function render(canvas: HTMLCanvasElement, id: string, plate: Plate) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const p = palette(canvas);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.textBaseline = 'alphabetic';

  registration(ctx, p);
  glow(ctx, plate, p);

  renderScene(
    ctx,
    { mesh: meshFor(id, plate), mats: plate.mats, cam: plate.cam, ground: plate.ground, shadow: plate.shadow },
    p,
    W / 2,
    H / 2 + 6,
  );

  for (const sm of plate.seams ?? []) {
    seam(ctx, plate.cam, sm.centre, sm.axis, sm.r, W / 2, H / 2 + 6, `rgba(${p.deep.map((v) => v | 0).join(',')}, 0.5)`);
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

  // Leaders and the designation stay off the grain, so the type stays crisp.
  for (const n of plate.notes) leader(ctx, n, plate, p);

  ctx.fillStyle = p.label;
  ctx.globalAlpha = 0.75;
  label(ctx, plate.designation, W - 24, H - 16, 'right');
  ctx.globalAlpha = 1;
}

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
}
