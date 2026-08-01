/* Does any content box sit on top of any other?
 *
 * `collide.mjs` answers one question — hero cue versus strip chart — because
 * that is the collision that bit once. This asks the general form: walk the
 * page at several widths, and at each scroll position test every visible
 * content box against every other.
 *
 * Two things are deliberately *not* failures. The fixed background layers
 * (`#field`, `#grain`, `#trace`) are meant to sit under everything, and the
 * strip chart is masked so body text scrolling past it meets a gradient rather
 * than a hard edge. And an ancestor always contains its descendant, which is
 * containment, not collision.
 */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';

const VIEWPORTS = process.env.ONLY_VP
  ? [process.env.ONLY_VP.split('x').map(Number)]
  : [[1440, 900], [1280, 800], [768, 1024], [390, 844], [360, 640]];

const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});

let bad = 0;
const errs = [];

for (const [w, h] of VIEWPORTS) {
  const page = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  page.on('pageerror', (e) => errs.push(`${w}x${h} PAGEERROR: ${e.message}`));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);

  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const hits = new Map();

  for (let y = 0; y < height; y += Math.round(h * 0.5)) {
    await page.evaluate((t) => window.scrollTo(0, t), y);
    await page.waitForTimeout(360);

    const found = await page.evaluate(() => {
      /* Every content box in `main`, by tag rather than by class.
         The first version of this listed the classes it knew about, missed
         `.lead__close` because that class was not on the list, and reported the
         page clean while a sticky portrait sat on top of it. A hand-written
         inventory only ever finds the collisions you already suspected. */
      const SEL = 'main :is(h1,h2,h3,h4,p,li,dt,dd,figcaption,img,canvas,button,blockquote)';

      const vis = [...document.querySelectorAll(SEL)].filter((el) => {
        if (el.closest('[hidden]')) return false;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none') return false;
        const r = el.getBoundingClientRect();
        // Only what is actually on screen right now.
        return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < window.innerHeight;
      });

      const label = (el) => {
        const id = el.dataset.figure || el.dataset.mod || '';
        return `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}${id ? `[${id}]` : ''}`;
      };

      /* Deliberate stacks. The portrait and its surface-potential map are two
         layers of one image that cross-fade under the pointer — they are
         *supposed* to occupy the same box, and reporting that as a collision
         would train the reader of this output to ignore it. */
      const STACKED = (a, c) =>
        (a.matches('.plate__img') && c.matches('.plate__map')) ||
        (a.matches('.plate__map') && c.matches('.plate__img'));

      const out = [];
      for (let i = 0; i < vis.length; i++) {
        for (let j = i + 1; j < vis.length; j++) {
          const a = vis[i], c = vis[j];
          if (a.contains(c) || c.contains(a)) continue;
          if (STACKED(a, c)) continue;

          const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
          const dx = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left);
          const dy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
          /* 2px of slack: adjacent boxes routinely share a boundary pixel, and
             a rounded sub-pixel layout is not an overlap. */
          if (dx > 2 && dy > 2) {
            out.push({ a: label(a), c: label(c), dx: Math.round(dx), dy: Math.round(dy) });
          }
        }
      }
      return out;
    });

    for (const f of found) {
      const key = `${f.a} × ${f.c}`;
      const prev = hits.get(key);
      if (!prev || f.dx * f.dy > prev.dx * prev.dy) hits.set(key, f);
    }
  }

  const list = [...hits.values()];
  bad += list.length;
  console.log(`${w}x${h}`.padEnd(10), list.length ? `${list.length} OVERLAP` : 'clear');
  for (const f of list) console.log(`    ${f.a} × ${f.c}  ${f.dx}×${f.dy}px`);

  await page.close();
}

if (errs.length) console.log('ERRORS:', errs.join(' | '));
console.log(bad ? `\n${bad} overlapping pair(s).` : '\nNo content boxes overlap.');
await b.close();
process.exit(bad || errs.length ? 1 : 0);
