/* How different are the clay study and the hero render, actually?
 *
 * "The second and hero plates are too similar" was a judgement, and the fix for
 * it needs a check that is not another judgement. This crops the two bands out
 * of each plate and measures three things that correspond to what the eye
 * compares at thumbnail size:
 *
 *   luma   mean lightness of the inked pixels. The first thing anyone compares,
 *          and the one the clay albedo moves directly.
 *   iou    silhouette overlap after both are normalised to the same box. This is
 *          what catches "same picture, different size" — the failure that shading
 *          changes alone cannot fix, because the outline never moved.
 *   hist   L1 distance between the two luminance histograms, 0..1. Picks up a
 *          change in tonal *distribution* even when the means happen to match.
 *
 * Run it before a change to learn what "too similar" measures as, then after.
 * Thresholds live in THRESHOLD below and were set from that baseline.
 */
import { chromium } from 'playwright';

const URL = process.env.SITE_URL ?? 'http://localhost:4173/personal_site/';
const IDS = process.env.ONLY
  ? process.env.ONLY.split(',')
  : ['vivesense', 'nephra', 'microplastics', 'ocula', 'flopcheck', 'lantern', 'activedoc'];

/* Set from the 2026-08-01 baseline, taken while all seven boards read as one
   picture twice. Mean lightness was the damning one: |dLuma| measured 0.010 to
   0.056 on every single board — clay and hero were the same weight of grey
   everywhere, which is what the eye compares first.
   The rule is `luma` AND (`iou` OR `hist`) — mean lightness is mandatory, plus at
   least one structural difference, either the outline or the tonal spread.

   Plain two-of-three was tried and is too weak: at baseline it passed four boards
   on `iou` and `hist` while `luma` sat at 0.01, which is exactly the state Ben
   called too similar. Requiring all three is too strong for a reason that is
   geometry rather than tuning — NEPHRA is a capsule, and a body of revolution
   barely changes outline when you spin it about a perpendicular axis, so its
   `iou` stays around 0.72 whatever the camera does. No shared camera rule fixes
   that without wrecking the flat objects. Mandatory `luma` is what rejects the
   baseline; the OR is what lets an honest capsule through. */
const THRESHOLD = { luma: 0.12, iou: 0.50, hist: 0.35 };

const b = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);

