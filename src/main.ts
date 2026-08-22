/* Italic is a *cut*, not a slant. The surname in the hero, the emphasis in the
   pull-quote and two smaller runs are all set `font-style: italic`, and none of
   the italic faces were ever imported — so the browser was synthesising them by
   shearing the roman. On a Didone that is the worst case: the stroke contrast is
   the whole face, and an algorithmic slant drags the hairlines off axis. These
   two imports are the designed italics.

   The mono is pulled in latin-only. Every one of these files carries a
   `unicode-range`, so a browser was already declining to fetch the Cyrillic and
   Greek cuts — this drops them from the bundle rather than from the request. */
import '@fontsource-variable/bodoni-moda';
import '@fontsource-variable/bodoni-moda/wght-italic.css';
import '@fontsource-variable/archivo';
import '@fontsource-variable/archivo/standard-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/type.css';
import './styles/sections.css';

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { detect } from './core/capability';
import { Pointer } from './core/pointer';
import type { Field as FieldClass } from './webgl/field/Field';
import { Trace } from './ecg/Trace';
import { Rhythm } from './ecg/waveform';
import { wireEmail } from './ui/email';
import { wirePortrait } from './ui/portrait';
import { renderPublications, stampYear } from './ui/render';
import { mountFigures } from './ui/figure';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const cap = detect();
root.dataset.tier = cap.tier;

/* ── content that does not depend on WebGL ──────────────────── */
renderPublications();
stampYear();
wireEmail();
wirePortrait();
mountFigures();

if (cap.coarsePointer) {
  const key = document.querySelector<HTMLElement>('.chrome__key');
  if (key) key.textContent = 'TAP ANYWHERE';
}

/* Paper tooth. Generated once, as a data URI, so the build stays
   self-contained and there is no texture to fetch. */
(function grain() {
  const N = 180;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = 200 + Math.random() * 55;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  root.style.setProperty('--grain-src', `url(${c.toDataURL('image/png')})`);
})();

const fieldCanvas = document.getElementById('field') as HTMLCanvasElement | null;
const traceCanvas = document.getElementById('trace') as HTMLCanvasElement | null;
const rail = document.querySelector<HTMLElement>('.rail');
const rateEl = document.querySelector<HTMLElement>('[data-rate]');

/**
 * Show the page with no simulation behind it.
 *
 * Used when there is no WebGL at all, and again as the safety net if the
 * simulation chunk is slow or fails to arrive — the hero starts wiped out and
 * transparent, so anything that leaves `boot` unfinished would otherwise leave
 * a reader looking at an empty screen.
 */
/* 60/min — the rate the calm tier composes its strip at. */
const SINUS_MS = 1000;

let revealed = false;
function revealStatic() {
  if (revealed) return;
  revealed = true;
  root.dataset.ground = 'paper';
  gsap.set(['.hero__given', '.hero__family'], { clipPath: 'inset(0 0% 0 0)' });
  gsap.set(['.hero__tag', '.hero__lede', '.chrome--cue'], { opacity: 1 });
  document.querySelectorAll('.bio__p').forEach((b) => b.setAttribute('data-active', '1'));
}

/**
 * The instrument, without the tissue.
 *
 * The strip is a 2D canvas and the stimulus path is `pointerdown` — neither
 * owes anything to WebGL, so losing the GL context is no reason to lose them.
 * Removing the strip alongside the field is what left the rail reporting a
 * rate nothing was measuring and the cue inviting a click that could not land.
 *
 * What is genuinely gone is the excitable medium, and with it the sinus node:
 * pacing came from `field.onPace`. A wall-clock interval stands in for it at
 * the same 60/min the calm tier composes at, so the strip a fallback reader
 * watches is the rhythm every other reader gets, just without the tissue
 * drawing it.
 */
