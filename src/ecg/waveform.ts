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
 * McSharry-style construction — with intervals that hold up:
 *
 *      P 80 ms  ·  PR 160 ms  ·  QRS 90 ms  ·  QT ~380 ms
 *
 * The beats themselves are still driven by the simulation: the pacemaker firing
 * schedules a sinus beat, and depolarizing the tissue by hand schedules a PVC.
 * So the strip reports what the page is actually doing — but it is synthesized,
 * not derived, and the README says so.
 */

export type BeatKind = 'sinus' | 'pvc';

interface Wavelet {
  /** centre, ms from beat onset */ t: number;
  /** amplitude, mV */             a: number;
  /** half-width, ms */            w: number;
}

/* Lead II. Upright P, small septal q, dominant R, small s, upright T. */
const SINUS: Wavelet[] = [
  { t:   0, a:  0.13, w: 26 },   // P — atrial depolarization
  { t: 152, a: -0.06, w:  8 },   // Q — septal
  { t: 170, a:  1.05, w:  9 },   // R
  { t: 190, a: -0.20, w: 11 },   // S
  { t: 330, a:  0.26, w: 46 },   // T — ventricular repolarization
];

/**
 * A premature ventricular contraction. No P — the impulse starts below the
 * atria. The QRS is wide and bizarre because activation crawls myocyte-to-
 * myocyte instead of running down the conduction system, and the T wave is
 * discordant: opposite in direction to the main QRS deflection.
 */
const PVC: Wavelet[] = [
  { t: 150, a: -0.34, w: 26 },
  { t: 196, a:  1.32, w: 34 },
  { t: 250, a: -0.52, w: 30 },
  { t: 400, a: -0.42, w: 72 },   // discordant T
];

export interface Beat {
  kind: BeatKind;
  /** performance.now() at beat onset */
  at: number;
}

const BEAT_SPAN = 560;   // ms of waveform a single beat contributes

export class Rhythm {
  private beats: Beat[] = [];

  /** ms of refractoriness after a beat — a stimulus inside this captures nothing. */
  private readonly refractory = 260;

  /**
   * @returns whether the beat captured. A stimulus landing in the refractory
   *   tail of the preceding beat does nothing, exactly as it would in muscle,
   *   so the rhythm on screen is earned rather than asserted.
   */
  schedule(kind: BeatKind, at: number): boolean {
    const last = this.beats[this.beats.length - 1];
    if (last && at - last.at < this.refractory) return false;

    this.beats.push({ kind, at });
    if (this.beats.length > 24) this.beats.shift();
    return true;
  }

  /**
   * A PVC resets the ventricle but not the sinus node, so the next sinus
   * impulse arrives on schedule and finds tissue still refractory. The beat
   * after that lands one full cycle later — the compensatory pause, and the
   * reason a PVC feels like a "skipped" beat.
   */
  compensatoryUntil(pvcAt: number, cycle: number): number {
    return pvcAt + cycle * 1.9;
  }

  /** Summed mV at an absolute time. */
  sample(t: number): number {
    let v = 0;
    for (let i = this.beats.length - 1; i >= 0; i--) {
      const b = this.beats[i]!;
      const dt = t - b.at;
      if (dt < -20) continue;
      if (dt > BEAT_SPAN) break;

      const shape = b.kind === 'sinus' ? SINUS : PVC;
      for (const g of shape) {
        const d = (dt - g.t) / g.w;
        if (d > -4 && d < 4) v += g.a * Math.exp(-0.5 * d * d);
      }
    }
    return v;
  }

  /** Rate from the last few R-R intervals, or 0 if there is no rhythm yet. */
  rate(now: number): number {
    const recent = this.beats.filter((b) => now - b.at < 12000);
    if (recent.length < 2) return 0;
    const span = recent[recent.length - 1]!.at - recent[0]!.at;
    if (span <= 0) return 0;
    return Math.round(60000 / (span / (recent.length - 1)));
  }

  get lastBeat(): Beat | undefined { return this.beats[this.beats.length - 1]; }
  clear() { this.beats = []; }
}
