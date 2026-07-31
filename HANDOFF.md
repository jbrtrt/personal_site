# Handoff — Benjamin Greenfield personal site

Written 2026-07-31, **updated 2026-07-31 after executing the plan in §4**.
Everything needed to pick this up cold.

> **Status:** all seven of Ben's review items are addressed and verified. §3 and
> §5 below record what changed. The one thing still genuinely open is the
> per-cohort data for Fig. 3 — see §11.

---

## 1 · What this is

A single-page site for Benjamin Greenfield — MD candidate at Tufts, Columbia
biomedical engineer, founder. **Thesis (do not change): physician-engineer, and
the spine is that Hodgkin–Huxley models a living membrane as literally an
electrical circuit.** One signal moves through three registers — field (tissue),
trace (ECG), circuit (current) — and the page inverts between two grounds: ECG
chart paper for the physician, dark PCB for the engineer.

Ben confirmed twice: **do not rewrite the copy wholesale and do not change the
thesis.** His long copy block is guidance on *tone and specificity*, not a
replacement deck.

## 2 · Run and deploy

```bash
npm install
npm run dev          # → http://localhost:5173/personal_site/
npm run build        # typecheck-gated static build → dist/
npm run preview      # production bundle on :4173
```

Live: **https://jbrtrt.github.io/personal_site/**
Repo is public. Branch `claude/professional-portfolio-site-6x2q4u` is the
**default branch** — the repo had no commits when this started, so there is no
`main` and no PR to open (a PR from the default branch into itself is rejected).

Deploy is `.github/workflows/deploy.yml` on push. Node 22.

---

## 3 · Current state

### Working and verified
- Barkley excitable medium on the GPU; click depolarizes, waves collide and
  annihilate, a traced circle induces a re-entrant spiral that unlocks a hidden
  panel in the Ledger section.
- Three capability tiers — `full`, `calm` (`prefers-reduced-motion`, composes a
  still frame from the same sim), `fallback` (no WebGL2, drops canvases, serves
  the document). All three verified in-browser, zero console errors.
- 19 publications render; email is XOR-masked and assembled on click; no phone,
  no address, no repo links, verified by grep over `dist/`.
- Responsive at 1440 / 1024 / 390.

### Defects — Ben's review, in his numbering
| # | Issue | Status |
|---|---|---|
| 1 | Copy should read more like his draft | **Done** — credentials strip, Regeneron and Einstein beats, ViveSense sharpened and added to the Ledger, every module now leads with its verification claim, contact heading replaced |
| 2 | Built section has no assets/objects | **Done** — seven journal figures, `src/ui/figure.ts` + `src/data/builds.ts` |
| 3 | Background too distracting | **Done** — wave amplitude to ~¼ in the shader, hero dim 1 → 0.85 |
| 4 | ECG rhythm looks completely wrong | **Done and measured** — see §5 |
| 5 | Doesn't relate to circuits | **Done** — ground-plane hatch, solder-mask tooth, etched routing, plated vias with annular rings; board sections lifted so the substrate reads |
| 6 | Headshot missing | **Done** — `public/headshot.jpeg` |
| + | Contrast standards | **Done** — `scripts/contrast.mjs`, all gated pairs pass on both grounds |

---

## 4 · Approved plan

**1 · Copy — upgrade in place.** Same sections, headings, order. Sharper bio
using his specifics (sodium-channel variants at Regeneron, neuropeptides and
striatal cells at Einstein, four years as ViveSense CEO), closing on *"I run
tests before I trust a result, in the lab or in a repo."* Add a credentials
strip. Add ViveSense as a 2020–2024 Founder & CEO entry in the Ledger. Contact
heading → *"Working on something in medicine or software? Say so."*

**Built keeps its current seven** — ViveSense, NEPHRA ONE, stoneidx, Ocula
Health, flopcheck, Lantern, notes2anki. Prose only. EchoBack and
patent-strategy-os stay in the register line. Each module leads with its real
verification claim:

| Module | Claim |
|---|---|
| ViveSense | patented at-home test · NSF SBIR Phase I · I-Corps · 40+ interviews |
| NEPHRA ONE | descendant of the ambulatory hemofiltration work; investigational |
| stoneidx | Charlson/Elixhauser miscalibrated where stones are rare; 4.1M encounters, three HCUP databases, pooled AUC 0.713 across 19 cohorts |
| Ocula Health | summaries travel, raw life stays home — consent-gated by architecture |
| flopcheck | extends US12511900B2; stress test shows monocular pose inventing metres of phantom depth, triangulation fixing it to millimetres |
| Lantern | deterministic safety layer independent of the LLM on every utterance; 374 tests; the log names the unfinished escalation rung |
| notes2anki | reads formatting as meaning; graded on comprehension and Bloom level; 196 offline tests; A/B across two judges (n=17) |

