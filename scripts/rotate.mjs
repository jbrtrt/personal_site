/* Does the hero turn, and is it fast enough to keep?
   The plan is explicit: if a flat-shaded drag pass cannot hold ~20 fps, the
   interaction is dropped and the static render ships. This measures it. */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';
const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, ...(process.env.CALM ? { reducedMotion: 'reduce' } : {}) });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const id = process.env.ONLY ?? 'lantern';
await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'center' }), id);
await page.waitForFunction((m) => (document.querySelector(`canvas[data-figure="${m}"]`)?.width ?? 0) > 400, id, { timeout: 15000 });
await page.waitForTimeout(1500);

const hero = await page.evaluate((m) => {
  const r = document.querySelector(`canvas[data-figure="${m}"]`).getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height * 0.72 };   // in the hero band
}, id);

/** A cheap fingerprint of what the canvas is showing. */
const sig = (m) => page.evaluate((k) => {
  const c = document.querySelector(`canvas[data-figure="${k}"]`);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0;
  return h;
}, m);

const before = await sig(id);
const otherId = id === 'lantern' ? 'ocula' : 'lantern';
const otherBefore = await sig(otherId);
const beatsBefore = await page.evaluate(() => window.__bg?.probe?.().beats ?? null);

// Drag: 24 steps of horizontal movement, timed.
await page.mouse.move(hero.x, hero.y);
await page.mouse.down();
const t0 = Date.now();
for (let i = 1; i <= 24; i++) {
  await page.mouse.move(hero.x + i * 6, hero.y + Math.sin(i / 4) * 2);
}
const dragMs = Date.now() - t0;
await page.mouse.up();
/* Long enough for the full-quality re-render to land. A frame on this machine
   is ~900 ms, so a short wait samples the quick pass and reports a difference
   that is only timing. */
await page.waitForTimeout(3500);

const after = await sig(id);
const otherAfter = await sig(otherId);
const beatsAfter = await page.evaluate(() => window.__bg?.probe?.().beats ?? null);

/* The ground inversion repaints every live plate; a rotated one must come back
   at the angle it was left at, not at the authored camera.
   Scroll away and back rather than setting `data-ground` by hand — the app
   drives that attribute from scroll position, so forcing it to a value the
   scroll does not agree with is corrected a frame later and the comparison
   comes out false for the wrong reason. */
const groundBefore = await page.evaluate(() => document.documentElement.dataset.ground);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'center' }), id);
await page.waitForTimeout(1800);
const groundAfter = await page.evaluate(() => document.documentElement.dataset.ground);
const afterInvert = await sig(id);

console.log(JSON.stringify({
  turned: before !== after,
  otherPlateUntouched: otherBefore === otherAfter,
  fieldNotStimulated: beatsBefore === beatsAfter,
  groundRoundTrip: `${groundBefore} -> ${groundAfter}`,
  keptAngleAcrossRepaint: afterInvert === after,
  dragMs,
  msPerMove: +(dragMs / 24).toFixed(1),
  errors: errs,
}, null, 2));

await b.close();
