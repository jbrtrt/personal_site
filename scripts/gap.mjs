/* Shoot section 02 across the ground inversion.
 *
 * The scrim there is the one piece of the page that has to be invisible: it
 * carries a patch of the live ground under the type so the text stays legible
 * while the inversion sweeps underneath, and the moment it reads as a *panel* —
 * a straight edge, an uneven feather, a colour that lags the page — it has
 * failed. None of that is measurable, so it gets looked at.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = './.shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';

const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);

  /* Three points through the section rather than one: the scrim's colour is
     driven by the inversion, so entering, mid and leaving are three different
     grounds and the seam shows at the ends if it shows anywhere. */
  for (const [name, frac] of [['in', 0.0], ['mid', 0.5], ['out', 1.0]]) {
    await page.evaluate((f) => {
      const el = document.querySelector('.sec--gap');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight * (0.5 - f * 0.5) + r.height * f * 0.5);
    }, frac);
    await page.waitForTimeout(1400);

    const ground = await page.evaluate(() => document.documentElement.dataset.ground);
    await page.screenshot({ path: `${OUT}/gap-${w}-${name}.png`, animations: 'disabled', timeout: 90000 });
    console.log(`${w}x${h}`.padEnd(9), name.padEnd(4), 'ground=' + ground);
  }
  await page.close();
}
await b.close();
