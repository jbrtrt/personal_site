import pkg from 'file:///opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'node:fs';

const OUT = './.shots';
fs.mkdirSync(OUT, { recursive: true });

const URL = 'http://localhost:5173/personal_site/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });

// ── the first five seconds ────────────────────────────────────
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/01-hero-1.2s.png` });
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/02-hero-2.8s.png` });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/03-hero-5s.png` });

// ── click to depolarize ───────────────────────────────────────
await page.mouse.click(1050, 420);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-click-wave.png` });

// diagnostics from the live page
const diag = await page.evaluate(() => ({
  tier: document.documentElement.dataset.tier,
  ground: document.documentElement.dataset.ground,
  rate: document.querySelector('[data-rate]')?.textContent,
  pubs: document.querySelectorAll('.pub').length,
  traceOn: document.getElementById('trace')?.hasAttribute('data-on'),
  nameClip: getComputedStyle(document.querySelector('.hero__given')).clipPath,
  ledeOpacity: getComputedStyle(document.querySelector('.hero__lede')).opacity,
}));

// ── scroll through every scene ────────────────────────────────
const scenes = ['lead', 'gap', 'builds', 'evidence', 'ledger', 'contact'];
for (const s of scenes) {
  await page.evaluate((sel) => {
    document.querySelector(`[data-scene="${sel}"]`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, s);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/scene-${s}.png` });
}

const groundAfter = await page.evaluate(() => document.documentElement.dataset.ground);

// ── the spiral gesture ────────────────────────────────────────
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(900);
const cx = 720, cy = 450, r = 170;
await page.mouse.move(cx + r, cy);
await page.mouse.down();
for (let i = 0; i <= 64; i++) {
  const a = (i / 64) * Math.PI * 6;
  await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  await page.waitForTimeout(12);
}
await page.mouse.up();
await page.waitForTimeout(1200);

const turns = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--turn'));
const eggOpen = await page.evaluate(() => !document.querySelector('[data-egg]')?.hasAttribute('hidden'));
await page.evaluate(() => document.querySelector('[data-scene="ledger"]')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-egg.png` });

// ── narrow viewports ──────────────────────────────────────────
for (const [w, h, name] of [[1024, 768, 'tablet'], [390, 844, 'phone']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/vp-${name}-hero.png` });
  await page.evaluate(() => document.querySelector('[data-scene="builds"]')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/vp-${name}-builds.png` });
}

console.log(JSON.stringify({ diag, groundAfter, turns, eggOpen, errors }, null, 2));

await browser.close();
