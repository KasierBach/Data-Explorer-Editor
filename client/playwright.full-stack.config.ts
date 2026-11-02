import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './full-stack',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-full-stack-report', open: 'never' }]],
  outputDir: 'test-results-full-stack',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node ../server/test/full-stack-server.cjs',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      timeout: 180_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      env: { VITE_API_URL: 'http://127.0.0.1:3001/api' },
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
  projects: [{ name: 'full-stack-chromium', use: { ...devices['Desktop Chrome'] } }],
});
