/* One long shot of a module at phone width — the layout most likely to break
   when the desktop layout changes. */
import { chromium } from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('./.shots', { recursive: true });
const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'] });
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const id = process.env.ONLY ?? 'nephra';
await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'start' }), id);
await page.waitForTimeout(2000);
const over = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}));
console.log('horizontal overflow:', over.scrollW > over.clientW ? `YES (${over.scrollW} > ${over.clientW})` : 'none');
await page.screenshot({ path: `./.shots/mobile-${id}.png`, animations: 'disabled', timeout: 90000 });
console.log(errs.length ? 'ERR '+errs.join(' | ') : 'clean');
await b.close();
