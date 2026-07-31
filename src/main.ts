import '@fontsource-variable/bodoni-moda';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/type.css';
import './styles/sections.css';

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { detect } from './core/capability';
import { Pointer } from './core/pointer';
import { Field } from './webgl/field/Field';
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

/* ── no WebGL: the document still has to work ───────────────── */
if (cap.tier === 'fallback' || !fieldCanvas || !traceCanvas) {
  fieldCanvas?.remove();
  traceCanvas?.remove();
  root.dataset.ground = 'paper';
  gsap.set(['.hero__given', '.hero__family'], { clipPath: 'inset(0 0% 0 0)' });
  gsap.set(['.hero__role', '.hero__lede', '.chrome--cue'], { opacity: 1 });
  document.querySelectorAll('.beat').forEach((b) => b.setAttribute('data-active', '1'));
  document.querySelector('[data-egg]')?.removeAttribute('hidden');
} else {
  boot(fieldCanvas, traceCanvas);
}

function boot(fieldEl: HTMLCanvasElement, traceEl: HTMLCanvasElement) {
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

  pointer.onReentry((x, y) => {
    field.induceReentry(x, y, (s) => pointer.queue.push(s));
    const egg = document.querySelector<HTMLElement>('[data-egg]');
    const cue = document.querySelector<HTMLElement>('[data-egg-cue]');
    if (egg?.hasAttribute('hidden')) {
      egg.removeAttribute('hidden');
      gsap.from(egg, { opacity: 0, y: 12, duration: 0.7, ease: 'power3.out' });
      if (cue) cue.textContent = 'Re-entry induced. The wave is now chasing its own tail.';
    }
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
  const state = { board: 0, dim: 1 };
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
      probe: () => ({ board: state.board, dim: state.dim, ...trace.debug() }),
    };
  }

  /* ── the first five seconds ───────────────────────────────── */
  if (cap.tier === 'calm') {
    /* Reduced motion gets the composed result, not a faster version of
       the animation: one still frame of tissue, and a strip already
       carrying a readable rhythm rather than two lonely beats. */
    const now = performance.now();
    for (let i = 0; i < 60; i++) {
      field.step(16, i === 0 ? [{ x: 0.2, y: 0.72, radius: 0.09, amplitude: 1 }] : [], now);
    }
    field.reveal = 1;

    gsap.set(['.hero__given', '.hero__family'], { clipPath: 'inset(0 0% 0 0)' });
    gsap.set(['.hero__role', '.hero__lede', '.chrome--cue'], { opacity: 1 });
    document.querySelectorAll('.beat').forEach((b) => b.setAttribute('data-active', '1'));

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
    .to('.hero__role', { opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.25)
    .to('.hero__lede', { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 1.45)
    .add(() => {
      traceEl.setAttribute('data-on', '');
      rail?.setAttribute('data-on', '');
    }, 1.7)
      .to('.chrome--cue', { opacity: 1, duration: 0.7, ease: 'power2.out' }, 2.35);
  }

  /* ── scroll choreography ──────────────────────────────────── */

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
      root.dataset.ground = self.progress > 0.34 ? 'board' : 'paper';
      const lock = document.querySelector<HTMLElement>('[data-lock]');
      if (lock) {
        if (self.progress > 0.85) { lock.dataset.locked = '1'; lock.textContent = 'PHASE LOCKED'; }
        else { delete lock.dataset.locked; lock.textContent = 'OUT OF PHASE'; }
      }
    },
  });

  // Back to baseline on the way out.
  ScrollTrigger.create({
    trigger: '[data-scene="contact"]',
    start: 'top 60%',
    end: 'bottom bottom',
    scrub: 0.6,
    onUpdate: (self) => {
      state.board = 1 - self.progress;
      // Mirror of the outbound threshold: ink flips while the ground
      // is still dark, not after it has already gone pale.
      root.dataset.ground = self.progress > 0.66 ? 'paper' : 'board';
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
  const DIM: Record<string, number> = {
    hero: 0.85, lead: 0.26, gap: 0.80, builds: 0.34,
    evidence: 0.26, ledger: 0.30, contact: 0.55,
  };
  // The strip is chrome, not content: it recedes wherever prose runs over it.
  const TRACE_OP: Record<string, number> = { hero: 1, gap: 0.8, contact: 0.9 };

  document.querySelectorAll<HTMLElement>('[data-scene]').forEach((sec) => {
    const scene = sec.dataset.scene!;
    const target = DIM[scene] ?? 0.35;
    const apply = () => {
      gsap.to(state, { dim: target, duration: 0.7, ease: 'power2.out' });
      root.style.setProperty('--trace-op', String(TRACE_OP[scene] ?? 0.3));
    };
    ScrollTrigger.create({
      trigger: sec, start: 'top 60%', end: 'bottom 40%',
      onEnter: apply, onEnterBack: apply,
    });
  });

  // Biography beats light as they arrive.
  gsap.utils.toArray<HTMLElement>('.beat').forEach((beat) => {
    ScrollTrigger.create({
      trigger: beat,
      start: 'top 78%',
      end: 'bottom 30%',
      onEnter: () => beat.setAttribute('data-active', '1'),
      onEnterBack: () => beat.setAttribute('data-active', '1'),
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
