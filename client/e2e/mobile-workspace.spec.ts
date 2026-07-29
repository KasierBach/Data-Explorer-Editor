import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

async function expectNoDocumentOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth + 1
  ))).toBe(true);
}

async function expectTouchTargets(locator: Locator) {
  const boxes = await locator.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));

  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApi(page);
});

test('mobile SQL shell exposes touch-safe workspace controls and AI input', async ({ page }) => {
  await seedPersistedWorkspace(page, {
    activeConnectionId: 'connection-e2e',
    activeDatabase: 'analytics',
    isSidebarOpen: false,
    isAiPanelOpen: false,
    isResultPanelOpen: false,
    isDesktopModeOnMobile: false,
  });

  await page.goto('/sql-explorer');
  await expect(page).toHaveURL(/\/sql-explorer$/);

  const explorerButton = page.getByRole('button', { name: 'Explorer', exact: true });
  const resultsButton = page.getByRole('button', { name: 'Results', exact: true });
  const desktopButton = page.getByRole('button', { name: 'Turn on desktop mode', exact: true });
  const aiButton = page.getByRole('button', { name: 'AI', exact: true });

  await expect(explorerButton).toBeVisible({ timeout: 30_000 });
  await expectTouchTargets(explorerButton.or(resultsButton).or(desktopButton).or(aiButton));
  await expectNoDocumentOverflow(page);

  await explorerButton.click();
  await expect(page.getByRole('combobox').filter({ hasText: 'Protected Analytics' })).toBeVisible();

  await aiButton.click();
  const aiInput = page.locator('textarea').last();
  await expect(aiInput).toBeVisible();
  const inputFontSize = await aiInput.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(inputFontSize).toBeGreaterThanOrEqual(16);
  await expectNoDocumentOverflow(page);
});

test('mobile NoSQL shell restores collection context and renders query results', async ({ page }) => {
  await seedPersistedWorkspace(page, {
    nosqlActiveConnectionId: 'mongo-e2e',
    nosqlActiveDatabase: 'warehouse',
    nosqlActiveCollection: 'products',
    nosqlMqlQuery: JSON.stringify({
      action: 'find',
      collection: 'products',
      filter: {},
      options: {},
      limit: 50,
    }, null, 2),
    nosqlViewMode: 'tree',
    isSidebarOpen: false,
    isAiPanelOpen: false,
    isResultPanelOpen: false,
    isDesktopModeOnMobile: false,
  });

  await page.goto('/nosql-explorer');
  await expect(page).toHaveURL(/\/nosql-explorer$/);
  await expect(page.getByText('db.products', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expectNoDocumentOverflow(page);

  await page.locator('main button').filter({ has: page.locator('svg.lucide-play') }).click();
  await expect(page.getByText('Ada Lovelace', { exact: false })).toBeVisible();
  await expectNoDocumentOverflow(page);
});
