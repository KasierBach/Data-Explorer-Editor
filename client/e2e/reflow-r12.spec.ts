import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 100; index += 1) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    const backwards = await target.evaluate(element => {
      const active = document.activeElement;
      return Boolean(active && active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING);
    });
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  await expect(target).toBeFocused();
}

async function expectDialogInViewport(dialog: Locator) {
  await expect.poll(() => dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;
  })).toBe(true);
}

for (const width of [320, 640]) {
  for (const lang of ['en', 'vi']) {
    for (const theme of ['light', 'dark']) {
      test(`R12 reflow and modal keyboard ${width} ${lang} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await mockAuthenticatedApi(page);
        await seedPersistedWorkspace(page, { lang, theme, activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
        await page.goto('/sql-explorer');
        const profile = page.getByRole('button', { name: lang === 'vi' ? 'Hồ sơ' : 'Profile', exact: true });
        await expect(profile).toBeVisible();
        await tabTo(page, profile);
        await page.keyboard.press('Enter');
        const profileItem = page.getByRole('menuitem', { name: lang === 'vi' ? /^Hồ sơ/ : /^Profile/ });
        await profileItem.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expectDialogInViewport(dialog);
        for (let index = 0; index < 25; index += 1) {
          await page.keyboard.press('Tab');
          await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
        }
        const scan = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(profile).toBeFocused();
        await profile.click();
        await profileItem.click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await tabTo(page, page.getByRole('button', { name: 'NoSQL', exact: true }));
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/nosql-explorer$/);
        await expect(page.getByRole('heading', {
          name: lang === 'vi' ? 'Kết nối NoSQL gần đây' : 'Recent NoSQL Connections',
          exact: true,
        })).toBeVisible();
        await expect(page.getByRole('button', { name: 'NoSQL', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await tabTo(page, page.getByRole('button', { name: 'SQL', exact: true }));
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/sql-explorer$/);
      });
    }
  }
}

test('R12 save query form has labels and a keyboard-reachable named action', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await seedPersistedWorkspace(page, { lang: 'en', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
  await page.goto('/sql-explorer');
  const newQuery = page.getByRole('button', { name: /New Query Open a SQL editor/ });
  await expect(newQuery).toBeVisible();
  await tabTo(page, newQuery);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Editor content', exact: true });
  await expect(page.locator('.monaco-editor').first()).toBeVisible();
  await expect(editor).toBeAttached();
  await tabTo(page, editor);
  await expect(editor).toBeFocused();
  await page.keyboard.insertText('SELECT 1 AS value');
  await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('SELECT 1 AS value');
  await page.keyboard.press('Control+KeyS');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  await expect(dialog.getByLabel('Display name', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Visibility', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Tags (comma-separated)', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
