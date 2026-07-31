/* Needs a dev server up: npm run dev, then node scripts/tiers.mjs */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = './.shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.SITE_URL ?? 'http://localhost:5173/personal_site/';

async function tier(name, launchArgs, contextOpts) {
  const b = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...launchArgs],
  });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, ...contextOpts });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/tier-${name}.png` });

  /* Figures only draw once they are near the viewport, so a check run at the
     hero would report zero of them in every tier and prove nothing. */
  await page.evaluate(() => document.querySelector('[data-mod="ocula"]')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(900);

  const info = await page.evaluate(() => ({
    tier: document.documentElement.dataset.tier,
    hasField: !!document.getElementById('field'),
    pubs: document.querySelectorAll('.pub').length,
    heroVisible: getComputedStyle(document.querySelector('.hero__lede')).opacity,
    nameClip: getComputedStyle(document.querySelector('.hero__given')).clipPath,
    bioActive: document.querySelectorAll('.bio__p[data-active]').length,
    figuresDrawn: [...document.querySelectorAll('canvas[data-figure]')]
      .filter((c) => c.width > 0 && c.getContext('2d')
        .getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 8)).length,
  }));
  console.log(name.padEnd(14), JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'clean');
  await b.close();
}

await tier('reduced', ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'], { reducedMotion: 'reduce' });
await tier('no-webgl', ['--disable-gpu','--disable-software-rasterizer','--disable-webgl','--disable-webgl2'], {});