Research section stays at all 19 entries — cutting to a curated eight is the kind
of rewrite he ruled out.

**2 · Build assets — technical figures, explicitly NOT circuits.** He was
specific: the Build assets must be *completely unrelated to the electrical/circuit
theme*. Register is **journal figures** — axes, ticks, units, numbered caption,
nothing glowing, nothing carrying current.

| Module | Figure |
|---|---|
| ViveSense | agreement plot vs reference method, limits of agreement |
| NEPHRA ONE | solute clearance over time — continuous vs three sessions a week |
| stoneidx | forest plot, 19 cohorts, pooled AUC 0.713 marked |
| Ocula Health | 8,758 hours as a year-bar: what leaves, what stays home |
| flopcheck | pose skeleton with impulse vectors and feasible-envelope band |
| Lantern | escalation ladder over time, deterministic gate on every utterance |
| notes2anki | A/B bake-off — two judges, n=17, win rates |

Canvas 2D, one data-driven renderer + a spec per figure. `IntersectionObserver`
so only visible ones draw; static under reduced motion; `aria-hidden` because
every number is already in the adjacent prose.
New: `src/ui/figure.ts`, `src/data/builds.ts`.

**3 · Quiet the background.** Everywhere, hero included. Wave amplitude to
roughly a quarter, slower, wider pacemaker interval so fewer waves are alive.
Raise PCB substrate presence at low contrast — etched texture, not plasma. That
is also the whole of the fix for #5; the circuit language lives in the substrate
and nowhere else.

**Contrast.** Script it, don't eyeball it. WCAG 2.1 ratios for every fg/bg pair
in use, on both grounds, against 4.5:1 body / 3:1 large + UI. Fix by lifting
token values, not by enlarging type to dodge the threshold. Keep the script in
the repo. New: `scripts/contrast.mjs`.

---

## 5 · ECG — diagnosis, work done, and what is still wrong

### Why it looked wrong
The trace plotted d*S*/d*t* of a lead integral over the 2D excitable sheet. That
is honest and **structurally incapable of producing an ECG**: a flat isotropic
sheet has no atria, no AV node, no His–Purkinje system, so P, PR, QRS and T have
no mechanism to exist. It can only be a squiggle. Ben reads rhythm strips; it
read as broken because it was.

### The approach — now shipped
`src/ecg/waveform.ts` synthesizes morphology as a sum of Gaussians — standard
McSharry construction — while beats stay driven by simulation events: pacemaker
fires → sinus beat; user depolarizes the tissue → **PVC** (no P, wide bizarre
QRS, discordant T). Clicking produces a premature ventricular contraction Ben
will recognise on sight, and the strip still reports what the page is doing.

### ✅ Measured intervals — all within reference
`node scripts/ecg-intervals.mjs` now **parses the wavelet tables out of
`waveform.ts`** rather than keeping its own copy, finds fiducial points from the
waveform instead of from fixed windows, and **exits non-zero** out of range. It
runs in CI via `npm run verify`.

```
sinus  P 92   PR 155   QRS  85   QT 383   ST isoelectric 127 ms   R 1.04 mV   T concordant
pvc    P —    PR —     QRS 168   QT 427                          R 1.23 mV   T discordant
```

The two failures in the previous version are both fixed by the same change: the
T wave is now **asymmetric** (`w` on the rise, `w2` on the fall), which is what
real T waves do, and it is what lets QT reach 383 ms without the leading tail
dragging back into the ST segment and fusing the QRS and T into one blob. The
old window-based measurement was also lying — it reported "QRS 149 ms" when the
truth was "there is no J point at all".

The whole complex is offset to positive time so a wavelet centred at 0 does not
have half its area clipped by the beat's own start.

### Refractoriness and the compensatory pause
`Rhythm` enforces a **300 ms ventricular ERP**. That one constant now produces
the compensatory pause for free, because the sinus node keeps its own clock and
is never reset: a PVC late in the cycle leaves the ventricle refractory when the
next sinus impulse arrives, so that beat is dropped and the following one lands
a full cycle later. A PVC early in the cycle is interpolated and nothing is
dropped. Holding the pointer down paces the ventricle into a run of wide
complexes that stops on release.

