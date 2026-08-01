import { defineConfig, type Plugin } from 'vite';
import glsl from 'vite-plugin-glsl';

/**
 * Preload the faces that set the first screen.
 *
 * A webfont is the last thing the browser finds out about: it is named inside a
 * stylesheet, so it cannot be requested until that stylesheet has been fetched
 * and parsed. That is a whole round trip after the HTML for type that is already
 * on screen, and it is why the hero renders in Times before it renders in
 * Bodoni. These three are the faces the first screen actually uses — the display
 * roman, its italic (the surname), and the mono of the instrument chrome.
 *
 * Matched against the emitted bundle rather than written by hand, because the
 * filenames carry content hashes and a stale literal would preload a 404.
 */
function preloadFonts(): Plugin {
  const WANT = [
    /bodoni-moda-latin-wght-normal-.*\.woff2$/,
    /bodoni-moda-latin-wght-italic-.*\.woff2$/,
    /ibm-plex-mono-latin-400-normal-.*\.woff2$/,
  ];
  let base = '/';
  let hits: string[] = [];

  return {
    name: 'preload-fonts',
    apply: 'build',
    configResolved(c) { base = c.base; },
    generateBundle(_o, bundle) {
      hits = Object.keys(bundle).filter((f) => WANT.some((r) => r.test(f)));
    },
    transformIndexHtml: {
      order: 'post',
      handler: () => hits.map((f) => ({
        tag: 'link',
        attrs: {
          rel: 'preload', as: 'font', type: 'font/woff2',
          href: base + f, crossorigin: '',
        },
        injectTo: 'head' as const,
      })),
    },
  };
}

// Served from https://jbrtrt.github.io/personal_site/.
// Moving to a root domain later is a one-line change: base: '/'.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/personal_site/',
  plugins: [glsl({ compress: false }), preloadFonts()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['gsap', 'lenis'],
        },
      },
    },
  },
});
