import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'virtual:pwa-register': fileURLToPath(
        new URL('./test/fixtures/pwa-register.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'test/conformance/**/*.test.ts'],
    setupFiles: ['src/app/storage-test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    css: {
      include: /styles\.css(?:\?raw)?$/,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
