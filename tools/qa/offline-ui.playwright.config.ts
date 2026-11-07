import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.OFFLINE_UI_PORT ?? 5224);
export default defineConfig({
  testDir: '.',
  testMatch: 'offline-retry-ownership.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: process.env.OFFLINE_UI_OUTPUT ?? '../../test-results/offline-ui',
  reporter: process.env.OFFLINE_UI_REPORT
    ? [['json', { outputFile: process.env.OFFLINE_UI_REPORT }]]
    : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    cwd: root,
    command: `npm exec vite -- --config tools/qa/offline-ui.vite.config.ts --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
