/* Crop each build plate out of the page so the objects can be judged. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = './.shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.SITE_URL ?? 'http://localhost:5174/personal_site/';

const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const ids = process.env.ONLY ? process.env.ONLY.split(',') : ['vivesense','nephra','microplastics','ocula','flopcheck','lantern','activedoc'];
for (const id of ids) {
  await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'center' }), id);
  await page.waitForFunction((m) => (document.querySelector(`canvas[data-figure="${m}"]`)?.width ?? 0) > 400, id, { timeout: 15000 }).catch(() => {});
  /* Lenis eases the scroll, so a box measured immediately is stale by the time
     the shot is taken — which crops the plate and bleeds the caption in. Wait
     for the rect to stop moving. */
  await page.waitForFunction((m) => {
    const el = document.querySelector(`[data-mod="${m}"]`);
    if (!el) return false;
    const y = Math.round(el.getBoundingClientRect().top);
    const w = window;
    const settled = w.__lastY === y;
    w.__lastY = y;
    return settled;
  }, id, { timeout: 20000, polling: 260 }).catch(() => {});
  /* Clip off a full-page shot rather than screenshotting the element: Lenis is
     still easing the scroll, and element screenshots wait for stability that a
     smooth-scrolled page never reaches. */
  const sel = process.env.WHOLE ? `[data-mod="${id}"]` : `canvas[data-figure="${id}"]`;
  const box = await page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r ? { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.width, height: Math.min(r.height, 900 - Math.max(0, r.y)) } : null;
  }, sel);
  if (box && box.width > 0) await page.screenshot({ path: `${OUT}/plate-${id}.png`, clip: box, animations: 'disabled', timeout: 90000 });
  const ground = await page.evaluate(() => document.documentElement.dataset.ground);
  console.log(id, 'ground=' + ground);
}
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'clean');
await b.close();
