import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';
import {
  readBrowserBinding,
  verifyBuild,
} from '../.github/scripts/browser-ci-artifacts.mjs';

const context = await readBrowserBinding();
const artifact = process.env.BROWSER_BUILD_ARTIFACT;
if (!artifact) throw new Error('BROWSER_BUILD_ARTIFACT_REQUIRED');
await verifyBuild(artifact, context, true);

export default defineConfig({
  ...baseConfig,
  globalTimeout: 20 * 60_000,
  workers: 1,
  metadata: context,
  webServer: {
    env: { VITE_API_URL: 'http://localhost:3001/api' },
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  reporter: [
    ['github'],
    ['json', { outputFile: 'ci-results/results.json' }],
    ['blob', { outputFile: 'ci-results/blob-report.zip' }],
  ],
});
