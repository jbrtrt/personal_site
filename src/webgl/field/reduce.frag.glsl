/* ─────────────────────────────────────────────────────────────
   Lead integral.

   A body-surface electrode does not see the membrane potential —
   it sees a weighted sum of it, with the weight falling off with
   distance to the electrode. Two electrodes differenced give a
   lead. So the trace this site draws is

       S(t) = ⟨ u(x,t) · [ 1/|x−E₁| − 1/|x−E₂| ] ⟩

   reduced 8×8 at a time down to a single texel, then packed to
   16 bits so it can be read back without needing a float-readback
   extension. The trace on screen is dS/dt, because an electrode
   responds to the moving front rather than the plateau behind it —
   which is exactly why a real QRS is a spike and not a step.
   ───────────────────────────────────────────────────────────── */

precision highp float;

uniform sampler2D uSrc;
uniform vec2  uSrcTexel;
uniform float uFirst;   // 1 = apply the lead field to u
uniform float uPack;    // 1 = emit 16-bit packed result
uniform float uAspect;
uniform vec2  uE1;
uniform vec2  uE2;
uniform float uGain;

varying vec2 vUv;

void main() {
  float acc = 0.0;

  for (int j = 0; j < 8; j++) {
    for (int i = 0; i < 8; i++) {
      vec2 uv = vUv + (vec2(float(i), float(j)) - 3.5) * uSrcTexel;

      if (uFirst > 0.5) {
        float u = texture2D(uSrc, uv).r;
        vec2 p = uv * vec2(uAspect, 1.0);
        float w = 1.0 / (distance(p, uE1) + 0.35)
                - 1.0 / (distance(p, uE2) + 0.35);
        acc += u * w;
      } else {
        acc += texture2D(uSrc, uv).r;
      }
    }
  }

  // Mean, not sum — keeps every stage inside half-float range.
  acc /= 64.0;

  if (uPack > 0.5) {
    float v = clamp(acc * uGain * 0.5 + 0.5, 0.0, 1.0) * 65535.0;
    float hi = floor(v / 256.0);
    float lo = v - hi * 256.0;
    gl_FragColor = vec4(hi / 255.0, lo / 255.0, 0.0, 1.0);
  } else {
    gl_FragColor = vec4(acc, 0.0, 0.0, 1.0);
  }
}
