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
    lang: 'en',
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

test('mobile workspace controls use the active Vietnamese language', async ({ page }) => {
  await seedPersistedWorkspace(page, {
    lang: 'vi',
    activeConnectionId: 'connection-e2e',
    activeDatabase: 'analytics',
    isSidebarOpen: false,
    isAiPanelOpen: false,
    isResultPanelOpen: false,
    isDesktopModeOnMobile: false,
  });

  await page.goto('/sql-explorer');
  const explorerButton = page.getByRole('button', { name: 'Khám phá', exact: true });
  await explorerButton.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(explorerButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kết quả', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bật chế độ máy tính', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'AI', exact: true })).toBeVisible();
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

for (const route of ['/sql-explorer', '/nosql-explorer'] as const) {
  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`mobile language pill stays reachable in ${route} at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedPersistedWorkspace(page, { tabs: [], activeTabId: null, nosqlActiveCollection: null, isSidebarOpen: false, isAiPanelOpen: false });
      await page.goto(route);
      const control = page.locator('main [data-appearance="pill"]');
      await expect(control).toBeVisible();
      await expectTouchTargets(control.getByRole('button'));
      await expectNoDocumentOverflow(page);
      const hit = await control.getByRole('button', { name: 'VN', exact: true }).evaluate(element => {
        const box = element.getBoundingClientRect();
        const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return Boolean(target && (element === target || element.contains(target)));
      });
      expect(hit).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`language-pill-${viewport.width}.png`) });
      await control.getByRole('button', { name: 'VN', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
      await expect(control.getByRole('button', { name: 'VN', exact: true })).toHaveAttribute('aria-pressed', 'true');
    });
  }
}
