import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5198',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5198',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
  },
});
