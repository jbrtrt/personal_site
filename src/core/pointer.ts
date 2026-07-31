/**
 * Pointer state, plus the gesture that matters.
 *
 * Re-entry — the spiral — is what an arrhythmia physically is: a
 * wave that finds its own tail and starts chasing it. You can
 * provoke one here by tracing a circle, and the detector below is
 * what decides you did: it accumulates *signed* turning angle
 * around the running centroid of your drag, so a genuine loop
 * counts and a scribble back and forth cancels itself out.
 */

export interface PointerState {
  /** Normalized to the viewport, y already flipped into GL space. */
  x: number;
  y: number;
  down: boolean;
  moved: boolean;
}

export interface Stimulus {
  x: number;
  y: number;
  radius: number;
  amplitude: number;
}

type SpiralHandler = (x: number, y: number) => void;
type StimulusHandler = (at: number) => void;

export class Pointer {
  readonly state: PointerState = { x: 0.5, y: 0.5, down: false, moved: false };
  readonly queue: Stimulus[] = [];

  private path: Array<{ x: number; y: number }> = [];
  private turning = 0;
  private lastAngle: number | null = null;
  private onSpiral: SpiralHandler | null = null;
  private onEctopic: StimulusHandler | null = null;
  private spiralFired = false;
  private lastEmit = 0;

  constructor() {
    /* Bound to the window, not to the canvas. The content layer sits
       above the canvas in the stack, so a listener on the canvas only
       ever hears the few pixels no section covers — which is to say,
       almost never. The tissue has to be reachable through the type. */
    window.addEventListener('pointerdown', this.down, { passive: true });
    window.addEventListener('pointermove', this.move, { passive: true });
    window.addEventListener('pointerup', this.up, { passive: true });
    window.addEventListener('pointercancel', this.up, { passive: true });
  }

  /** Links and buttons keep their own behaviour, unstimulated. */
  private interactive(t: EventTarget | null): boolean {
    return t instanceof Element && !!t.closest('a, button, input, textarea, select, [role="button"]');
  }

  onReentry(fn: SpiralHandler) { this.onSpiral = fn; }

  /**
   * Called when the *reader* excites the tissue — not when the page does it
   * for them. The scroll choreography nudges the medium as sections arrive,
   * and those nudges must not be reported as heartbeats: an ectopic complex
   * on the strip has to mean somebody caused one.
   */
  onStimulus(fn: StimulusHandler) { this.onEctopic = fn; }

  /** Drain the pending stimuli — the sim consumes at most 8 a frame. */
  take(): Stimulus[] {
    if (!this.queue.length) return [];
    return this.queue.splice(0, 8);
  }

  fire(x: number, y: number, radius = 0.05, amplitude = 1) {
    this.queue.push({ x, y, radius, amplitude });
  }

  private norm(e: PointerEvent) {
    return { x: e.clientX / window.innerWidth, y: 1 - e.clientY / window.innerHeight };
  }

  private down = (e: PointerEvent) => {
    if (this.interactive(e.target)) return;
    const p = this.norm(e);
    this.state.x = p.x; this.state.y = p.y; this.state.down = true;
    this.path = [p];
    this.turning = 0;
    this.lastAngle = null;
    this.fire(p.x, p.y, 0.055, 1);
    this.onEctopic?.(performance.now());
    document.documentElement.dataset.stimulated = '1';
  };

  private move = (e: PointerEvent) => {
    const p = this.norm(e);
    this.state.x = p.x; this.state.y = p.y; this.state.moved = true;
    if (!this.state.down) return;

    // Paint excitation along the drag, rate-limited so a fast
    // sweep doesn't flood the 8-stimulus budget.
    const now = performance.now();
    if (now - this.lastEmit > 26) {
      this.fire(p.x, p.y, 0.038, 1);
      this.onEctopic?.(now);
      this.lastEmit = now;
    }

    this.path.push(p);
    if (this.path.length > 220) this.path.shift();
    this.accumulateTurn(p);
  };

  private up = () => {
    this.state.down = false;
    this.path = [];
    this.turning = 0;
    this.lastAngle = null;
  };

  private accumulateTurn(p: { x: number; y: number }) {
    // Short warm-up: the centroid needs a few samples to mean
    // anything, but every sample spent settling is turn the user
    // has to draw and doesn't get credited for.
    if (this.path.length < 6) return;

    let cx = 0, cy = 0;
    for (const q of this.path) { cx += q.x; cy += q.y; }
    cx /= this.path.length; cy /= this.path.length;

    const angle = Math.atan2(p.y - cy, p.x - cx);
    if (this.lastAngle !== null) {
      let d = angle - this.lastAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.turning += d;
    }
    this.lastAngle = angle;

    const turns = Math.abs(this.turning) / (Math.PI * 2);
    document.documentElement.style.setProperty('--turn', turns.toFixed(3));

    if (turns > 0.45) document.querySelector('[data-egg-cue]')?.setAttribute('data-close', '1');

    if (turns >= 0.85 && !this.spiralFired) {
      this.spiralFired = true;
      this.onSpiral?.(cx, cy);
      // one unlock per visit, but the physics stays available
      setTimeout(() => { this.spiralFired = false; }, 6000);
    }
  }

  dispose() {
    window.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
  }
}
