/* Does anything in the hero overlap the instrument strip? Short viewports are
   where this bites, so sweep heights rather than checking one. */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';
const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});

for (const [w, h] of [[1280, 800], [1280, 700], [1440, 900], [390, 844], [390, 667]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const box = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) };
    };
    const cue = box('[data-cue]');
    const strip = box('#trace');   // the strip chart, not the top rail
    return { cue, strip, vh: window.innerHeight };
  });

  const strip = r.strip;
  const overlap = r.cue && strip ? r.cue.bottom - strip.top : null;
  console.log(
    `${w}x${h}`.padEnd(10),
    'cue', JSON.stringify(r.cue),
    'trace', JSON.stringify(strip),
    overlap !== null && overlap > 0 ? `OVERLAP ${overlap}px` : 'clear',
  );
  await page.close();
}
await b.close();
