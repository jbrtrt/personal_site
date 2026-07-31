/**
 * Build figures — Canvas 2D, drawn in the register of a journal plate.
 *
 * One renderer, one spec per figure (see data/builds.ts). Axes, ticks, units
 * and a numbered caption; hairlines, no fills that glow, no colour that means
 * "current". The electrical argument is the substrate's job, and running a
 * second one through the work would leave neither of them legible.
 *
 * Only visible figures draw, they draw once per state change rather than per
 * frame, and every number in them is already in the prose alongside — which is
 * why the canvas is aria-hidden rather than described.
 */

import { FIGURES, CURVES, type Axis, type Spec } from '../data/builds';

const W = 460;
const H = 268;
const PAD = { l: 52, r: 16, t: 18, b: 40 };

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

interface Ink {
  fg: string;
  faint: string;
  accent: string;
  rule: string;
}

type Scale = (v: number) => number;

const lin = (d0: number, d1: number, r0: number, r1: number): Scale =>
  (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

function ink(el: Element): Ink {
  const s = getComputedStyle(el);
  return {
    fg: s.getPropertyValue('--fg').trim() || '#17120E',
    faint: s.getPropertyValue('--fg-faint').trim() || '#8A7A6B',
    accent: s.getPropertyValue('--accent').trim() || '#C4543E',
    rule: s.getPropertyValue('--rule').trim() || '#E2D5C4',
  };
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = 'left', size = 9) {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.letterSpacing = '0.08em';
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
}

/** L-shaped axes with outward ticks — the plate convention, not a grid box. */
function frame(ctx: CanvasRenderingContext2D, c: Ink, x: Axis, y: Axis | null, sx: Scale, sy: Scale) {
  const x0 = PAD.l;
  const x1 = W - PAD.r;
  const y1 = H - PAD.b;

  ctx.strokeStyle = c.faint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, PAD.t);
  if (y) ctx.lineTo(x0, y1);
  else ctx.moveTo(x0, y1);
  ctx.lineTo(x1, y1);
  ctx.stroke();

  ctx.fillStyle = c.faint;
  for (const t of x.ticks) {
    const px = sx(t);
    ctx.beginPath();
    ctx.moveTo(px, y1);
    ctx.lineTo(px, y1 + 4);
    ctx.stroke();
    label(ctx, x.fmt ? x.fmt(t) : String(t), px, y1 + 15, 'center');
  }
  label(ctx, x.label.toUpperCase(), (x0 + x1) / 2, H - 8, 'center', 8);

  if (y) {
    for (const t of y.ticks) {
      const py = sy(t);
      ctx.beginPath();
      ctx.moveTo(x0 - 4, py);
      ctx.lineTo(x0, py);
      ctx.stroke();
      label(ctx, y.fmt ? y.fmt(t) : String(t), x0 - 8, py + 3, 'right');
    }
    ctx.save();
    ctx.translate(11, (PAD.t + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, y.label.toUpperCase(), 0, 0, 'center', 8);
    ctx.restore();
  }
}

function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][], sx: Scale, sy: Scale) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(sx(px), sy(py)) : ctx.moveTo(sx(px), sy(py))));
  ctx.stroke();
}

/* ── the seven ───────────────────────────────────────────────────────────── */

