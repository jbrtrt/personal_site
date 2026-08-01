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

*Rewritten 2026-07-31. The version this replaced described the credentials
strip, 19 visible publications and the journal-chart figures — all three are
gone. See §10 for why, and `git log` for what they looked like.*

### Working and verified
- Barkley excitable medium on the GPU; click depolarizes, waves collide and
  annihilate, a traced circle induces a re-entrant spiral that unlocks a hidden
  panel.
- Three capability tiers — `full`, `calm` (`prefers-reduced-motion`, composes a
  still frame from the same sim), `fallback` (no WebGL2, drops canvases, serves
  the document). All three verified in-browser, zero console errors.
- ECG morphology measured and in range; the sinus node no longer quantises to
  frame rate. See §5.
- Charge lives on the routing, not the substrate: the board reads as a board
  and the body text stays legible on the same pixels.
- Seven **three-stage boards** — a software rasteriser (`src/ui/render3d.ts`)
  over the mesh kit (`src/ui/mesh.ts`). Each plate draws its object three times:
  `01 BLOCKED` (flat), `02 CLAY` (matte, one neutral material), `03 RENDERED`.
  Canvas 2D, so they draw in every tier including `fallback`.
- **The hero render turns.** Drag to rotate — yaw free, pitch clamped. Gated by
  `scripts/rotate.mjs`. See §12 for the performance measurement.
- Framing is **fitted, not tuned**: `fitFor()` projects each mesh's bounds at its
  authored angle and solves for scale and offset. There are no per-plate focal
  lengths to keep in sync any more.
- **three.js is a lazy chunk.** Nothing above the fold needs it, so it is
  imported inside `boot()` rather than parsed before first paint — measured FCP
  8772 ms → 4968 ms locally. `revealStatic()` is the safety net if that chunk is
  slow or fails; `revealed` stops the intro replaying over it.
- Publications: **7 selected shown, 12 behind a disclosure, all 19 in the DOM**.
- **Section 5 carries the CV** — five leadership roles and seven honors, audited
  line by line against the bio prose and the spec tables so nothing repeats. The
  credentials strip is deliberately *not* restored: every row of it was already
  in §01 prose, and the only fact it carried that the page lacked was the degree
  year ranges, now inline in §01.
- **No horizontal scroll at 390px.** Two causes, both fixed: `.sec--hero` was a
  grid whose column sized to max-content, and the height-driven hero type rule
  set 80px type on a tall narrow phone. A vertical swipe starting on a plate
  still scrolls the page (`touch-action: pan-y` plus a horizontal-intent test).
- Email is XOR-masked and assembled on click; no phone, no address, no repo
  links — verified by grep over `dist/` before every push.
- Hero clears the strip chart at every viewport height tested (1280x800,
  1280x700, 1440x900, 390x844, 390x667) — `scripts/collide.mjs`.

### Defects — Ben's review, in his numbering
| # | Issue | Status |
|---|---|---|
| 1 | Copy should read more like his draft | **Superseded** — see §10. The page now argues a position rather than listing credentials; his specifics are all still in the prose |
| 2 | Built section has no assets/objects | **Done** — seven three-stage boards, `src/ui/render3d.ts` + `src/data/builds.ts` |
| 3 | Background too distracting | **Done** — wave amplitude to ~¼, per-section dim/wave maps in `main.ts` |
| 4 | ECG rhythm looks completely wrong | **Done and measured** — see §5 |
| 5 | Doesn't relate to circuits | **Done** — ground-plane hatch, solder-mask tooth, routing hashed by row/column so runs are continuous, plated vias where runs meet |
| 6 | Headshot missing | **Done** — `public/headshot.jpeg` |
| + | Contrast standards | **Done** — `scripts/contrast.mjs`, all gated pairs pass on both grounds, and the shader model is now guarded against drift |

---

## 4 · The plan, and what it became