const rows = [];
for (const id of IDS) {
  await page.evaluate((m) => document.querySelector(`[data-mod="${m}"]`)?.scrollIntoView({ block: 'center' }), id);
  await page.waitForFunction(
    (m) => (document.querySelector(`canvas[data-figure="${m}"]`)?.width ?? 0) > 400,
    id, { timeout: 15000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);

  rows.push(await page.evaluate((m) => {
    const c = document.querySelector(`canvas[data-figure="${m}"]`);
    if (!c?.width) return { id: m, err: 'no canvas' };
    const ctx = c.getContext('2d');
    const s = c.width / 460;                      // board units -> backing store

    /* Band geometry mirrors VIEWS/BAND in src/ui/figure.ts. */
    const band = (cx, cy, bw, bh) => {
      const x = Math.max(0, Math.round((cx - bw / 2) * s));
      const y = Math.max(0, Math.round((cy - bh / 2) * s));
      const w = Math.min(c.width - x, Math.round(bw * s));
      const h = Math.min(c.height - y, Math.round(bh * s));
      const d = ctx.getImageData(x, y, w, h).data;

      const mask = new Uint8Array(w * h);
      const luma = new Float64Array(w * h);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        if (d[i + 3] > 24) {
          mask[p] = 1;
          luma[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        }
      }
      return { mask, luma, w, h };
    };

    /* Bounding box from row/column ink *profiles* rather than from any single
       inked pixel: the hero band also contains leader lines, and one hairline
       crossing the band would otherwise stretch the box to the plate edge and
       make the overlap number meaningless. A row has to carry 4% of the
       busiest row's ink before it counts as part of the object. */
    const bbox = ({ mask, w, h }) => {
      const cols = new Int32Array(w), rowsN = new Int32Array(h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) if (mask[y * w + x]) { cols[x]++; rowsN[y]++; }
      }
      const span = (arr) => {
        const max = Math.max(...arr);
        if (!max) return [0, 0];
        const t = max * 0.04;
        let lo = 0, hi = arr.length - 1;
        while (lo < arr.length && arr[lo] < t) lo++;
        while (hi > lo && arr[hi] < t) hi--;
        return [lo, hi];
      };
      const [x0, x1] = span(cols), [y0, y1] = span(rowsN);
      return { x0, x1, y0, y1 };
    };

    /* Resample the silhouette to a common grid, **preserving aspect ratio**.
       Stretching each box to fill the grid instead was the first attempt and it
       throws away the one thing a change of viewpoint moves most: a wide object
       and a square one both become a filled square and score a perfect overlap.
       Scale by the longer side, centre the shorter one. */
    const N = 64;
    const norm = (band_) => {
      const { mask, w } = band_;
      const { x0, x1, y0, y1 } = bbox(band_);
      const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
      const k = N / Math.max(bw, bh);
      const offX = (N - bw * k) / 2, offY = (N - bh * k) / 2;
      const out = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const sx = Math.round((i - offX) / k), sy = Math.round((j - offY) / k);
          if (sx < 0 || sy < 0 || sx > bw || sy > bh) continue;
          out[j * N + i] = mask[(y0 + sy) * w + (x0 + sx)] ?? 0;
        }
      }
      return out;
    };

    const stats = (band_) => {
      let n = 0, sum = 0;
      const hist = new Float64Array(16);
      for (let p = 0; p < band_.mask.length; p++) {
        if (!band_.mask[p]) continue;
        n++; sum += band_.luma[p];
        hist[Math.min(15, (band_.luma[p] * 16) | 0)]++;
      }
      for (let i = 0; i < 16; i++) hist[i] /= n || 1;
      return { n, mean: n ? sum / n : 0, hist };
    };

    const clay = band(344, 74, 198, 100);
    const hero = band(230, 232, 396, 138);
    const cs = stats(clay), hs = stats(hero);

    const a = norm(clay), z = norm(hero);
    let inter = 0, union = 0;
    for (let p = 0; p < a.length; p++) {
      if (a[p] && z[p]) inter++;
      if (a[p] || z[p]) union++;
    }

    let hist = 0;
    for (let i = 0; i < 16; i++) hist += Math.abs(cs.hist[i] - hs.hist[i]);

    return {
      id: m,
      clayLuma: +cs.mean.toFixed(3),
      heroLuma: +hs.mean.toFixed(3),
      luma: +Math.abs(cs.mean - hs.mean).toFixed(3),
      iou: +(union ? inter / union : 1).toFixed(3),
      hist: +(hist / 2).toFixed(3),
    };
  }, id));
}

let failed = 0;
console.log('plate           clay   hero   |dLuma|   iou    hist   verdict');
for (const r of rows) {
  if (r.err) { console.log(`${r.id.padEnd(15)} ${r.err}`); failed++; continue; }
  const pass = [
    r.luma >= THRESHOLD.luma,
    r.iou <= THRESHOLD.iou,
    r.hist >= THRESHOLD.hist,
  ];
  const ok = pass[0] && (pass[1] || pass[2]);
  if (!ok) failed++;
  console.log(
    r.id.padEnd(15),
    String(r.clayLuma).padEnd(6), String(r.heroLuma).padEnd(6),
    String(r.luma).padEnd(9), String(r.iou).padEnd(6), String(r.hist).padEnd(6),
    ok ? 'separated' : `TOO SIMILAR (${!pass[0] ? 'luma' : 'iou+hist'})`,
  );
}

if (errs.length) console.log('ERRORS:', errs.join(' | '));
console.log(failed ? `\n${failed} of ${rows.length} boards too similar.` : `\nAll ${rows.length} boards separated.`);
await b.close();
process.exit(failed || errs.length ? 1 : 0);
