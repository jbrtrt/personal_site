/**
 * ECG morphology.
 *
 * The previous version plotted dS/dt of a lead integral taken across the
 * excitable sheet. That was honest and structurally incapable of producing an
 * ECG: a flat isotropic sheet has no atria, no AV node and no His–Purkinje
 * system, so P, PR, QRS and T have no mechanism to exist. It could only ever be
 * a squiggle, and to anyone who reads rhythm strips it looked broken.
 *
 * So morphology is synthesized here — a sum of Gaussians, the standard
 * McSharry-style construction — with intervals that hold up under measurement:
 *
 *      P 92 ms  ·  PR 155 ms  ·  QRS 85 ms  ·  QT 383 ms
 *
 * Those are measured, not asserted. `scripts/ecg-intervals.mjs` parses the
 * tables below straight out of this file, finds the fiducial points from the
 * waveform itself, and exits non-zero if any interval leaves its reference
 * range. It cannot drift from what ships.
 *
 * The beats themselves are still driven by the simulation: the pacemaker firing
 * schedules a sinus beat, and depolarizing the tissue by hand schedules a PVC.
 * So the strip reports what the page is actually doing — but it is synthesized,
 * not derived, and the README says so.
 */

export type BeatKind = 'sinus' | 'pvc';

interface Wavelet {
  /** centre, ms from beat onset */    t: number;
  /** amplitude, mV */                 a: number;
  /** half-width, ms — rising side */  w: number;
  /**
   * Half-width on the falling side. Real T waves are asymmetric: a slow
   * upstroke and a faster return. A symmetric Gaussian wide enough to carry
   * a normal QT drags its leading tail back into the ST segment and fuses
   * the QRS and T into one blob — which is exactly how the first attempt
   * measured a 149 ms QRS in a sinus beat.
   */
  w2?: number;
}

/* Lead II. Upright P, small septal q, dominant R, small s, upright T.
   Times are ms from beat onset, offset so that the whole complex sits at
   positive time: a wavelet centred at 0 would have half its area clipped by
   the beat's own start, and the P wave would arrive as a half-Gaussian with
   a vertical onset. */
const SINUS: Wavelet[] = [
  { t:  75, a:  0.135, w: 32 },            // P — atrial depolarization
  { t: 183, a: -0.06,  w:  7 },            // Q — septal
  { t: 212, a:  1.05,  w: 13 },            // R
  { t: 245, a: -0.25,  w: 13 },            // S
  { t: 495, a:  0.30,  w: 52, w2: 38 },    // T — ventricular repolarization
];

/**
 * A premature ventricular contraction. No P — the impulse starts below the
 * atria. The QRS is wide and bizarre because activation crawls myocyte-to-
 * myocyte instead of running down the conduction system, and the T wave is
 * discordant: opposite in direction to the main QRS deflection.
 *
 * Offset earlier than the sinus complex because the ectopic focus is the
 * ventricle itself — there is no atrium and no AV delay to wait through, so
 * the QRS follows the event almost immediately.
 */
const PVC: Wavelet[] = [
  { t:  43, a: -0.26,  w: 15 },
  { t:  85, a:  1.25,  w: 22 },
  { t: 140, a: -0.55,  w: 20 },
  { t: 355, a: -0.45,  w: 52, w2: 42 },    // discordant T
];

const SHAPES: Record<BeatKind, Wavelet[]> = { sinus: SINUS, pvc: PVC };

export interface Beat {
  kind: BeatKind;
  /** performance.now() at beat onset */
  at: number;
}

/** ms of waveform a single beat contributes — past the last wavelet's tails. */
const BEAT_SPAN = 700;

export class Rhythm {
  private beats: Beat[] = [];

  /**
   * Ventricular effective refractory period. A stimulus arriving inside it
   * captures nothing, exactly as in muscle — and this one constant is also
   * what produces the compensatory pause, because the sinus node upstream
   * keeps its own clock and is never reset by a beat that fails here. A PVC
   * late in the cycle swallows the next sinus impulse and the beat after it
   * lands a full cycle later; a PVC early in the cycle is interpolated and
   * nothing is dropped. Both are real, and which one you get depends on when
   * you clicked.
   */
  private readonly refractory = 300;

  /** @returns whether the beat captured. */
  schedule(kind: BeatKind, at: number): boolean {
    const last = this.beats[this.beats.length - 1];
    if (last && at - last.at < this.refractory) return false;

    this.beats.push({ kind, at });
    if (this.beats.length > 24) this.beats.shift();
    return true;
  }

  /** Summed mV at an absolute time. */
  sample(t: number): number {
    let v = 0;
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i]!;
      const dt = t - b.at;
      if (dt < 0) continue;
      if (dt > BEAT_SPAN) break;

      for (const g of SHAPES[b.kind]) {
        const w = g.w2 !== undefined && dt > g.t ? g.w2 : g.w;
        const d = (dt - g.t) / w;
        if (d > -4 && d < 4) v += g.a * Math.exp(-0.5 * d * d);
      }
    }
    return v;
  }

  /**
   * Rate from the beats that actually captured — not from peak-picking the
   * drawn trace, which would only be measuring our own arithmetic back. This
   * is the tissue's record: every entry is a pacemaker firing or a stimulus
   * that found excitable muscle.
   */
  rate(now: number): number {
    const recent = this.beats.filter((b) => now - b.at < 12000);
    if (recent.length < 2) return 0;
    const span = recent[recent.length - 1]!.at - recent[0]!.at;
    if (span <= 0) return 0;
    return Math.round(60000 / (span / (recent.length - 1)));
  }

  get lastBeat(): Beat | undefined { return this.beats[this.beats.length - 1]; }
  get count(): number { return this.beats.length; }
  clear() { this.beats = []; }
}