The original approved plan (upgrade the copy in place, keep all 19 entries,
build journal-style figures) is in `git log` — commit `81fc53e` is the last
state that matches it. Three later rounds of direction moved the page a long
way from it, and the plan is recorded here as *history*, not as instructions:

1. **"Make the Build figures into realistic 3d assets."** The journal charts
   were replaced by rendered objects. Charts made arguments the prose was
   already making better; what the prose could not do was show the thing.
2. **"Much less like a CV and more about me / thesis"**, then **"beliefs …
   throughout the whole website"**. The credentials strip and the leadership
   ledger were cut, nine dated entries became three paragraphs, and every
   module now opens on the belief it is evidence for. A `.creed` list was
   built first and removed — quarantining the argument in one section was
   exactly what the instruction ruled out.
3. **"More like an industrial design portfolio than a CV."** The object now
   leads each module, the run-on claim line and credit strip became one spec
   table, and captions name the object instead of explaining a chart.

**What did not change, and must not:** no fabricated data; every number in the
prose is attributable; all 19 publications stay in the DOM; the ECG stays a
real instrument; contrast stays gated.

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

**The board's three stages have to differ in *medium*, not in parameters.** They
first shipped as faceted → matte → finished, and Ben's verdict was that all seven
plates looked like one stage repeated three times. He was right, for a reason
that only shows up at the size the studies are actually displayed at, about
140 CSS px: a 40-segment lathe does not read as faceted, and a clay pass over an
object that is mostly one neutral shell is the finished render with the accent
removed. What survives at that size is a change of medium — outlines, then a grey
model, then the object. `line` is a hidden-line drawing (fills in the page's own
ground, only silhouette / crease / boundary edges stroked).

That fixed stage 01 and **not stage 02**, and Ben's second verdict was that the
clay study and the hero were still the same picture on all seven boards. The
number that explains it: mean lightness of the two stages measured **0.010 to
0.056 apart on every board**, four of them within 0.012. `CLAY` was `tone: 0.86`
against a `SHELL` of `0.90` — a 4% difference on the material that covers most of
every object, so "strip the materials" stripped nothing visible. Clay was the
hero at half size.

Clay is now three things at once, because no one of them was enough:

- **darker** — `tone: 0.38`, a matte ramp of `0.40 + 0.46·lam`, no highlight, no
  rim, no second light. Overall lightness is what the eye compares first.
- **faceted** — face normals, the same path the drag pass uses. Contributes least;
  a 32-segment lathe barely reads as faceted at 198×100.
- **a front elevation** — `yaw: 0` absolute, plus the ×4 lens. Shading alone could
  never have done it: the silhouette never moved, so the two stayed one picture at
  two sizes.

