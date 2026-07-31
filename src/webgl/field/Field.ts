import {
  WebGLRenderer, WebGLRenderTarget, Scene, OrthographicCamera, Mesh,
  PlaneGeometry, ShaderMaterial, Vector2, Vector4, HalfFloatType,
  UnsignedByteType, RGBAFormat, LinearFilter, NearestFilter, ClampToEdgeWrapping,
} from 'three';

import quadVert from './quad.vert.glsl';
import simFrag from './sim.frag.glsl';
import renderFrag from './render.frag.glsl';
import reduceFrag from './reduce.frag.glsl';
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

  private rA!: WebGLRenderTarget;   // 64×64
  private rB!: WebGLRenderTarget;   // 8×8
  private rC!: WebGLRenderTarget;   // 1×1, packed to 16 bits

  private simMat: ShaderMaterial;
  private drawMat: ShaderMaterial;
  private reduceMat: ShaderMaterial;

  private simW = 1;
  private simH = 1;

  private readBuf = new Uint8Array(4);

  /** Latest lead integral S(t), and its derivative — the trace. */
  lead = 0;
  dLead = 0;
  private prevLead = 0;

  private substeps: number;
  private frameCost = 16;
  private degraded = false;

  /* A resting sinus rate, not a lazy one. The tissue itself decides
     whether each beat captures: a stimulus landing in the refractory
     tail of the previous wave simply fails, exactly as it would in
     real muscle, so the rhythm on the readout is earned rather than
     asserted. */
  private paceAt = 0;
  private paceEvery = 1000;

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

    this.reduceMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: reduceFrag,
      uniforms: {
        uSrc: { value: null }, uSrcTexel: { value: new Vector2() },
        uFirst: { value: 0 }, uPack: { value: 0 }, uAspect: { value: 1 },
        uE1: { value: new Vector2(0.18, 0.86) },   // ≈ right arm
        uE2: { value: new Vector2(0.84, 0.12) },   // ≈ left leg  → Lead II
        uGain: { value: 8 },
      },
    });

    this.quad = new Mesh(new PlaneGeometry(2, 2), this.simMat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.resize();
  }

  private makeRT(w: number, h: number, byte = false) {
    return new WebGLRenderTarget(w, h, {
      type: byte ? UnsignedByteType : HalfFloatType,
      format: RGBAFormat,
      minFilter: byte ? NearestFilter : LinearFilter,
      magFilter: byte ? NearestFilter : LinearFilter,
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

    if (!this.rA) {
      this.rA = this.makeRT(64, 64);
      this.rB = this.makeRT(8, 8);
      this.rC = this.makeRT(1, 1, true);
    }

    this.simMat.uniforms.uTexel.value.set(1 / this.simW, 1 / this.simH);
    this.simMat.uniforms.uAspect.value = aspect;
    this.reduceMat.uniforms.uAspect.value = aspect;
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

  /**
   * @param measure  Read the lead integral back this step. The readback
   *   is a GPU sync point, so a warm-up loop that wants N steps of
   *   tissue — not N samples of trace — must pass false or it will
   *   stall the main thread once per iteration.
   */
  step(dtMs: number, stimuli: Stimulus[], now: number, measure = true) {
    if (now - this.paceAt > this.paceEvery) {
      this.paceAt = now;
      stimuli = stimuli.concat([{ x: 0.13, y: 0.84, radius: 0.035, amplitude: 1 }]);
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

    if (measure) this.reduceLead();
    this.adapt(dtMs);
  }

  /** sim → 64×64 → 8×8 → 1×1(packed) → CPU. */
  private reduceLead() {
    const u = this.reduceMat.uniforms;

    u.uSrc.value = this.a.texture;
    u.uSrcTexel.value.set(1 / (64 * 8), 1 / (64 * 8));
    u.uFirst.value = 1; u.uPack.value = 0;
    this.blit(this.reduceMat, this.rA);

    u.uSrc.value = this.rA.texture;
    u.uSrcTexel.value.set(1 / (8 * 8), 1 / (8 * 8));
    u.uFirst.value = 0;
    this.blit(this.reduceMat, this.rB);

    u.uSrc.value = this.rB.texture;
    u.uSrcTexel.value.set(1 / 8, 1 / 8);
    u.uPack.value = 1;
    this.blit(this.reduceMat, this.rC);

    this.renderer.readRenderTargetPixels(this.rC, 0, 0, 1, 1, this.readBuf);
    const packed = (this.readBuf[0]! * 256 + this.readBuf[1]!) / 65535;
    const s = (packed - 0.5) * 2;

    this.prevLead = this.lead;
    this.lead = s;
    /* The electrode sees the moving front, not the plateau — so the
       trace is the derivative. Lightly smoothed, because the readback
       is quantised to 16 bits and differencing it raw turns that
       quantisation into visible stair-stepping. */
    const raw = (s - this.prevLead) * 12;
    this.dLead = this.dLead * 0.6 + raw * 0.4;
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
    this.rA.dispose(); this.rB.dispose(); this.rC.dispose();
    this.quad.geometry.dispose();
    this.simMat.dispose(); this.drawMat.dispose(); this.reduceMat.dispose();
    this.renderer.dispose();
  }
}
