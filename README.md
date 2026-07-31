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
| **Trace** | The ECG — morphology synthesized, rhythm driven by the simulation. |
| **Circuit** | The etched substrate the whole page sits on. |

The two professions have two literal colour worlds — salmon-ruled chart paper
and a dark board with gold traces — and the site inverts between them across
the thesis section. That inversion is the argument.

## Things that are real, not decorative

**The ECG morphology is synthesized, and that is the honest version.** An
earlier build plotted d*S*/d*t* of a lead integral taken across the sheet. That
was genuinely derived from the simulation and it was *structurally incapable of
being an ECG*: a flat isotropic medium has no atria, no AV node and no
His–Purkinje system, so P, PR, QRS and T have no mechanism to exist. It could
only ever be a squiggle, and to anyone who reads rhythm strips it looked broken —
because it was.

So the shape of a beat is now a sum of Gaussians, the standard McSharry-style
construction, and the intervals are measured rather than asserted:

```
P 92 ms · PR 155 ms · QRS 85 ms · QT 383 ms · ST isoelectric for 127 ms
```

`scripts/ecg-intervals.mjs` parses those wavelet tables straight out of
`src/ecg/waveform.ts`, finds the fiducial points from the waveform itself, and
exits non-zero if anything leaves its reference range. It cannot drift from what
ships.

**The rhythm is still the simulation's.** The pacemaker discharging schedules a
sinus beat; exciting the tissue by hand schedules a **PVC** — no P wave, wide
bizarre QRS, discordant T. Whether either captures is decided by a 300 ms
ventricular refractory period, so a click landing in the tail of the previous
beat does nothing at all. That one constant also produces the **compensatory
pause** for free: the sinus node keeps its own clock and is never reset, so a
PVC late in the cycle swallows the next sinus impulse and the beat after it
lands a full cycle later, while a PVC early in the cycle is interpolated and
nothing is dropped. Hold the pointer down and you pace the ventricle into a run
of wide complexes that stops when you let go.

**The strip is dimensionally correct.** 25 mm/s and 5 mm/mV — half standard,
which is a setting real machines use and label when a tall QRS will not fit the
paper. One millimetre on the strip is the same millimetre the field shader rules
behind it, and the calibration pulse is a true 200 ms × 1 mV.

**The reported rate is not a function of the GPU.** The sinus node advances by
whole intervals rather than resetting to the current frame's timestamp; resetting
quantises the interval up by one frame per beat, which had a 5 fps software
rasteriser reporting 35 bpm for a pacemaker set to 60.

**The circuit register lives in the substrate.** Ground-plane hatch, solder-mask
tooth, etched routing and plated vias with real annular rings, all at low
contrast. The wave on top of it runs at roughly a quarter of its old amplitude:
a background that competes with the prose has stopped being a background.

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
    Field.ts            ping-pong GPGPU sim, sinus node, perf governor
    sim.frag.glsl       Barkley model, explicit Euler, zero-flux boundaries
    render.frag.glsl    both grounds, the etched substrate, the morph between
  ecg/
    waveform.ts         sinus + PVC morphology, Rhythm scheduler, refractoriness
    Trace.ts            the strip chart, calibrated at 25 mm/s and 5 mm/mV
  ui/                   email (XOR-masked), portrait, build figures, lists
  data/
    publications.ts     the record
    builds.ts           figure specs, and the urea kinetics behind Fig. 2
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

## Verification

```bash
node scripts/ecg-intervals.mjs   # ECG intervals vs reference ranges — gates
node scripts/contrast.mjs        # WCAG 2.1 on both grounds — gates
node scripts/barkley-tune.mjs    # propagation, annihilation, spiral persistence

npm run dev                      # the browser passes need a server up
node scripts/check.mjs           # shaders, rhythm, figures, console — gates
node scripts/tiers.mjs           # reduced-motion and no-WebGL tiers
node scripts/drive.mjs           # full pass with screenshots into .shots/
```

`check.mjs` is the one to run before a push: it confirms the programs linked,
the rate reads 60 bpm, a click writes an ectopic beat, every figure drew, and
the console is clean — without the screenshots, which dominate the runtime on a
software rasteriser.

Before pushing, `npm run build` and grep `dist/` for the phone number, `Folsom`,
`jgreen40` and `tufts.edu`. All must be absent: the address is assembled at
runtime and must never appear in the bundle.

## The build figures

Seven journal plates — axes, ticks, units, numbered captions. Deliberately *not*
circuits: the electrical argument belongs to the substrate, and a second one
running through the work would leave neither legible.

They are also careful about what they claim. A figure asserts that somebody
measured something, so where the numbers exist they are used and the caption
names them, and where they do not the figure draws the **criterion**, the
**model** or the **decision rule** instead of inventing observations — and is
stamped `SCHEMATIC`. Fig. 2 is integrated single-pool urea kinetics rather than
a drawn curve; Fig. 3 shows the pooled AUC alone, because per-cohort estimates
would have to be fabricated to fill the rows. Paste the 19 real cohort values
into `cohorts` in `src/data/builds.ts` and they render with no other change.

## Contrast

`node scripts/contrast.mjs` resolves the tokens, computes WCAG 2.1 ratios for
every foreground/background pair in use **on both grounds**, and exits non-zero
below 4.5:1 body / 3:1 UI. Failures get fixed by lifting the token, never by
enlarging type until the threshold moves.

The ion colours needed splitting to pass. `--na` and `--k` are tuned for a dark
background; used as ink on cream they measure 1.7:1 and 3.5:1, and 1.7:1 for a
focus ring is an accessibility failure rather than a stylistic one. So the
interface uses `--signal` and `--violet`, which carry a ground-aware pair each.
The membrane keeps its colours.

## The photograph

`public/headshot.jpeg`. `.jpg`, `.jpeg`, `.png` and `.webp` all resolve —
`src/ui/portrait.ts` walks the list — and the path is relative to the page, so
it works under the Pages base path with no code change. Without it the plate
shows its `PLATE PENDING` state, which is deliberate rather than broken. On load
the portrait is also rendered as a Sobel surface-potential map that cross-fades
on hover.

## Deployment

Pushing to the working branch runs `.github/workflows/deploy.yml`, which
typechecks, builds and publishes `dist/` to GitHub Pages.

One-time setup on the repo: make it public, then **Settings → Pages → Source:
GitHub Actions**.

Vite's `base` is `/personal_site/`. Moving to a root domain later is one line in
`vite.config.ts` — or set `SITE_BASE=/` in the build environment.
