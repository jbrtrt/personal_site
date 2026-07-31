/**
 * The portrait, read as a surface-potential map.
 *
 * A Sobel gradient over the photograph, colour-ramped into the same
 * sodium/potassium pair the tissue uses — so hovering the plate
 * shows the face the way the rest of the site shows a membrane.
 * If the headshot has not been dropped in yet, this quietly does
 * nothing and the frame shows its PLATE PENDING state instead.
 */

export function buildPotentialMap(img: HTMLImageElement, out: HTMLCanvasElement) {
  const N = 320;
  out.width = N;
  out.height = N;

  const ctx = out.getContext('2d');
  if (!ctx) return;

  const src = document.createElement('canvas');
  src.width = N; src.height = N;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) return;

  // cover-fit
  const scale = Math.max(N / img.naturalWidth, N / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  sctx.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);

  let data: Uint8ClampedArray;
  try {
    data = sctx.getImageData(0, 0, N, N).data;
  } catch {
    return; // tainted canvas — nothing to do
  }

  const lum = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    lum[i] = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) / 255;
  }

  const outImg = ctx.createImageData(N, N);
  const px = outImg.data;

  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const gx =
        -lum[i - N - 1]! - 2 * lum[i - 1]! - lum[i + N - 1]! +
         lum[i - N + 1]! + 2 * lum[i + 1]! + lum[i + N + 1]!;
      const gy =
        -lum[i - N - 1]! - 2 * lum[i - N]! - lum[i - N + 1]! +
         lum[i + N - 1]! + 2 * lum[i + N]! + lum[i + N + 1]!;

      const g = Math.min(1, Math.hypot(gx, gy) * 0.85);
      const base = lum[i]!;

      // sodium gold on the gradient, potassium violet in the flats
      const r = g * 232 + (1 - g) * base * 70;
      const gr = g * 176 + (1 - g) * base * 55;
      const b = g * 75 + (1 - g) * base * 140;

      const o = i * 4;
      px[o] = r; px[o + 1] = gr; px[o + 2] = b;
      px[o + 3] = 235;
    }
  }

  ctx.putImageData(outImg, 0, 0);
}

/* Whichever of these is present in public/ wins. The photo has to be
   droppable by hand without touching code, so the filename must not be
   a thing that can be got wrong.

   The extension actually shipped goes first, and index.html's src has to
   match it: every candidate tried before the real file is a 404 in the
   console of a page that claims to have none. */
const CANDIDATES = ['./headshot.jpeg', './headshot.jpg', './headshot.png', './headshot.webp'];

export function wirePortrait(root: ParentNode = document) {
  const img = root.querySelector<HTMLImageElement>('[data-portrait]');
  const map = root.querySelector<HTMLCanvasElement>('[data-portrait-map]');
  if (!img || !map) return;

  const frame = img.closest<HTMLElement>('.plate__frame');
  let attempt = 0;

  const run = () => {
    if (!img.naturalWidth) return;
    frame?.removeAttribute('data-empty');
    buildPotentialMap(img, map);
  };

  const next = () => {
    attempt++;
    if (attempt < CANDIDATES.length) {
      img.src = CANDIDATES[attempt]!;
      return;
    }
    if (frame) frame.dataset.empty = '1';
  };

  img.addEventListener('load', run);
  img.addEventListener('error', next);

  if (img.complete) {
    if (img.naturalWidth) run();
    else next();
  }
}