function draw(ctx: CanvasRenderingContext2D, spec: Spec, c: Ink) {
  const x1 = W - PAD.r;
  const y1 = H - PAD.b;

  switch (spec.kind) {
    /* Bland–Altman, drawn as the criterion the device has to meet. There are
       no points on it because there are no measurements to plot yet, and a
       scatter that exists to look like evidence is the exact failure this
       whole page argues against. */
    case 'agreement': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      const sy = lin(spec.y.min, spec.y.max, y1, PAD.t);
      frame(ctx, c, spec.x, spec.y, sx, sy);

      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.10;
      ctx.fillRect(PAD.l, sy(spec.loa), x1 - PAD.l, sy(-spec.loa) - sy(spec.loa));
      ctx.globalAlpha = 1;

      ctx.strokeStyle = c.accent;
      ctx.setLineDash([4, 3]);
      for (const v of [spec.loa, -spec.loa]) {
        ctx.beginPath();
        ctx.moveTo(PAD.l, sy(v));
        ctx.lineTo(x1, sy(v));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.strokeStyle = c.fg;
      ctx.beginPath();
      ctx.moveTo(PAD.l, sy(spec.bias));
      ctx.lineTo(x1, sy(spec.bias));
      ctx.stroke();

      ctx.fillStyle = c.accent;
      label(ctx, `+1.96 SD`, x1 - 4, sy(spec.loa) - 6, 'right');
      label(ctx, `−1.96 SD`, x1 - 4, sy(-spec.loa) + 13, 'right');
      ctx.fillStyle = c.faint;
      label(ctx, spec.band.toUpperCase(), PAD.l + 6, sy(0) - 7);
      break;
    }

    /* Two solutions to the same weekly clearance. The sawtooth is integrated,
       not drawn — see the kinetics in data/builds.ts. */
    case 'clearance': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      const sy = lin(spec.y.min, spec.y.max, y1, PAD.t);
      frame(ctx, c, spec.x, spec.y, sx, sy);

      for (const s of spec.series) {
        ctx.strokeStyle = s.accent ? c.accent : c.fg;
        ctx.lineWidth = s.accent ? 1.6 : 1.1;
        polyline(ctx, CURVES[s.key], sx, sy);
      }
      ctx.lineWidth = 1;

      const last = CURVES.continuous[CURVES.continuous.length - 1]!;
      const peak = CURVES.intermittent.reduce((b, p) => (p[1] > b[1] ? p : b));
      ctx.fillStyle = c.accent;
      label(ctx, 'CONTINUOUS', PAD.l + 8, sy(last[1]) + 14);
      ctx.fillStyle = c.fg;
      label(ctx, 'THREE SESSIONS A WEEK', sx(peak[0]) + 6, sy(peak[1]) - 6);
      break;
    }

    /* Only the pooled estimate is drawn, because only the pooled estimate is
       known here. Rows appear the moment cohorts are supplied. */
    case 'forest': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      const rows = spec.cohorts.length;
      const top = PAD.t + 6;
      const gap = rows ? Math.min(14, (y1 - top - 26) / rows) : 0;
      frame(ctx, c, spec.x, null, sx, (v) => v);

      ctx.strokeStyle = c.faint;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sx(spec.null), PAD.t);
      ctx.lineTo(sx(spec.null), y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.faint;
      label(ctx, 'CHANCE', sx(spec.null) + 5, PAD.t + 9);

      spec.cohorts.forEach((r, i) => {
        const py = top + i * gap;
        ctx.strokeStyle = c.fg;
        ctx.beginPath();
        ctx.moveTo(sx(r.lo), py);
        ctx.lineTo(sx(r.hi), py);
        ctx.stroke();
        ctx.fillStyle = c.fg;
        ctx.fillRect(sx(r.est) - 2, py - 2, 4, 4);
      });

      // the summary diamond
      const dy = rows ? top + rows * gap + 14 : (PAD.t + y1) / 2;
      const d = 6;
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(sx(spec.pooled.lo), dy);
      ctx.lineTo(sx(spec.pooled.est), dy - d);
      ctx.lineTo(sx(spec.pooled.hi), dy);
      ctx.lineTo(sx(spec.pooled.est), dy + d);
      ctx.closePath();
      ctx.fill();

      label(ctx, spec.pooled.est.toFixed(3), sx(spec.pooled.hi) + 8, dy + 3);
      ctx.fillStyle = c.faint;
      label(ctx, spec.pooled.label.toUpperCase(), sx(spec.pooled.lo) - 8, dy + 3, 'right');
      break;
    }

    /* A year, to scale. The sliver on the left is the clinic. */
    case 'yearbar': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      frame(ctx, c, spec.x, null, sx, (v) => v);

      const barY = PAD.t + 44;
      const barH = 46;
      let cursor = 0;
      for (const s of spec.segments) {
        const x = sx(cursor);
        const w = Math.max(1.5, sx(cursor + s.hours) - x);
        if (s.accent) {
          ctx.fillStyle = c.accent;
          ctx.globalAlpha = 0.13;
          ctx.fillRect(x, barY, w, barH);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = c.accent;
          ctx.strokeRect(x + 0.5, barY + 0.5, w - 1, barH - 1);
        } else {
          ctx.fillStyle = c.fg;
          ctx.fillRect(x, barY, w, barH);
        }
        cursor += s.hours;
      }

      ctx.strokeStyle = c.fg;
      ctx.beginPath();
      ctx.moveTo(sx(spec.observed) + 1, barY);
      ctx.lineTo(sx(spec.observed) + 1, barY - 14);
      ctx.lineTo(sx(spec.observed) + 34, barY - 14);
      ctx.stroke();
      ctx.fillStyle = c.fg;
      label(ctx, `${spec.observed} H IN CLINIC`, sx(spec.observed) + 38, barY - 11);

      ctx.fillStyle = c.accent;
      label(ctx, `${(spec.total - spec.observed).toLocaleString('en-US')} HOURS ELSEWHERE`, x1 - 6, barY + barH + 16, 'right');
      break;
    }

    /* Method diagram: the pose, the impulse it should have produced, and the
       band of responses consistent with it. */
    case 'envelope': {
      const px = (v: number) => PAD.l + v * (x1 - PAD.l);
      const py = (v: number) => y1 - v * (y1 - PAD.t);

      ctx.strokeStyle = c.faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y1);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = c.faint;
      label(ctx, 'RESPONSE CONSISTENT WITH THE CONTACT', (PAD.l + x1) / 2, H - 8, 'center', 8);

      const j = spec.joints;
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1.4;
      for (const [a, b] of spec.bones) {
        ctx.beginPath();
        ctx.moveTo(px(j[a]![0]), py(j[a]![1]));
        ctx.lineTo(px(j[b]![0]), py(j[b]![1]));
        ctx.stroke();
      }
      ctx.fillStyle = c.fg;
      for (const [jx, jy] of j) {
        ctx.beginPath();
        ctx.arc(px(jx), py(jy), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // feasible envelope, measured from the contact point
      const cx = px(j[spec.impulse.at]![0]);
      const cy = py(j[spec.impulse.at]![1]);
      const span = spec.envelope * (x1 - PAD.l);
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(cx, PAD.t, span, y1 - PAD.t);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx + span, PAD.t);
      ctx.lineTo(cx + span, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c.accent;
      label(ctx, 'FEASIBLE', cx + 6, PAD.t + 10);

      // the impulse vector
      const ix = cx + spec.impulse.dx * (x1 - PAD.l);
      const iy = cy + spec.impulse.dy * (y1 - PAD.t);
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ix, iy);
      ctx.stroke();
      const a = Math.atan2(iy - cy, ix - cx);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix - 7 * Math.cos(a - 0.4), iy - 7 * Math.sin(a - 0.4));
      ctx.lineTo(ix - 7 * Math.cos(a + 0.4), iy - 7 * Math.sin(a + 0.4));
      ctx.closePath();
      ctx.fillStyle = c.fg;
      ctx.fill();

      // where the body actually went
      const ox = px(spec.observed);
      ctx.strokeStyle = c.fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ox, y1 - 6);
      ctx.lineTo(ox, PAD.t + 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox, PAD.t + 18, 3.4, 0, Math.PI * 2);
      ctx.stroke();
      label(ctx, 'OBSERVED', ox + 7, PAD.t + 21);
      ctx.lineWidth = 1;
      break;
    }

    /* The gate is the point: it runs on every utterance, not on the ones a
       model flagged. The top rung is drawn open because it is not built. */
    case 'ladder': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      const n = spec.rungs.length;
      const sy = lin(0, n - 1, y1 - 14, PAD.t + 10);
      frame(ctx, c, spec.x, null, sx, sy);

      spec.rungs.forEach((r, i) => {
        const py = sy(i);
        ctx.strokeStyle = c.rule;
        ctx.setLineDash(r.unbuilt ? [3, 4] : []);
        ctx.beginPath();
        ctx.moveTo(PAD.l, py);
        ctx.lineTo(x1, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = r.unbuilt ? c.accent : c.faint;
        label(ctx, r.label.toUpperCase(), PAD.l - 6, py + 3, 'right', 8);
      });

      // every utterance meets the gate
      ctx.strokeStyle = c.faint;
      for (const g of spec.gates) {
        ctx.beginPath();
        ctx.moveTo(sx(g), y1 - 6);
        ctx.lineTo(sx(g), y1);
        ctx.stroke();
      }
      ctx.fillStyle = c.faint;
      label(ctx, 'DETERMINISTIC GATE ON EVERY ONE', PAD.l, y1 - 11, 'left', 8);

      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 1.6;
      polyline(ctx, spec.path, sx, sy);
      ctx.lineWidth = 1;
      break;
    }

    /* The adoption rule, not the outcome: a rewrite ships only if it wins
       under both judges independently. */
    case 'bakeoff': {
      const sx = lin(spec.x.min, spec.x.max, PAD.l, x1);
      const sy = lin(spec.y.min, spec.y.max, y1, PAD.t);
      frame(ctx, c, spec.x, spec.y, sx, sy);

      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(sx(spec.threshold), PAD.t, x1 - sx(spec.threshold), sy(spec.threshold) - PAD.t);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent;
      ctx.strokeRect(sx(spec.threshold) + 0.5, PAD.t + 0.5, x1 - sx(spec.threshold) - 1, sy(spec.threshold) - PAD.t - 1);

      ctx.strokeStyle = c.faint;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD.l, y1);
      ctx.lineTo(x1, PAD.t);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = c.accent;
      label(ctx, 'ADOPTED', x1 - 6, PAD.t + 12, 'right');
      ctx.fillStyle = c.faint;
      label(ctx, 'AGREEMENT', sx(0.72) + 4, sy(0.78), 'left', 8);
      label(ctx, `TWO JUDGES · n = ${spec.n}`, PAD.l + 6, y1 - 8, 'left', 8);
      break;
    }
  }
}

function render(canvas: HTMLCanvasElement, spec: Spec, schematic: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const c = ink(canvas);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.textBaseline = 'alphabetic';
  draw(ctx, spec, c);

  if (schematic) {
    ctx.fillStyle = c.faint;
    label(ctx, 'SCHEMATIC', W - PAD.r, PAD.t - 6, 'right', 8);
  }
}

/**
 * Mount every `[data-figure]` canvas. Figures draw when they come into view
 * and redraw when the ground inverts — never per frame; nothing here moves.
 */
export function mountFigures(root: ParentNode = document) {
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>('canvas[data-figure]')];
  if (!canvases.length) return;

  const live = new Set<HTMLCanvasElement>();

  const paint = (canvas: HTMLCanvasElement) => {
    const fig = FIGURES[canvas.dataset.figure!];
    if (!fig) return;
    render(canvas, fig.spec, !!fig.schematic);
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