function bootStatic(traceEl: HTMLCanvasElement) {
  const rhythm = new Rhythm();
  const trace = new Trace(traceEl, rhythm);
  const now = performance.now();

  trace.board = 0;

  /* Open mid-rhythm rather than on an empty strip — a reader arriving to a
     flat line reads it as broken, not as waiting. */
  for (let i = 12; i >= 0; i--) rhythm.schedule('sinus', now - i * SINUS_MS);
  trace.compose(now, 12);
  trace.draw();
  traceEl.setAttribute('data-on', '');
  if (rateEl) rateEl.textContent = `${rhythm.rate(now)} bpm`;

  /* Reduced motion gets that composed strip and stops there: a paper speed is
     motion, and the whole point of the setting is not to run it. */
  if (cap.reducedMotion) return;

  const pointer = new Pointer();
  pointer.onStimulus((at) => rhythm.schedule('pvc', at));

  let paced = now;
  let running = true;

  const frame = (t: number) => {
    if (running) {
      /* Catch-up is bounded. A backgrounded tab returns with an arbitrary gap,
         and paying it back beat by beat would fire a burst of complexes that
         never happened. */
      if (t - paced > SINUS_MS * 4) paced = t;
      while (t - paced >= SINUS_MS) {
        paced += SINUS_MS;
        rhythm.schedule('sinus', paced);
      }
      trace.advance(t);
      trace.draw();
      if (rateEl) rateEl.textContent = trace.bpm ? `${trace.bpm} bpm` : '—— bpm';
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    paced = performance.now();
  });

  window.addEventListener('resize', () => { trace.resize(); trace.draw(); });
}

/* ── no WebGL: the document still has to work ───────────────── */
if (cap.tier === 'fallback' || !fieldCanvas || !traceCanvas) {
  fieldCanvas?.remove();
  root.dataset.field = 'off';
  revealStatic();
  if (traceCanvas) bootStatic(traceCanvas);
} else {
  void boot(fieldCanvas, traceCanvas);
}

/* three.js is a third of a megabyte and nothing above the fold needs it, so it
   is fetched as its own chunk rather than parsed before first paint. That puts
   a network round trip between load and the field appearing, which is the
   reason for the timeout below. */
