/**
 * The readout.
 *
 * This draws dS/dt of the lead integral coming off the GPU — so
 * every deflection on screen is caused by a wave actually moving
 * through the tissue behind it. Fire a stimulus and the trace
 * answers; let it sit and the pacemaker's rhythm shows up as a
 * regular complex. Nothing here is a canned waveform.
 *
 * Paper speed and calibration are honoured for real: 25 mm/s, and
 * the strip opens with the 1 mV calibration pulse that every
 * genuine ECG starts with.
 */

interface Peak { t: number }

export class Trace {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private buf: Float32Array;
  private head = 0;
  private filled = 0;

  private pxPerSample = 3.6;
  private peaks: Peak[] = [];
  private lastPeak = 0;
  private armed = true;
  /** Slowly-decaying envelope, so detection tracks the signal's own
      scale instead of a hard-coded number that silently stops
      matching the moment the gain is retuned. */
  private envelope = 0.05;
  private lastPush = 0;

  bpm = 0;
  board = 0;

  constructor(private canvas: HTMLCanvasElement, samples = 720) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.buf = new Float32Array(samples);
    this.resize();
  }

  /** Dev introspection for the detector — see scripts/probe. */
  debug() {
    return {
      envelope: +this.envelope.toFixed(4),
      armed: this.armed,
      peaks: this.peaks.length,
      lastPeak: this.lastPeak,
      filled: this.filled,
      bpm: this.bpm,
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
    this.pxPerSample = this.w < 640 ? 2.6 : 3.6;
  }

  push(v: number, now: number) {
    this.buf[this.head] = v;
    this.head = (this.head + 1) % this.buf.length;
    if (this.filled < this.buf.length) this.filled++;

    /* R-peak detection against a decaying envelope.
       The decay is wall-clock, not per-sample: tying it to sample
       count means a slow machine holds the threshold high for far
       longer, and one big transient at boot then desensitises the
       detector for the rest of the visit. Two-second time constant. */
    const dt = this.lastPush ? Math.min(now - this.lastPush, 500) : 16;
    this.lastPush = now;
    this.envelope = Math.max(this.envelope * Math.exp(-dt / 2000), Math.abs(v), 0.03);

    const RISE = this.envelope * 0.38;

    if (this.armed && v > RISE) {
      this.armed = false;
      if (this.lastPeak) {
        const rr = now - this.lastPeak;
        if (rr > 240 && rr < 8000) {
          this.peaks.push({ t: now });
          if (this.peaks.length > 6) this.peaks.shift();
        }
      }
      this.lastPeak = now;
    }
    if (!this.armed && v < RISE * 0.4 && now - this.lastPeak > 240) this.armed = true;

    if (this.peaks.length >= 2) {
      const first = this.peaks[0]!.t;
      const last = this.peaks[this.peaks.length - 1]!.t;
      const mean = (last - first) / (this.peaks.length - 1);
      if (mean > 0) this.bpm = Math.round(60000 / mean);
    }
    if (now - this.lastPeak > 9000) this.bpm = 0;
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    const mid = h * 0.62;
    const amp = h * 0.30;

    // Ink on paper, copper on board.
    const ink = this.board < 0.5 ? '#2A1410' : '#E8B04B';
    const glow = this.board < 0.5 ? 'rgba(196,84,62,0.30)' : 'rgba(232,176,75,0.42)';
    const chrome = this.board < 0.5 ? 'rgba(74,64,56,0.62)' : 'rgba(167,156,140,0.62)';

    // ── the 1 mV calibration pulse ────────────────────────────
    const calW = 26;
    const calH = amp * 0.72;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.35;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(8, mid);
    ctx.lineTo(8 + calW * 0.34, mid);
    ctx.lineTo(8 + calW * 0.34, mid - calH);
    ctx.lineTo(8 + calW * 0.72, mid - calH);
    ctx.lineTo(8 + calW * 0.72, mid);
    ctx.lineTo(8 + calW, mid);
    ctx.stroke();

    // ── the trace ─────────────────────────────────────────────
    const startX = 8 + calW + 6;
    const usable = w - startX - 8;
    const count = Math.min(this.filled, Math.floor(usable / this.pxPerSample));
    if (count < 2) { this.chrome(chrome, mid); return; }

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = this.board < 0.5 ? 0 : 12;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < count; i++) {
      const idx = (this.head - count + i + this.buf.length * 2) % this.buf.length;
      // Soft clip. A hard clamp turns every large deflection into a
      // flat-topped square, which reads as digital rather than drawn.
      const v = Math.tanh(3.5 * this.buf[idx]!);
      const x = startX + i * this.pxPerSample;
      const y = mid - v * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // the pen, at the live end
    const lastIdx = (this.head - 1 + this.buf.length) % this.buf.length;
    const lastV = Math.tanh(3.5 * this.buf[lastIdx]!);
    const penX = startX + (count - 1) * this.pxPerSample;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(penX, mid - lastV * amp, 2.1, 0, Math.PI * 2);
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
    ctx.fillText('1 mV', 10, mid - h * 0.30 - 7);
    ctx.fillText('LEAD II  ·  25 mm/s', 10, h - 8);
  }
}
