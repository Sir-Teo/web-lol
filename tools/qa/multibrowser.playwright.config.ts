import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../e2e',
  testMatch: ['milestone5-browser-acceptance.spec.ts'],
  timeout: 240_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5199',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        video: { mode: 'on', size: { width: 1440, height: 900 } },
        trace: 'on',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
            'webgl.disabled': false,
            'webgl.forbid-software': false,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5199',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
  },
});
