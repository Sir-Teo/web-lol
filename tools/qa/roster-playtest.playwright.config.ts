import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const url = 'http://127.0.0.1:4174';
export default defineConfig({
  testDir: '.',
  testMatch: 'roster-playtest.spec.ts',
  outputDir: '../../test-results/roster-playtest',
  timeout: 600_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: url,
    channel: 'chrome',
    viewport: { width: 1024, height: 720 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    // Vite preview labels raw .bin.gz assets with Content-Encoding: gzip.
    command: 'python3 -m http.server --bind 127.0.0.1 --directory dist-roster-playtest 4174',
    url,
    reuseExistingServer: false,
  },
});
