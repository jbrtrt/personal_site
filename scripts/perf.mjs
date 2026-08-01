/* First-paint cost, on a phone profile and a desktop one.
 *
 * Numbers off this container are not numbers off a phone — headless SwiftShader
 * runs the field at about 5 fps and the box is memory-starved. What the run is
 * good for is *comparison* against itself: the same page, the same machine,
 * before and after a change. Absolute values should never be quoted as what a
 * visitor sees.
 */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';
const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});

for (const [name, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const page = await b.newPage({ viewport: { width: w, height: h } });

  const bytes = { total: 0, font: 0, js: 0, css: 0, img: 0 };
  page.on('response', async (r) => {
    try {
      const len = Number((await r.allHeaders())['content-length'] ?? 0);
      if (!len) return;
      const u = r.url();
      bytes.total += len;
      if (/\.woff2?$/.test(u)) bytes.font += len;
      else if (/\.js$/.test(u)) bytes.js += len;
      else if (/\.css$/.test(u)) bytes.css += len;
      else if (/\.(jpe?g|png|webp|avif)$/.test(u)) bytes.img += len;
    } catch { /* response body gone; not worth failing a measurement over */ }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]),
    );
    const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
    return {
      FCP: paint['first-contentful-paint'] ?? null,
      LCP: lcp ? Math.round(lcp.startTime) : null,
      DCL: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      /* Layout shift is the one metric here that is *not* machine-bound: a
         reserved box either holds its size or it does not. */
      CLS: +performance.getEntriesByType('layout-shift')
        .filter((e) => !e.hadRecentInput)
        .reduce((s, e) => s + e.value, 0).toFixed(4),
    };
  });

  const kb = (n) => `${Math.round(n / 1024)}kB`;
  console.log(
    name.padEnd(8),
    `FCP ${m.FCP}ms  LCP ${m.LCP}ms  DCL ${m.DCL}ms  load ${m.load}ms  CLS ${m.CLS}`,
  );
  console.log(
    ' '.repeat(8),
    `bytes  total ${kb(bytes.total)}  js ${kb(bytes.js)}  font ${kb(bytes.font)}  css ${kb(bytes.css)}  img ${kb(bytes.img)}`,
  );
  await page.close();
}
await b.close();
