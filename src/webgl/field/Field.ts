import {
  WebGLRenderer, WebGLRenderTarget, Scene, OrthographicCamera, Mesh,
  PlaneGeometry, ShaderMaterial, Vector2, Vector4, HalfFloatType,
  RGBAFormat, LinearFilter, ClampToEdgeWrapping,
} from 'three';

import quadVert from './quad.vert.glsl';
import simFrag from './sim.frag.glsl';
import renderFrag from './render.frag.glsl';
import type { Capability } from '../../core/capability';
import type { Stimulus } from '../../core/pointer';

const MAX_STIM = 8;

export class Field {
  readonly renderer: WebGLRenderer;

  private scene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;

  private a!: WebGLRenderTarget;
  private b!: WebGLRenderTarget;

  private simMat: ShaderMaterial;
  private drawMat: ShaderMaterial;

  private simW = 1;
  private simH = 1;

  private substeps: number;
  private frameCost = 16;
  private degraded = false;

  /* The sinus node. 1000 ms — 60 bpm, the slow end of normal sinus
     rhythm — and it keeps its own clock: nothing downstream resets it.
     That is the whole mechanism behind the compensatory pause, because
     an ectopic beat leaves the ventricle refractory when the next sinus
     impulse arrives on schedule, and the beat after that lands a full
     cycle later. See Rhythm in ecg/waveform.ts. */
  private paceAt = 0;
  private paceEvery = 1000;

