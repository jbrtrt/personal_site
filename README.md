# Benjamin Greenfield — personal site

A single-page site whose background is a live excitable medium. Click and the
tissue depolarizes; waves propagate, collide, annihilate. Trace a slow circle
and you induce re-entry — a spiral that chases its own tail, which is
physiologically what an arrhythmia is, and which unlocks something.

## Run it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173/personal_site/**

```bash
npm run build      # typecheck + static build → dist/
npm run preview    # serve the production bundle on :4173
```

Node 22+. No backend, no API keys, no external asset fetches — everything the
page draws is generated at runtime.

## The idea

Hodgkin–Huxley models a living membrane as literally an electrical circuit:
membrane capacitance as a capacitor, ion channels as variable conductances,
Nernst potentials as batteries. It is the one place where medicine and
electrical engineering are the same equation, which makes it the right spine
for a physician-engineer's site.

One signal, three registers, and the page moves between them:

| Register | What it is |
|---|---|
| **Field** | A Barkley excitable medium solved on the GPU. Tissue. |
| **Trace** | The ECG — *derived from the running simulation*, not drawn. |
| **Circuit** | The same signal as current through copper routing. |

The two professions have two literal colour worlds — salmon-ruled chart paper
and a dark board with gold traces — and the site inverts between them across
the thesis section. That inversion is the argument.

## Things that are real, not decorative

**The ECG is a lead integral.** A body-surface electrode sees a distance-weighted
sum of membrane potential, so the trace is

```
S(t) = ⟨ u(x,t) · [ 1/|x−E₁| − 1/|x−E₂| ] ⟩
```

reduced 8×8 at a time from the simulation texture down to a single texel, packed
to 16 bits, and read back each frame. What is plotted is d*S*/d*t*, because an
electrode responds to the moving depolarization front rather than the plateau
behind it — which is exactly why a real QRS is a spike and not a step. Fire a
stimulus and the trace answers, because it is measuring the same tissue you just
touched.

**The rhythm is earned.** A pacemaker fires on a fixed interval, but a stimulus
landing in the refractory tail of the previous wave simply fails to capture, as
it would in real muscle. The rate in the corner reports what the tissue actually
did.

**The grid and the routing share a lattice.** Chart paper's 5 mm majors and the
board's trace pitch are the same lines, so the transition is not a cross-fade
between unrelated textures — the ruling you were already reading thickens into
copper and starts carrying current. It routes through a blackout rather than
mixing the two grounds directly, because a linear mix of cream and near-black
spends its midpoint as flat grey.

**Re-entry is induced properly.** A single stimulus makes a circular wave; a
spiral requires a *broken* front, so the gesture triggers an S1–S2 sequence
delivering the second stimulus into the refractory tail of the first — the same
protocol used to induce re-entry in an electrophysiology lab.

## Layout

```
index.html              all copy — the page is readable with JS disabled
src/
  main.ts               boot, capability tiering, scroll choreography, one clock
  core/
    capability.ts       WebGL2 / reduced-motion / device probe → full | calm | fallback
    pointer.ts          pointer state + signed-turning-angle spiral detection
  webgl/field/
    Field.ts            ping-pong GPGPU sim, reduction chain, pacemaker
    sim.frag.glsl       Barkley model, explicit Euler, zero-flux boundaries
    render.frag.glsl    both grounds, and the morph between them
    reduce.frag.glsl    lead integral → 16-bit packed readback
  ecg/Trace.ts          the strip chart, calibration pulse, R-peak detection
  ui/                   obfuscated email, portrait potential-map, list rendering
  data/publications.ts  the record
  styles/               tokens → base → type → sections
```

## Behaviour it is careful about

- **Three tiers, chosen honestly.** `full` runs the simulation; `calm`
  (`prefers-reduced-motion`) composes a still frame from the *same* simulation
  and stops integrating; `fallback` (no WebGL2) drops the canvases entirely and
  serves the document.
- **Wall-clock timestep.** Substeps scale with frame time, bounded both ways, so
  the wave speed and the reported rate are not functions of the GPU.
- **One-way quality degrade**, never below the substep count the front needs to
  survive — a cheaper frame that kills the wave is not a cheaper frame.
- **The email is never in the source.** It is XOR-masked and assembled inside
  the click handler; no `mailto:` with an address is ever written to the page.
  Grep the build and it is not there.
- The page carries no phone number and no home address.

## The photograph

Drop it at `public/headshot.jpg`. The path is relative to the page, so it
resolves under the Pages base path with no code change. Without it the plate
shows its `PLATE PENDING` state, which is deliberate rather than broken.

## Deployment

Pushing to the working branch runs `.github/workflows/deploy.yml`, which
typechecks, builds and publishes `dist/` to GitHub Pages.

One-time setup on the repo: make it public, then **Settings → Pages → Source:
GitHub Actions**.

Vite's `base` is `/personal_site/`. Moving to a root domain later is one line in
`vite.config.ts` — or set `SITE_BASE=/` in the build environment.
