# Handoff — Benjamin Greenfield personal site

Written 2026-07-31. Everything needed to pick this up cold.

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

### Open defects — Ben's review, in his numbering
| # | Issue | Status |
|---|---|---|
| 1 | Copy should read more like his draft | **Not started** |
| 2 | Built section has no assets/objects | **Not started** |
| 3 | Background too distracting | **Not started** — he chose *quiet everywhere, including hero* |
| 4 | ECG rhythm looks completely wrong | **In progress** — see §5 |
| 5 | Doesn't relate to circuits | **Not started** — fix in the background substrate only |
| 6 | Headshot missing | **Blocked** — see §7 |
| + | Contrast standards | **Not started** |

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

### The approach
`src/ecg/waveform.ts` (**written, not yet wired in**) synthesizes morphology as a
sum of Gaussians — standard McSharry construction — while beats stay driven by
simulation events: pacemaker fires → sinus beat; user depolarizes the tissue →
**PVC** (no P, wide bizarre QRS, discordant T, compensatory pause). Clicking
therefore produces a premature ventricular contraction Ben will recognise on
sight, and the strip still reports what the page is doing.

`Rhythm` also enforces a 260 ms refractory period, so a stimulus landing in the
tail of the previous beat captures nothing — as in real muscle.

### ⚠️ Measured intervals say it is NOT ready
Run `node scripts/ecg-intervals.mjs`. Current output:

```
sinus:  P dur  70 ms   PR 186 ms   QRS 149 ms   QT 262 ms   R 1.01 mV   T concordant
PVC:                               QRS 180 ms   QT 428 ms   R 1.14 mV   T discordant
reference:  P <120   PR 120–200   QRS <120   QT 350–450
```

**Two real problems in the sinus beat:**

1. **QRS measures 149 ms — should be under 120.** The T wavelet (`w: 46`,
   centred 330 ms) has Gaussian tails reaching back to ~146 ms, so the trace
   never returns to baseline between S and T. There is no isoelectric ST
   segment, and the QRS/T blur into one blob. A wide QRS in a *sinus* beat is
   exactly the kind of thing Ben would catch.
2. **QT measures 262 ms — should be 350–450.** The T tail drops under the
   detection threshold too early; T needs to be later and broader.

**Suggested fix (untested):** narrow S (`w: 11 → 8`), push T out to ~360 ms and
reshape so ST is genuinely isoelectric — possibly a skew/half-Gaussian for T
rather than a symmetric one, since real T waves are asymmetric with a slower
upstroke than downstroke. Re-run the interval script until sinus reads
QRS < 120 and QT 350–450, and only then wire it into `Trace.ts`.

Note the PVC numbers are already plausible: wide QRS at 180 ms and a discordant
T are both correct for a PVC.

### Wiring still to do
- Rewrite `src/ecg/Trace.ts` to sample `Rhythm` instead of pushing d*S*/d*t*.
- `Field` currently owns a GPU reduction chain (`reduce.frag.glsl`,
  `reduceLead()`, `readRenderTargetPixels`) that exists only to produce the old
  trace. Once `Trace` no longer consumes it, **delete it** — it is a per-frame
  GPU sync stall for nothing. Also drop `uGain`/`uE1`/`uE2`.
- `Field.paceEvery` (currently 1000 ms) should drive `Rhythm.schedule('sinus')`;
  `Pointer` stimuli should drive `schedule('pvc')`.

### Honesty debt — must be paid
`README.md` and commit `28b6d94` both claim the trace is a lead integral and
"not a drawing". After this change that is an overclaim. Reword both the README
section and the footer line in `index.html`, which currently reads *"The trace is
its lead integral, not a drawing."*

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

## 7 · The headshot — blocked, and why

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

---

## 8 · File map

```
index.html              all copy — page is readable with JS disabled
src/
  main.ts               boot, capability tiering, scroll choreography, one clock
  core/
    capability.ts       WebGL2 / reduced-motion probe → full | calm | fallback
    pointer.ts          pointer state + signed-turning-angle spiral detection
  webgl/field/
    Field.ts            ping-pong GPGPU sim, pacemaker, perf governor
    sim.frag.glsl       Barkley model, explicit Euler, zero-flux boundaries
    render.frag.glsl    both grounds + the blackout morph between them
    reduce.frag.glsl    lead integral — DELETE once Trace stops using it
  ecg/
    waveform.ts         NEW: sinus + PVC morphology, Rhythm scheduler
    Trace.ts            strip chart, calibration pulse — needs rewrite
  ui/                   email (XOR-masked), portrait, list rendering
  data/publications.ts  19 entries
  styles/               tokens → base → type → sections
scripts/                verification scripts (see §9)
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
node scripts/ecg-intervals.mjs     # ECG morphology vs reference ranges
node scripts/barkley-tune.mjs      # wave propagation / annihilation / spiral
node scripts/contrast.mjs          # WCAG audit (to be written)
node scripts/drive.mjs             # full browser pass, screenshots, console errors
node scripts/tiers.mjs             # reduced-motion + no-WebGL tiers
```

Browser scripts need a dev server up and Playwright imported by absolute path:

```js
import pkg from 'file:///opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
         '--no-sandbox','--disable-dev-shm-usage'],
});
```

`window.__bg` is exposed in dev only — `probe()` returns lead, dLead, board and
the trace detector's internals. Useful for driving the page deterministically.

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
