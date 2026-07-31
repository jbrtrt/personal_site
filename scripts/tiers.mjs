import pkg from 'file:///opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const OUT = './.shots';
const URL = 'http://localhost:5173/personal_site/';

async function tier(name, launchArgs, contextOpts) {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', ...launchArgs],
  });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, ...contextOpts });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => ({
    tier: document.documentElement.dataset.tier,
    hasField: !!document.getElementById('field'),
    pubs: document.querySelectorAll('.pub').length,
    heroVisible: getComputedStyle(document.querySelector('.hero__lede')).opacity,
    nameClip: getComputedStyle(document.querySelector('.hero__given')).clipPath,
    beatsActive: document.querySelectorAll('.beat[data-active]').length,
  }));
  await page.screenshot({ path: `${OUT}/tier-${name}.png` });
  console.log(name.padEnd(14), JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'clean');
  await b.close();
}

await tier('reduced', ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'], { reducedMotion: 'reduce' });
await tier('no-webgl', ['--disable-gpu','--disable-software-rasterizer','--disable-webgl','--disable-webgl2'], {});
