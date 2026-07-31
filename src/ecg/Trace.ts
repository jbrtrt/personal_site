/**
 * The readout.
 *
 * The strip is a real rhythm strip in the only sense a screen can manage: it
 * is dimensionally correct. Paper speed is 25 mm/s and the gain is 5 mm/mV —
 * half standard, which is a setting real machines use and label when a tall
 * QRS will not fit the paper. One millimetre here is the same millimetre the
 * field shader rules behind it, so the trace and the chart paper it sits on
 * share a scale rather than merely resembling one.
 *
 * The waveform comes from `Rhythm` — synthesized morphology, since a flat
 * isotropic sheet cannot produce P, PR, QRS and T (see ecg/waveform.ts). What
 * the simulation still owns is the rhythm itself: which beats happen, when,
 * and whether they capture at all.
 *
 * Sampling is on wall-clock at a fixed 200 Hz, and because the waveform is
 * analytic it can be evaluated at exactly the instants owed. A slow machine
 * gets a correctly-sampled trace rather than an interpolated one.
 */

import type { Rhythm } from './waveform';

/** Real ECG sampling rates are 500 Hz and up; 200 is ample to draw at. */
const SAMPLE_HZ = 200;
const SAMPLE_MS = 1000 / SAMPLE_HZ;

const PAPER_SPEED = 25;   // mm/s
const GAIN = 5;           // mm/mV — half standard

export class Trace {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private buf: Float32Array;
  private head = 0;
  private filled = 0;

  /** px per millimetre — matched to the field's chart-paper scale. */
  private mm = 9;
  private pxPerSample = 1;

  private nextSampleAt = 0;

  bpm = 0;
  board = 0;

  constructor(private canvas: HTMLCanvasElement, private rhythm: Rhythm, samples = 2048) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.buf = new Float32Array(samples);
    this.resize();
  }

  /** Dev introspection — see window.__bg.probe(). */
  debug() {
    return {
      filled: this.filled,
      bpm: this.bpm,
      beats: this.rhythm.count,
      mV: +this.buf[(this.head - 1 + this.buf.length) % this.buf.length]!.toFixed(3),
    };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.mm = this.w < 640 ? 6.5 : 9;
    this.pxPerSample = (PAPER_SPEED / SAMPLE_HZ) * this.mm;
  }

  /**
   * Fill the strip as though the pen had already been running for `seconds`.
   * The reduced-motion tier gets a composed result rather than a fast-forward
   * of the animation, and a rhythm strip with two beats on it is not a rhythm
   * strip.
   */
  compose(now: number, seconds: number) {
    this.nextSampleAt = now - seconds * 1000;
    this.advance(now, Math.ceil(seconds * SAMPLE_HZ) + 8);
  }

  /**
   * Draw the pen forward to `now`.
   *
   * @param budget  Most samples to take in one call. A backgrounded tab can
   *   owe minutes of paper; the strip is only as long as the screen, so
   *   catching all of it up sample by sample is work nobody will ever see.
   */
  advance(now: number, budget = 96) {
    if (!this.nextSampleAt) this.nextSampleAt = now;
    if (now - this.nextSampleAt > budget * SAMPLE_MS) {
      this.nextSampleAt = now - budget * SAMPLE_MS;
    }

    let taken = 0;
    while (this.nextSampleAt <= now && taken < budget) {
      this.buf[this.head] = this.rhythm.sample(this.nextSampleAt);
      this.head = (this.head + 1) % this.buf.length;
      if (this.filled < this.buf.length) this.filled++;
      this.nextSampleAt += SAMPLE_MS;
      taken++;
    }

    this.bpm = this.rhythm.rate(now);
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    // Baseline sits low enough to leave room for a 1.25 mV PVC above it.
    const mid = h * 0.68;
    const pxPerMv = GAIN * this.mm;

    // Ink on paper, copper on board.
    const ink = this.board < 0.5 ? '#2A1410' : '#E8B04B';
    const glow = this.board < 0.5 ? 'rgba(196,84,62,0.30)' : 'rgba(232,176,75,0.42)';
    const chrome = this.board < 0.5 ? 'rgba(74,64,56,0.62)' : 'rgba(167,156,140,0.62)';

    /* ── the calibration pulse ──────────────────────────────────
       200 ms wide, 1 mV tall, both drawn at the strip's own scale —
       so it measures correctly against the ruling behind it. */
    const calW = (PAPER_SPEED / 1000) * 200 * this.mm;
    const calH = pxPerMv;
    const lead = this.mm * 0.9;

    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.35;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, mid);
    ctx.lineTo(8 + lead, mid);
    ctx.lineTo(8 + lead, mid - calH);
    ctx.lineTo(8 + lead + calW, mid - calH);
    ctx.lineTo(8 + lead + calW, mid);
    ctx.lineTo(8 + lead + calW + lead, mid);
    ctx.stroke();

    /* ── the trace ────────────────────────────────────────────── */
    const startX = 8 + lead + calW + lead + this.mm;
    const usable = w - startX - 8;
    const count = Math.min(this.filled, Math.floor(usable / this.pxPerSample));
    if (count < 2) { this.chrome(chrome, mid); return; }

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = this.board < 0.5 ? 0 : 12;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let penY = mid;
    for (let i = 0; i < count; i++) {
      const idx = (this.head - count + i + this.buf.length * 2) % this.buf.length;
      const x = startX + i * this.pxPerSample;
      // Calibrated, so no soft clip — the scale is chosen to fit the tallest
      // beat the page can produce. The clamp is a guard against the canvas
      // edge, not a compressor on the signal.
      const y = Math.max(2, Math.min(h - 2, mid - this.buf[idx]! * pxPerMv));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      penY = y;
    }
    ctx.stroke();
    ctx.restore();

    // the pen, at the live end
    const penX = startX + (count - 1) * this.pxPerSample;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(penX, penY, 2.1, 0, Math.PI * 2);
    ctx.fill();

    this.chrome(chrome, mid);
  }

  private chrome(color: string, mid: number) {
    const { ctx, w, h } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(0, mid); ctx.lineTo(w, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace';
    ctx.letterSpacing = '1.4px';
    ctx.fillText('1 mV', 10, mid - GAIN * this.mm - 7);
    ctx.fillText('LEAD II  ·  25 mm/s  ·  5 mm/mV', 10, h - 8);
  }
}