### Wiring — done
- `Trace` samples `Rhythm` at a fixed 200 Hz on wall-clock. Because the waveform
  is analytic it is evaluated at exactly the instants owed, so the interpolation
  hack in `main.ts` is gone: a slow machine gets a correctly *sampled* trace
  rather than an interpolated one.
- The strip is now **dimensionally correct** — 25 mm/s, 5 mm/mV (half standard,
  a real labelled setting), calibration pulse a true 200 ms × 1 mV, and one
  millimetre is the same millimetre the field shader rules behind it.
- The GPU reduction chain is **deleted**: `reduce.frag.glsl`, `reduceLead()`,
  `readRenderTargetPixels`, `rA/rB/rC`, `uGain`/`uE1`/`uE2` and the
  `measure` parameter on `step()`. That removes a per-frame GPU sync stall.
- The R-peak detector is gone too. The rate now comes from `Rhythm.rate()` —
  the record of beats that actually captured. Peak-picking a waveform we
  synthesized would only have been measuring our own arithmetic back.
- `Field.onPace` → `schedule('sinus')`; `Pointer.onStimulus` → `schedule('pvc')`.
  `onStimulus` fires only for *reader* input; the scroll choreography's nudges
  go through `fire()` and are deliberately not reported as heartbeats.

### ⚠️ The sinus node no longer drifts with frame rate
`paceAt` advances by whole intervals instead of resetting to the current frame's
timestamp. Resetting quantised the interval up by one frame per beat, so a 5 fps
software rasteriser reported **35 bpm for a pacemaker set to 60** — the rate was
a property of the GPU, which is the exact failure the substep scaling exists to
avoid. Verified at 60 bpm under SwiftShader across repeated runs.

If a frame is longer than 4× the interval the node resyncs rather than replaying
the backlog — **but still fires**. Dropping the beat there means a device whose
every frame exceeds the interval never gets a rhythm at all.

### Honesty debt — paid
The README section is rewritten and the footer line in `index.html` now reads
that the morphology is synthesized and says *why* a flat sheet cannot produce a
P wave. The footer also called the sim FitzHugh–Nagumo; it is Barkley, and that
is corrected.

---

## 6 · Traps — things that cost time already

**Ben has a house style, and it is off-limits.** `nephra`, `sono`, `jaw-gum`,
`lantern-site`, `ocula` and `vivesense-site` all share: Vite + three.js + GSAP +
Lenis, custom cursor, magnetic buttons, char-split / `reveal-line` hero,
counting preloader, particle constellations. Fraunces is the display face in
three of them. **Do not use any of those** — reusing them makes this a sixth
entry in the same series, which is the failure mode the brief exists to avoid.
Current type is Bodoni Moda / Archivo / IBM Plex Mono, none of which he has used.

**GitHub Pages: two builders can race.** Pages was on "Deploy from a branch",
which arms GitHub's legacy `pages build and deployment` on every push. That
publishes the **raw repo root**, whose `index.html` points at `/src/main.ts` —
TypeScript the browser cannot execute — over the top of the correct `dist/`.
It finished 24 s after the real deploy and broke the site. Ben switched Pages to
**GitHub Actions**, and `configure-pages` now runs with `enablement: true` so the
workflow re-asserts it. **Check after any deploy: only `Deploy to GitHub Pages`
should appear in the run list.**

**Barkley parameters are load-bearing.** The first set extinguished the wave
entirely (peak 0, zero excited cells). Current values `a 0.75, b 0.02, ε 0.04,
dt 0.04, D 1.0, 8 substeps` were chosen by solving the same equations on the CPU
and measuring propagation, collision annihilation and spiral persistence. Do not
tune them by eye — use `scripts/barkley-tune.mjs`. The degrade path deliberately
never drops below 5 substeps: a cheaper frame that kills the wave is not cheaper.

**Pointer events must bind to `window`, not the canvas.** `main` sits above
`#field` in the stacking order, so a listener on the canvas hears almost nothing.
Interactive elements are excluded via a `closest('a, button, …')` check.

**The sim advances on wall-clock, not per frame.** Substeps scale with frame
time, bounded [0.5×, 2.5×], so wave speed and reported rate are not functions of
the GPU. Headless SwiftShader runs at ~5 fps, so screenshots there are of a
degraded run — never tune visuals from a headless capture alone.

**This sandbox cannot reach the live site.** The agent proxy 403s both
`github.io` and `api.github.com`. Deployment success can only be confirmed
through the GitHub MCP tools; the rendered page has to be confirmed by Ben.

