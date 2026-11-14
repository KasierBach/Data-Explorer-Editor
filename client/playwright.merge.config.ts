import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'ci-results/merged-results.json' }],
  ],
});