  /** Fired when the pacemaker discharges, so the strip can schedule a beat. */
  onPace: ((now: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, private cap: Capability) {
    this.renderer = new WebGLRenderer({
      canvas, antialias: false, alpha: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(cap.dpr);
    this.renderer.autoClear = false;

    this.substeps = cap.tier === 'calm' ? 4 : 8;

    const stim: Vector4[] = Array.from({ length: MAX_STIM }, () => new Vector4());

    this.simMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: simFrag,
      uniforms: {
        // Measured, not guessed: these are the values that actually
        // sustain a front, annihilate on collision and hold a spiral.
        // Weaker time-scale separation (larger ε) lets the recovery
        // variable catch the front and extinguish it.
        uPrev: { value: null }, uTexel: { value: new Vector2() },
        uDt: { value: 0.04 }, uA: { value: 0.75 }, uB: { value: 0.02 },
        uEps: { value: 0.04 }, uD: { value: 1.0 }, uAspect: { value: 1 },
        uStimCount: { value: 0 }, uStim: { value: stim },
      },
    });

    this.drawMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: renderFrag,
      uniforms: {
        uField: { value: null }, uRes: { value: new Vector2() },
        uMM: { value: 9 }, uBoard: { value: 0 }, uReveal: { value: 0 },
        uTime: { value: 0 }, uDim: { value: 1 },
      },
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.simMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.resize();
  }

  private makeRT(w: number, h: number) {
    return new WebGLRenderTarget(w, h, {
      type: HalfFloatType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.cap.dpr);
    this.renderer.setSize(w, h, false);

    const aspect = w / h;
    const edge = this.cap.simEdge;
    this.simW = aspect >= 1 ? edge : Math.round(edge * aspect);
    this.simH = aspect >= 1 ? Math.round(edge / aspect) : edge;

    this.a?.dispose(); this.b?.dispose();
    this.a = this.makeRT(this.simW, this.simH);
    this.b = this.makeRT(this.simW, this.simH);

    this.simMat.uniforms.uTexel.value.set(1 / this.simW, 1 / this.simH);
    this.simMat.uniforms.uAspect.value = aspect;
    this.drawMat.uniforms.uRes.value.set(w, h);
    // Chart paper reads as chart paper only at a plausible physical
    // scale; hold ~9 CSS px per millimetre, tightening on phones.
    this.drawMat.uniforms.uMM.value = w < 640 ? 6.5 : 9;

    this.clear();
  }

  /** Return the tissue to rest — a true flatline. */
  clear() {
    const prev = this.renderer.getRenderTarget();
    this.renderer.setClearColor(0x000000, 1);
    for (const rt of [this.a, this.b]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(prev);
  }

  private blit(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  /**
   * S1–S2. A single stimulus makes a circular wave; a wave only
   * curls into a spiral if its front is *broken*, so the second
   * stimulus is delivered into the refractory tail of the first —
   * which is precisely how re-entry is induced in a real
   * electrophysiology lab.
   */
  induceReentry(x: number, y: number, fire: (s: Stimulus) => void) {
    fire({ x, y, radius: 0.10, amplitude: 1 });
    setTimeout(() => {
      for (let i = 0; i < 6; i++) {
        fire({ x: x + 0.055 * i - 0.14, y: y + 0.004 * i, radius: 0.045, amplitude: 1 });
      }
    }, 240);
  }

  step(dtMs: number, stimuli: Stimulus[], now: number) {
    /* The sinus node runs on its own clock, not on the frame clock.
       Resetting paceAt to `now` on each discharge quantises the interval up
       to one frame every beat, so a machine rendering at 5 fps reports 35 bpm
       for a pacemaker set to 60 — the rate becomes a property of the GPU,
       which is the exact failure the substep scaling below exists to avoid.
       Advancing by whole intervals keeps it honest. */
    if (!this.paceAt) this.paceAt = now;

    let fired = 0;
    if (now - this.paceAt > this.paceEvery * 4) {
      /* Back from a stall — a hidden tab, or a machine slower than the heart.
         Resync instead of replaying the backlog, but still fire: dropping the
         beat here means a device whose every frame is longer than the interval
         never gets a rhythm at all, which is worse than an irregular one. */
      this.paceAt = now;
      this.onPace?.(now);
      fired = 1;
    } else {
      while (now - this.paceAt >= this.paceEvery && fired < 2) {
        this.paceAt += this.paceEvery;
        this.onPace?.(this.paceAt);
        fired++;
      }
    }
    if (fired) {
      // A small focus. The wave has to be legible without being the
      // loudest thing on a page made mostly of prose.
      stimuli = stimuli.concat([{ x: 0.13, y: 0.84, radius: 0.028, amplitude: 1 }]);
    }

    const u = this.simMat.uniforms;
    const arr = u.uStim.value as Vector4[];
    const n = Math.min(stimuli.length, MAX_STIM);
    for (let i = 0; i < n; i++) {
      const s = stimuli[i]!;
      arr[i]!.set(s.x, s.y, s.radius, s.amplitude);
    }

    /* Advance on wall-clock, not per-frame. A fixed substep count
       means a 30 fps machine runs the tissue at half speed — the
       wave, the rhythm and therefore the reported rate all become
       functions of the GPU. Bounded on both sides so a long stall
       cannot dump a huge, unstable time step into an explicit solver. */
    const scale = Math.max(0.5, Math.min(2.5, dtMs / 16.67));
    const steps = Math.max(3, Math.round(this.substeps * scale));

    for (let i = 0; i < steps; i++) {
      // Stimuli are injected once, on the first substep only.
      u.uStimCount.value = i === 0 ? n : 0;
      u.uPrev.value = this.a.texture;
      this.blit(this.simMat, this.b);
      const t = this.a; this.a = this.b; this.b = t;
    }

    this.adapt(dtMs);
  }

  draw(timeSec: number) {
    const u = this.drawMat.uniforms;
    u.uField.value = this.a.texture;
    u.uTime.value = timeSec;
    this.blit(this.drawMat, null);
  }

  /** One-way quality degrade; never oscillates. */
  private adapt(dtMs: number) {
    this.frameCost = this.frameCost * 0.92 + dtMs * 0.08;
    // Never drop below the substep count the front needs to survive —
    // a cheaper frame that kills the wave is not a cheaper frame.
    if (!this.degraded && this.frameCost > 42 && this.substeps > 5) {
      this.degraded = true;
      this.substeps = 5;
      this.cap.dpr = Math.min(this.cap.dpr, 1.15);
      this.renderer.setPixelRatio(this.cap.dpr);
    }
  }

  set board(v: number) { this.drawMat.uniforms.uBoard.value = v; }
  get board() { return this.drawMat.uniforms.uBoard.value as number; }
  set reveal(v: number) { this.drawMat.uniforms.uReveal.value = v; }
  set dim(v: number) { this.drawMat.uniforms.uDim.value = v; }

  dispose() {
    this.a.dispose(); this.b.dispose();
    this.quad.geometry.dispose();
    this.simMat.dispose(); this.drawMat.dispose();
    this.renderer.dispose();
  }
}
