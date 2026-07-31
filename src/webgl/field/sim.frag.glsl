/* ─────────────────────────────────────────────────────────────
   Barkley's model of an excitable medium.

     ∂u/∂t = D∇²u + ε⁻¹·u·(1−u)·(u − (v+b)/a)
     ∂v/∂t = u − v

   u is the fast variable — the depolarization front.
   v is the slow one — recovery, the refractory tail that makes a
   wave unable to travel back into where it just came from. That
   single asymmetry is why these waves annihilate on collision
   instead of passing through each other, and why a broken front
   curls into a spiral.

   Explicit Euler, clamped. Zero-flux (Neumann) boundaries.
   ───────────────────────────────────────────────────────────── */

precision highp float;

uniform sampler2D uPrev;
uniform vec2  uTexel;
uniform float uDt;
uniform float uA;      // excitation threshold scale
uniform float uB;      // threshold offset
uniform float uEps;    // time-scale separation (small = stiff, sharp fronts)
uniform float uD;      // diffusion
uniform float uAspect;

uniform int  uStimCount;
uniform vec4 uStim[8]; // xy = uv, z = radius, w = amplitude

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 c = texture2D(uPrev, uv).rg;
  float u = c.r;
  float v = c.g;

  /* 5-point Laplacian. Clamping the sample coordinate gives a
     zero-flux wall: the wave reflects off the edge of the
     viewport rather than vanishing through it. */
  float uL = texture2D(uPrev, vec2(max(uv.x - uTexel.x, 0.0), uv.y)).r;
  float uR = texture2D(uPrev, vec2(min(uv.x + uTexel.x, 1.0), uv.y)).r;
  float uD_ = texture2D(uPrev, vec2(uv.x, max(uv.y - uTexel.y, 0.0))).r;
  float uT = texture2D(uPrev, vec2(uv.x, min(uv.y + uTexel.y, 1.0))).r;
  float lap = uL + uR + uD_ + uT - 4.0 * u;

  float threshold = (v + uB) / uA;
  float du = uD * lap + (u * (1.0 - u) * (u - threshold)) / uEps;
  float dv = u - v;

  u += uDt * du;
  v += uDt * dv;

  /* Stimuli are applied as a max, not an add: a depolarization
     drives the membrane to threshold, it does not stack. */
  for (int i = 0; i < 8; i++) {
    if (i >= uStimCount) break;
    vec4 s = uStim[i];
    vec2 d = (uv - s.xy) * vec2(uAspect, 1.0);
    float m = 1.0 - smoothstep(s.z * 0.55, s.z, length(d));
    u = max(u, m * s.w);
  }

  gl_FragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}
