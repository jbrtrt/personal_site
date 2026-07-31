/**
 * What this machine can actually do, decided once at boot.
 *
 * The site has three tiers of behaviour and picks one honestly
 * rather than shipping the heavy path and hoping:
 *   full     — WebGL2, live simulation, scroll choreography
 *   calm     — reduced motion: composed, static, still legible
 *   fallback — no WebGL at all: pure document, no canvas
 */

export type Tier = 'full' | 'calm' | 'fallback';

export interface Capability {
  tier: Tier;
  gl2: boolean;
  dpr: number;
  /** Long-edge resolution budget for the simulation grid. */
  simEdge: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
}

function probeWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    // Half-float render targets are non-negotiable for the sim.
    const ok = !!gl.getExtension('EXT_color_buffer_half_float')
      || !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export function detect(): Capability {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const gl2 = probeWebGL2();

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const weak = mem <= 4 || cores <= 4;

  const dpr = Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 1.75);

  // The grid is the single biggest lever on frame time.
  let simEdge = 448;
  if (coarsePointer || weak) simEdge = 288;
  if (window.innerWidth < 640) simEdge = 256;

  const tier: Tier = !gl2 ? 'fallback' : reducedMotion ? 'calm' : 'full';

  return { tier, gl2, dpr, simEdge, coarsePointer, reducedMotion };
}