async function boot(fieldEl: HTMLCanvasElement, traceEl: HTMLCanvasElement) {
  const safety = window.setTimeout(revealStatic, 1500);
  let Field: typeof FieldClass;
  try {
    ({ Field } = await import('./webgl/field/Field'));
  } catch {
    /* The chunk never arrived. That is indistinguishable from having no WebGL
       as far as the page is concerned, so it degrades the same way rather than
       leaving the strip and the rail behind as evidence of a failure. */
    window.clearTimeout(safety);
    fieldEl.remove();
    root.dataset.field = 'off';
    revealStatic();
    bootStatic(traceEl);
    return;
  }
  window.clearTimeout(safety);

  const field = new Field(fieldEl, cap);
  const rhythm = new Rhythm();
  const trace = new Trace(traceEl, rhythm);
  const pointer = new Pointer();

  root.dataset.ground = 'paper';

  /* The sinus node drives the strip. */
  field.onPace = (now) => rhythm.schedule('sinus', now);

  /* Exciting the tissue by hand is an impulse arising below the atria, so it
     writes a PVC: no P, wide bizarre QRS, discordant T. Whether it captures
     is up to Rhythm's refractory period, which is why a click landing in the
     tail of the previous beat does nothing at all — and why holding and
     dragging paces the ventricle into a run of wide complexes that stops the
     moment you let go. */
  pointer.onStimulus((at) => rhythm.schedule('pvc', at));

  /* A traced circle still induces a re-entrant spiral in the medium — that is
     the simulation, and the footer says so. It no longer unlocks anything: the
     off-the-record entries are behind a button in the ledger now, because a
     reveal nobody finds is a reveal nobody reads. */
  pointer.onReentry((x, y) => {
    field.induceReentry(x, y, (s) => pointer.queue.push(s));
  });

  /* ── smooth scroll ────────────────────────────────────────── */
  const lenis = new Lenis({
    lerp: cap.reducedMotion ? 1 : 0.085,
    wheelMultiplier: 1,
    smoothWheel: !cap.reducedMotion,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  /* ── one clock for everything ─────────────────────────────── */
  const state = { board: 0, dim: 1, wave: 1 };
  let last = performance.now();
  let running = true;

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);

    const now = performance.now();
    const dt = now - last;
    last = now;
    if (!running) return;

    if (cap.tier !== 'calm') {
      field.step(dt, pointer.take(), now);
      trace.board = state.board;
      /* Paper speed is a physical quantity, so the strip advances on
         wall-clock time rather than on frames. A slow machine gets a
         slower-updating trace, not a differently-scaled one. */
      trace.advance(now);
      trace.draw();
    }

    field.board = state.board;
    field.dim = state.dim;
    field.wave = state.wave;
    field.draw(time);

    if (rateEl) {
      rateEl.textContent = trace.bpm ? `${trace.bpm} bpm` : '—— bpm';
    }
  });

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    last = performance.now();
  });

  // Dev-only handle for driving and inspecting the page deterministically.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__bg = {
      field, trace, pointer, rhythm, state,
      probe: () => ({ board: state.board, dim: state.dim, wave: state.wave, ...trace.debug() }),
    };
  }

  /* ── the first five seconds ───────────────────────────────── */
  if (revealed) {
    /* The safety net got there first. Bring the field up underneath what is
       already on screen rather than wiping the name back out to replay an
       entrance the reader has seen. */
    field.reveal = 1;
    traceEl.setAttribute('data-on', '');
    rail?.setAttribute('data-on', '');
  } else if (cap.tier === 'calm') {
    /* Reduced motion gets the composed result, not a faster version of
       the animation: one still frame of tissue, and a strip already
       carrying a readable rhythm rather than two lonely beats. */
    const now = performance.now();
    for (let i = 0; i < 60; i++) {
      field.step(16, i === 0 ? [{ x: 0.2, y: 0.72, radius: 0.09, amplitude: 1 }] : [], now);
    }
    field.reveal = 1;

    revealed = true;
    gsap.set(['.hero__given', '.hero__family'], { clipPath: 'inset(0 0% 0 0)' });
    gsap.set(['.hero__tag', '.hero__lede', '.chrome--cue'], { opacity: 1 });
    document.querySelectorAll('.bio__p').forEach((b) => b.setAttribute('data-active', '1'));

    rhythm.clear();
    for (let i = 12; i >= 0; i--) rhythm.schedule('sinus', now - i * 1000);
    trace.board = 0;
    trace.compose(now, 12);
    trace.draw();
    traceEl.setAttribute('data-on', '');
    rail?.setAttribute('data-on', '');
    if (rateEl) rateEl.textContent = `${rhythm.rate(now)} bpm`;
  } else {
    gsap.timeline({ delay: 0.25 })
    .to(field, { reveal: 1, duration: 1.1, ease: 'power2.out' }, 0)
    .add(() => {
      // The depolarization that starts everything. The wipe below is
      // timed to the wavefront this stimulus launches.
      pointer.fire(0.12, 0.78, 0.07, 1);
    }, 0.35)
    .to('.hero__given', { clipPath: 'inset(0 0% 0 0)', duration: 1.15, ease: 'power3.inOut' }, 0.45)
    .to('.hero__family', { clipPath: 'inset(0 0% 0 0)', duration: 1.25, ease: 'power3.inOut' }, 0.72)
    .to('.hero__tag', { opacity: 1, duration: 0.85, ease: 'power2.out' }, 1.25)
    .to('.hero__lede', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1.6)
    .add(() => {
      traceEl.setAttribute('data-on', '');
      rail?.setAttribute('data-on', '');
    }, 1.7)
      .to('.chrome--cue', { opacity: 1, duration: 0.7, ease: 'power2.out' }, 2.35);
  }

  /* ── scroll choreography ──────────────────────────────────── */

  /* Where the ink flips from dark to light, as a fraction of the inversion.
     This is a contrast threshold, not a taste one: the ground darkens fast
     (it is ~76% of the way into the blackout by 0.34), so flipping late
     leaves a window of dark ink on an already-dark ground. Measured by
     scripts/contrast.mjs, which sweeps the whole scrub. */
  const INK_FLIP = 0.26;

  // Physician ground → engineer ground, scrubbed across The Gap.
  ScrollTrigger.create({
    trigger: '[data-scene="gap"]',
    start: 'top 70%',
    end: 'bottom 45%',
    scrub: 0.6,
    onUpdate: (self) => {
      state.board = self.progress;
      // Flip the ink before the ground finishes darkening, so text is
      // already light by the time the blackout arrives.
      root.dataset.ground = self.progress > INK_FLIP ? 'board' : 'paper';
    },
  });

  // Back to the paper ground on the way out.
  ScrollTrigger.create({
    trigger: '[data-scene="contact"]',
    start: 'top 60%',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => {
      state.board = 1 - self.progress;
      // Mirror of the outbound threshold: ink flips while the ground
      // is still dark, not after it has already gone pale.
      root.dataset.ground = self.progress > 1 - INK_FLIP ? 'paper' : 'board';
    },
  });

  /* Pull the field back under dense type so the prose stays first.
     Driven by explicit enter callbacks in both directions rather than
     onToggle: adjacent sections' active ranges overlap, and whichever
     toggled last was winning the argument regardless of what the
     reader was actually looking at. */
  /* A sustained spiral fills the whole field, so the quiet values have
     to survive the worst case the reader can deliberately create —
     not just the resting rhythm.

     The board sections sit higher than they used to. uDim scales the whole
     composite, substrate included, and the substrate is now the part doing
     the work: the wave itself runs at about a quarter of its old amplitude
     in the shader, so lifting these lets the etched routing read without
     letting the signal back up. The hero comes down instead of sitting at
     full — quiet everywhere was the instruction, hero included. */
  /* Substrate — the chart ruling and the circuit routing. This is the set the
     page is standing on, so the board sections run high: the complaint was
     that you cannot find the circuitry, and at 0.30 over near-black you
     genuinely cannot. */
  const DIM: Record<string, number> = {
    hero: 0.62, lead: 0.42, gap: 0.55, builds: 0.78,
    evidence: 0.62, ledger: 0.70, contact: 0.55,
  };

  /* Signal — the wave travelling over it, scaled separately. Dense prose gets
     a nearly still field; the hero and the inversion, which have no body copy
     over them, keep the motion. This is what stops the wave reading as noise
     across the screen, and it is most of the contrast fix. */
  const WAVE: Record<string, number> = {
    hero: 1, lead: 0.16, gap: 0.85, builds: 0.14,
    evidence: 0.10, ledger: 0.12, contact: 0.30,
  };
  // The strip is chrome, not content: it recedes wherever prose runs over it.
  const TRACE_OP: Record<string, number> = { hero: 1, gap: 0.8, contact: 0.9 };

  document.querySelectorAll<HTMLElement>('[data-scene]').forEach((sec) => {
    const scene = sec.dataset.scene!;
    const target = DIM[scene] ?? 0.35;
    const apply = () => {
      gsap.to(state, { dim: target, duration: 0.7, ease: 'power2.out' });
      gsap.to(state, { wave: WAVE[scene] ?? 0.15, duration: 0.7, ease: 'power2.out' });
      root.style.setProperty('--trace-op', String(TRACE_OP[scene] ?? 0.3));
    };
    ScrollTrigger.create({
      trigger: sec, start: 'top 60%', end: 'bottom 40%',
      onEnter: apply, onEnterBack: apply,
    });
  });

  // Biography paragraphs light as they arrive.
  gsap.utils.toArray<HTMLElement>('.bio__p').forEach((para) => {
    ScrollTrigger.create({
      trigger: para,
      start: 'top 82%',
      end: 'bottom 30%',
      onEnter: () => para.setAttribute('data-active', '1'),
      onEnterBack: () => para.setAttribute('data-active', '1'),
    });
  });

  // Modules arrive one at a time; each one nudges the tissue, so
  // traversing the board is visibly what is driving the current.
  gsap.utils.toArray<HTMLElement>('.mod').forEach((mod, i) => {
    gsap.from(mod, {
      opacity: 0, y: 42, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: mod, start: 'top 82%' },
    });
    ScrollTrigger.create({
      trigger: mod,
      start: 'top 60%',
      onEnter: () => pointer.fire(i % 2 ? 0.82 : 0.18, 0.5 + (i % 3) * 0.12, 0.05, 1),
    });
  });

  gsap.utils.toArray<HTMLElement>('.pub').forEach((row, i) => {
    gsap.from(row, {
      opacity: 0, duration: 0.5, ease: 'power2.out', delay: (i % 8) * 0.035,
      scrollTrigger: { trigger: row, start: 'top 92%' },
    });
  });

  /* ── resize ───────────────────────────────────────────────── */
  let rt: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      field.resize();
      trace.resize();
      ScrollTrigger.refresh();
    }, 160);
  });

  fieldEl.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
  });
}
