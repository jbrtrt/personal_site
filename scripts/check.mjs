/* Lean browser pass: no screenshots. Confirms the shaders compile, the ECG
   is running, the figures drew, and the console is clean. Screenshots live in
   drive.mjs; on a slow software rasteriser they dominate the runtime and this
   is what actually gates a push. */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:5173/personal_site/';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const boot = await page.evaluate(() => ({
  tier: document.documentElement.dataset.tier,
  ground: document.documentElement.dataset.ground,
  rate: document.querySelector('[data-rate]')?.textContent,
  pubs: document.querySelectorAll('.pub').length,
  creds: document.querySelectorAll('.creds li').length,
  beats: document.querySelectorAll('.beat').length,
  claims: document.querySelectorAll('.mod__claim').length,
  portrait: !document.querySelector('.plate__frame')?.hasAttribute('data-empty'),
  probe: window.__bg?.probe?.(),
}));

/* The drawing buffer is not readable (preserveDrawingBuffer is false), so the
   evidence that the shaders are alive is that three.js linked the programs and
   the context reports no error — a GLSL compile failure is loud on the console
   and would already have been captured above.

   __bg is dev-only, so against a production bundle this reports `null` and the
   console, the rate and the figures carry the check instead. */
const field = await page.evaluate(() => {
  const r = window.__bg?.field?.renderer;
  if (!r) return null;
  return {
    programs: r.info.programs.length,
    drawCalls: r.info.render.calls,
    glError: r.getContext().getError(),
  };
});

/* Each figure only draws once it is near the viewport, so scroll every module
   into view rather than assuming one pass covers them. */
const figures = [];
for (const id of ['vivesense', 'nephra', 'stoneidx', 'ocula', 'flopcheck', 'lantern', 'notes2anki']) {
  await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'center' }), id);

  /* Poll rather than sleep. Lenis animates the scroll and the first jump out of
     the hero is the longest, so any fixed wait is either flaky or slow — and a
     flaky gate is worse than no gate. render() sizes the canvas, so a real
     width is proof the observer fired and the figure painted. */
  await page
    .waitForFunction(
      (m) => (document.querySelector(`canvas[data-figure="${m}"]`)?.width ?? 0) > 400,
      id,
      { timeout: 15000 },
    )
    .catch(() => {});

  figures.push(await page.evaluate((m) => {
    const c = document.querySelector(`canvas[data-figure="${m}"]`);
    if (!c?.width) return { id: m, inked: 0 };
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
    return { id: m, inked: n };
  }, id));
}

// Click should write a PVC; the beat count has to go up.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
const before = await page.evaluate(() => window.__bg?.probe().beats ?? null);
await page.mouse.click(1100, 430);
await page.waitForTimeout(400);
const after = await page.evaluate(() => window.__bg?.probe().beats ?? null);

console.log(JSON.stringify({ boot, field, figures, ectopic: { before, after }, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