---

## 7 · The headshot — resolved

Shipped at `public/headshot.jpeg`, and confirmed loading in-browser (the plate
no longer carries `data-empty`).

The previous session was blocked because the photo only ever arrived as an
inline chat image, which is visible in conversation but never written to disk in
that container. It turned out to be sitting on Ben's own machine at
`~/1689004036021.jpeg` — the exact filename he had quoted — so the next session,
running with access to his home directory, could simply copy it in. **Lesson for
next time: check the working machine's filesystem for a file the user has named
before concluding an asset is unreachable.**

`.jpg`, `.jpeg`, `.png` and `.webp` all still resolve (`src/ui/portrait.ts`
walks the list), so replacing it is a drag-and-drop with no code change.

<details>
<summary>Original diagnosis, kept for the record</summary>

Ben has attached the photo three times. It arrives as an **inline chat image**,
which is visible in conversation but never written to disk in this container, so
there are no bytes to embed. `/root/.claude/uploads/` holds only the CV, the
scoping doc and the Residency application. Google Drive search was declined. His
path `My files/Downloads/1689004036021.jpeg` is his own machine.

**The only route that works:**

> repo → **Add file → Upload files** → drop the image → set path to
> `public/headshot.jpeg` → commit to the branch

`.jpg`, `.jpeg`, `.png`, `.webp` all resolve — `src/ui/portrait.ts` walks the
list. Deploy is automatic. Until then the frame shows `PLATE PENDING`, which is a
designed state, not a broken image. On load the portrait is also rendered as a
Sobel "surface potential" map that cross-fades on hover.

</details>

---

## 8 · File map

```
index.html              all copy — page is readable with JS disabled
public/headshot.jpeg    the plate
src/
  main.ts               boot, capability tiering, scroll choreography, one clock
  core/
    capability.ts       WebGL2 / reduced-motion probe → full | calm | fallback
    pointer.ts          pointer state, spiral detection, onStimulus → PVC
  webgl/field/
    Field.ts            ping-pong GPGPU sim, sinus node, perf governor
    sim.frag.glsl       Barkley model, explicit Euler, zero-flux boundaries
    render.frag.glsl    both grounds, etched substrate, the blackout morph
  ecg/
    waveform.ts         sinus + PVC morphology, Rhythm, 300 ms ERP
    Trace.ts            strip chart, calibrated 25 mm/s · 5 mm/mV
  ui/
    email.ts            XOR-masked, assembled on click
    portrait.ts         candidate walk + Sobel surface-potential map
    figure.ts           the seven build figures, IntersectionObserver-gated
    render.ts           publication list
  data/
    publications.ts     19 entries
    builds.ts           figure specs + the urea kinetics behind Fig. 2
  styles/               tokens → base → type → sections
scripts/                verification (see §9)
```

**Design note worth preserving:** the paper→board transition routes through a
**blackout**, not a cross-fade. Mixing cream and near-black linearly spends its
midpoint as flat grey, and that midpoint lands exactly on the thesis section.
Routing through black means the paper falls away leaving only the bare wavefront,
then the circuit materialises around it. It is the best frame in the sequence;
don't "simplify" it back to a cross-fade.

---

## 9 · Verification recipes

```bash
npm run verify                     # ← the CI gate: ECG intervals + WCAG contrast
node scripts/ecg-intervals.mjs     # parses waveform.ts; exits non-zero out of range
node scripts/contrast.mjs          # WCAG 2.1, both grounds; exits non-zero on fail
node scripts/barkley-tune.mjs      # wave propagation / annihilation / spiral

npm run dev                        # browser passes need a server up
npm run check                      # ← run this before a push
npm run tiers                      # reduced-motion + no-WebGL tiers
npm run drive                      # full pass with screenshots into .shots/
```

Playwright is now a **devDependency**, so it resolves from `node_modules` and
the browser is whatever `npx playwright install chromium` put in place — no more
absolute paths into a container that no longer exists. All browser scripts
accept `SITE_URL` so they can be pointed at `npm run preview` on :4173 to test
the production bundle rather than dev.

`npm run check` is the one that matters before a push: it confirms the shader
programs linked and the GL context is error-free, the rate reads 60 bpm, a click
writes an ectopic beat, all seven figures painted, the portrait loaded, and the
console is clean. It deliberately takes **no screenshots** — on a software
rasteriser they dominate the runtime and `page.screenshot()` will simply time
out on a page with a continuously animating canvas.

