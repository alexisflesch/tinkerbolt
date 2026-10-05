import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { getBuildMetadata } from './scripts/build-metadata';
import { createNavigateFallbackAllowlist } from './scripts/navigate-fallback-allowlist';
import { precacheGlobIgnores, precacheGlobPatterns } from './scripts/precache-globs';

// GitHub Pages serves the site under `/<repository>/`; the deploy workflow sets
// this variable. Locally, in tests and in Playwright, the app lives at `/`.
const basePath = process.env.TINKERBOLT_BASE_PATH ?? '/';
const navigateFallbackAllowlist = createNavigateFallbackAllowlist(basePath);
const buildMetadata = getBuildMetadata();

export default defineConfig({
  base: basePath,
  define: {
    __APP_VERSION__: JSON.stringify(buildMetadata.version),
    __APP_COMMIT__: JSON.stringify(buildMetadata.commit),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'TinkerBolt',
        short_name: 'TinkerBolt',
        lang: 'fr',
        description: 'Construisez, testez et améliorez vos machines mécaniques.',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        orientation: 'any',
        background_color: '#101923',
        theme_color: '#101923',
        icons: [
          {
            src: 'icons/tinkerbolt-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/tinkerbolt-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/tinkerbolt-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [...precacheGlobPatterns],
        globIgnores: [...precacheGlobIgnores],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [navigateFallbackAllowlist],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
});
