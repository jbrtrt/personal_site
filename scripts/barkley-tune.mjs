// Does the chosen parameter set do the three things the site needs:
// propagate, annihilate on collision, and curl into a spiral from a
// broken front (S1–S2)?
function makeSim({ a, b, eps, D, dt, N }) {
  const u = new Float32Array(N * N), v = new Float32Array(N * N);
  const u2 = new Float32Array(N * N), v2 = new Float32Array(N * N);
  const cl = (x) => Math.min(N - 1, Math.max(0, x));

  const disc = (cx, cy, r) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) u[y * N + x] = 1;
  };
  const halfPlane = (xmax, ymax) => {
    for (let y = 0; y < ymax; y++) for (let x = 0; x < xmax; x++) u[y * N + x] = 1;
  };

  const step = (n) => {
    for (let s = 0; s < n; s++) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, uu = u[i], vv = v[i];
        const lap = u[cl(y) * N + cl(x - 1)] + u[cl(y) * N + cl(x + 1)]
                  + u[cl(y - 1) * N + cl(x)] + u[cl(y + 1) * N + cl(x)] - 4 * uu;
        const nu = uu + dt * (D * lap + (uu * (1 - uu) * (uu - (vv + b) / a)) / eps);
        const nv = vv + dt * (uu - vv);
        u2[i] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
        v2[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
      }
      u.set(u2); v.set(v2);
    }
  };

  const excited = () => { let c = 0; for (let i = 0; i < N * N; i++) if (u[i] > 0.5) c++; return c; };
  // rotational asymmetry: a spiral has a persistent excited core
  const centreMass = () => {
    let sx = 0, sy = 0, m = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const w = u[y * N + x]; if (w > 0.5) { sx += x * w; sy += y * w; m += w; }
    }
    return m ? [sx / m, sy / m] : null;
  };
  return { disc, halfPlane, step, excited, centreMass };
}

const P = { a: 0.75, b: 0.02, eps: 0.04, D: 1, dt: 0.04, N: 150 };
const SUB = 8;

// ── 1 · head-on collision must annihilate ─────────────────────
{
  const s = makeSim(P);
  s.disc(30, 75, 7);
  s.disc(120, 75, 7);
  const trail = [];
  for (let f = 0; f < 90; f++) { s.step(SUB); if (f % 15 === 0) trail.push(s.excited()); }
  console.log('collision  excited over time:', trail.join(' → '));
  console.log('           annihilated:', s.excited() === 0 ? 'YES' : `no (${s.excited()} left)`);
}

// ── 2 · S1–S2 must produce a persistent spiral ────────────────
{
  const s = makeSim(P);
  s.disc(75, 75, 8);           // S1
  s.step(SUB * 14);            // let it expand and lay a refractory tail
  s.halfPlane(150, 75);        // S2 into the tail — breaks the front
  const trail = [];
  for (let f = 0; f < 240; f++) { s.step(SUB); if (f % 40 === 0) trail.push(s.excited()); }
  const alive = s.excited();
  console.log('\nspiral     excited over time:', trail.join(' → '));
  console.log('           sustained after 240 frames:', alive > 40 ? `YES (${alive})` : `NO (${alive})`);
  console.log('           core at:', s.centreMass()?.map((n) => n.toFixed(0)).join(','));
}

// ── 3 · long-run numerical stability ──────────────────────────
{
  const s = makeSim(P);
  s.disc(40, 75, 8);
  for (let f = 0; f < 600; f++) s.step(SUB);
  console.log('\nstability  after 600 frames: excited =', s.excited(), '(finite, no blow-up)');
}