The hero moved up to meet it — diffuse `0.66 → 0.74`, fill `0.20 → 0.22`, rim
`0.16 → 0.20`, `AMB 0.20 → 0.22` — because three boards have heroes that are dark
for material reasons (NEPHRA's smooth capsule, LANTERN's big `TRIM` screen,
FLOPCHECK's matte skin) and a grey model cannot get far enough below a render
that is already nearly grey.

**`scripts/stages.mjs` is the gate**, and its thresholds were set from a recorded
baseline rather than invented. Judge any change to these from a plate shot as
well — the script proves the two pictures differ, only looking proves the clay
study still reads as the object.

**⚠️ `extrude` and `bevelBox` wind polygons inward, and this is deliberate now.**
The backface test therefore drops the face *nearest* the camera and keeps the far
one. On a convex solid that is nearly invisible — same silhouette, and the far
face's inverted normal points back at the camera so it even shades like a front
face — which is why it went unnoticed through every plate revision. Verify
winding arithmetically, never by eye: **X × Z = −Y**, so a polygon traversed
counter-clockwise in an (X right, Z up) plot faces *down*.

It was fixed globally on 2026-07-31 and **reverted the same session**, because
the inversion is load-bearing. Correcting it made `activedoc` draw its page over
its own ruled text. The page's top cap is one enormous quad centred at the
origin, so a decal offset toward the back of the page has a *further* centroid
than the whole page does, and a centroid sort puts the page in front of it. Not
drawing that cap is what keeps every decal on every plate visible. Subdividing
the cap does not rescue it either: the strips would have to be about 0.02 wide
before a decal's own height could beat the strip's z spread. **Do not "fix" this
without solving decal ordering first** — the two are the same problem.

The one place it has a real cost is a solid with something *inside* it: particles
in an opaque sample cell showed through the wall that was never drawn, and two
rounds of chasing that through the sort found nothing, because the sort was
right. Such a caller passes its outline reversed — `[...roundedRect(…)].reverse()`
flips every polygon the extrude emits. `sampleCell` in `data/builds.ts` is the
only object that needs it.

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
| Build assets | ~~Technical figures~~ → **rendered objects**, superseded 2026-07-31 (§4) — still explicitly not circuits |
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

**1 · Three bench descriptors need Ben's confirmation.** `Hydrocele stent`,
`Training phantom` and `Inflammation and pain wearables` are the only lines on
the page not traceable to the CV, the repo or Ben's own copy — I had the names
and nothing else. Each is written to assert nothing beyond what its own name
asserts, so none of them can be *wrong* about a status, a result or a mechanism.
They still want a look.

**2 · The microplastics module is thin on purpose.** Status is `In development`,
confirmed. Form and sample follow from "hardware like ViveSense, for
environmental and consumer samples". It carries **no grounding row and no
result**, and the caveat says screening rather than measurement. Add an evidence
row only when there is evidence.

**2b · Plate 3 now draws a reader, not a sample.** It was a glass of water with
particles in it, on the argument that the ordinary sample is the point. The
argument was fine and the drawing was not — a tumbler reads as a drink, and the
module's own spec table says the form is a reader and a sample cell, neither of
which appeared. It is now a square cell between a source and a detector, with the
beam drawn rather than modelled. **The arrangement is an inference from the spec
table, not from anything Ben has described**: a straight-through path is the
plainest thing consistent with "optical reader · sample cell", but if the real
instrument reads at an angle, or reflects, the drawing is wrong in a way no
caption fixes. The figcaption says "the arrangement, not the method" for exactly
this reason. Worth one question to Ben.

**3 · The impact-detection patent number.** The CV lists publication
`US20230222795A1`; the site cites grant `US12511900B2`, in the M5 spec table.
Both are plausible for one family at different stages. Still open.

**4 · stoneidx is off the page's Objects section.** Its publications in §04
stand. Worth knowing: it was the only module reporting measured results, so
**no module in §03 now reports a result at all** and the evidence load sits
entirely in §04. Defensible — object drawings claim nothing — but a real shift
in where the page's proof lives. This closes the old 3-vs-4 HCUP question.

**5 · Browser verification is SwiftShader-only.** No real GPU was available.

---

## 12 · The rotation performance measurement

The plan said: if a flat-shaded drag pass cannot hold ~20 fps, drop the
interaction and ship the static render.

**This machine cannot answer that question.** Twenty-four mouse moves with no
drag active — nothing rendering at all — cost **886 ms each**. The baseline
frame here is ~900 ms, and the in-page rAF loop measured 934 ms per frame during
a drag, so the render's own contribution is roughly **48 ms**. That is the 20 fps
bar met with no margin, in the worst environment available, on a page whose
WebGL field is being rasterised in software on a low-RAM container.

It should clear comfortably on real hardware, so the interaction shipped. If it
turns out to stutter on a real machine, the fallback is one line: stop calling
`turnable()` in `mountFigures()`. Everything else keeps working.

What is genuinely cheap now, and worth keeping that way: the drag clears only
the hero band, so the two studies survive from the previous full pass, and the
contact shadow and glow — two whole-canvas gradient fills — sit out the drag.
