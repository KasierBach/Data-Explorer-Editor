import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicPages = [
  { route: '/', canonical: 'https://data-explorer-editor.vercel.app' },
  { route: '/docs', canonical: 'https://data-explorer-editor.vercel.app/docs' },
  { route: '/changelog', canonical: 'https://data-explorer-editor.vercel.app/changelog' },
  { route: '/legal', canonical: 'https://data-explorer-editor.vercel.app/legal' },
  { route: '/privacy', canonical: 'https://data-explorer-editor.vercel.app/privacy' },
  { route: '/terms', canonical: 'https://data-explorer-editor.vercel.app/terms' },
] as const;

for (const pageInfo of publicPages) {
  test(`${pageInfo.route} has crawlable metadata`, async ({ page }) => {
    await page.goto(pageInfo.route);
    await expect(page).toHaveTitle(/Data Explorer/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', pageInfo.canonical);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  });
}

for (const route of ['/', '/docs', '/changelog'] as const) {
  test(`${route} has no automatic WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