`window.__bg` is exposed in dev only — `probe()` returns board, dim, buffer
fill, bpm, beat count and the last sampled mV. The scripts degrade gracefully
when it is absent so they also work against a production build.

**Before every push:** `npm run build`, then grep `dist/` for the phone number,
`Folsom`, `jgreen40`, `tufts.edu`, and `github.com/jbrtrt`. All must be absent —
the address is assembled at runtime and must never appear in the bundle.

---

## 10 · Decisions already made — don't relitigate

| Question | Answer |
|---|---|
| Art direction | Threshold × ECG × Circuit (his combination) |
| Contrarian femtech/men's-health thesis | **Excluded** — he declined it |
| Lantern | Included; his own copy says "one real patient", no identifying detail |
| Contact email | `jgreen40@tufts.edu`, XOR-masked, click to reveal then copy |
| Built lineup | The current seven; EchoBack + patent-strategy-os stay in the register |
| Background | Quiet everywhere, hero included |
| Build assets | Technical figures — explicitly not circuits |
| Repo visual assets | Permitted, but art direction must be original |
| Hosting | Public repo, Pages via GitHub Actions |

### ⚠️ Two of these were overridden on 2026-07-31

Recorded here so a later session does not read them as drift and "restore"
them. Both were raised as conflicts *before* the work, and confirmed:

| Was | Now | Why |
|---|---|---|
| Do not rewrite the copy wholesale | The page is restructured around stated beliefs | Asked for directly: "make this website much less like a CV and more about me / thesis", clarified as "personal beliefs", "throughout the whole website" |
| Research stays at all 19 entries; curating to eight is the rewrite he ruled out | 7 selected shown, 12 behind a disclosure | Chosen explicitly after the conflict was put in writing |

**Nothing was deleted.** All 19 publications are still rendered into the DOM
and reachable in one click, so the full record remains present and indexable.
The credentials strip, the leadership ledger and most of the honors line were
removed — every fact the credentials strip carried is now in the biography
prose, so no fact was lost with it.

---

## 11 · Open — what the next session should pick up

**1 · Fig. 3 needs the 19 per-cohort AUCs.** This is the only genuinely
outstanding item. `src/data/builds.ts` → `stoneidx.spec.cohorts` is an empty
array, and the renderer draws the rows the moment it is populated with
`{ label, est, lo, hi }` entries. It was left empty on purpose: a forest plot of
19 invented cohorts, on the site of someone whose closing line is *"I run tests
before I trust a result"*, is the single most expensive thing that could have
been put on the page. The caption says so out loud.

The same principle governs Figs. 1, 5 and 6, which are stamped **SCHEMATIC**
because they draw a criterion, a method and an architecture rather than
observations. Fig. 2 is integrated single-pool urea kinetics — real arithmetic,
recomputed at module load. Fig. 4 is a year, to scale.

**2 · Two numbers Ben should confirm.**
- The §4 plan said stoneidx used *three* HCUP databases; the module's meta line
  names *four* (NIS / NEDS / NASS / NRD). The meta line was left as-is because
  it is more specific and was already reviewed. One of the two is wrong.
- The CV lists the impact-detection patent as publication `US20230222795A1`,
  while the site cites grant `US12511900B2`. Both are plausible for the same
  family at different stages; worth a glance.

**3 · Only the ECG rate was held at 60 bpm.** The §4 plan asked for a *wider*
pacemaker interval to reduce how many waves are alive at once. That conflicts
directly with defect #4: 1000 ms **is** 60 bpm, the floor of normal sinus
rhythm, and anything wider reads as sinus bradycardia to the person who raised
the ECG complaint in the first place. The interval stayed at 1000 ms, and the
"fewer waves" half was delivered through amplitude, stimulus radius and dim
instead. If Ben would rather have the quieter field than a normal rate, that is
his call to make, not one to make for him.

**4 · Browser verification was run under SwiftShader only.** No real GPU was
available. Frame-rate-dependent behaviour is now explicitly tested (the sinus
node holds 60 bpm at ~3–5 fps), but the *look* of the quietened field — whether
a quarter amplitude is too quiet — can only be judged by Ben on real hardware.

**5 · `barkley-tune.mjs` reports `annihilated: no (743 left)` on the collision
case.** Pre-existing; `sim.frag.glsl` and the tuner are untouched by this
session, and the script has no pass/fail gate. Worth a look, but do not tune the
parameters by eye — §6 explains why they are load-bearing.
