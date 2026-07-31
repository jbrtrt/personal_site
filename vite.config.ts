import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

// Served from https://jbrtrt.github.io/personal_site/.
// Moving to a root domain later is a one-line change: base: '/'.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/personal_site/',
  plugins: [glsl({ compress: false })],
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
