import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const BFF_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': BFF_TARGET,
      '/api': BFF_TARGET,
      '/v1': BFF_TARGET,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
    // Unit tests exercise the mock API seam; the running app selects the real
    // BFF client from .env.local.
    env: { VITE_AUTH_MODE: 'mock' },
  },
});
