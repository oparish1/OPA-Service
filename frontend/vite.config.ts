import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { parseAppConfig } from '../shared/app-config';

const PUBLIC_DIR = new URL('./public/', import.meta.url).pathname;

/**
 * A18: the build must fail when a shipped config carries a secret-shaped value.
 * Vite copies `public/` verbatim, so validate every config file there before
 * the bundle is produced (see `shared/app-config.ts`).
 */
function validatePublicConfig(): Plugin {
  return {
    name: 'validate-public-config',
    apply: 'build',
    buildStart() {
      for (const name of ['config.json', 'config.example.json']) {
        const file = join(PUBLIC_DIR, name);
        if (!existsSync(file)) continue;
        parseAppConfig(JSON.parse(readFileSync(file, 'utf8')));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), validatePublicConfig()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
  },
});
