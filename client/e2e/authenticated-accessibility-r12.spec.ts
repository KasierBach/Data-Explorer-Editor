import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

async function openWorkspace(page: Parameters<typeof seedPersistedWorkspace>[0], theme = 'light') {
  await seedPersistedWorkspace(page, { lang: 'en', theme, activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false });
  await page.goto('/sql-explorer');
}

async function openQueryResult(page: Parameters<typeof seedPersistedWorkspace>[0]) {
  const newQuery = page.getByRole('button', { name: /New Query/i }).first();
  await newQuery.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Query 1|New Query/).first()).toBeVisible();
  const editor = page.locator('.monaco-editor .view-lines').first();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('{"action":"find"}');
  await page.locator('main button').filter({ has: page.locator('svg.lucide-play') }).first().click();
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApi(page);
});

for (const lang of ['en', 'vi']) {
  test(`R12 recent connection actions are named and visible on keyboard focus in ${lang}`, async ({ page }) => {
    await seedPersistedWorkspace(page, { lang, activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
    await page.goto('/sql-explorer');
    const editName = lang === 'vi' ? 'Chỉnh sửa kết nối' : 'Edit Connection';
    const deleteName = lang === 'vi' ? 'Xóa kết nối' : 'Delete connection';
    const edits = page.locator('main').getByRole('button', { name: editName, exact: true });
    await expect(edits).toHaveCount(2);
    await expect(page.locator('main').getByRole('button', { name: new RegExp(`^${deleteName}: `) })).toHaveCount(2);
    await edits.first().focus();
    await expect(edits.first()).toBeFocused();
    await expect.poll(() => edits.first().evaluate(element => getComputedStyle(element).opacity)).toBe('1');
    const scan = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
}

for (const theme of ['light', 'dark']) {
  test(`R12 dashboard actions, result region and axe scan work in ${theme}`, async ({ page }) => {
    await openWorkspace(page, theme);
    await openQueryResult(page);
    const resultRegion = page.getByRole('region', { name: 'Query result' });
    await expect(resultRegion).toBeVisible();
    await resultRegion.focus();
    await expect(resultRegion).toBeFocused();
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
}

test('R12 AI labels and welcome content follow the active language', async ({ page }) => {
  await seedPersistedWorkspace(page, { lang: 'en', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: true });
  await page.goto('/sql-explorer');
  await expect(page.getByPlaceholder('Ask about SQL, coding, or your database...')).toBeVisible();
  await expect(page.getByText(/Hello! I am your AI Assistant/)).toBeVisible();
  await expect(page.getByTitle('AI is on (click to turn off)')).toBeVisible();

  await page.getByRole('button', { name: 'VN', exact: true }).click();
  await expect(page.getByPlaceholder('Hỏi về SQL, lập trình hoặc database...')).toBeVisible();
  await expect(page.getByText(/Xin chào! Tôi là AI Assistant/)).toBeVisible();
  await expect(page.getByTitle('AI đang bật (bấm để tắt)')).toBeVisible();
});

test('R12 connection form fields have programmatic labels and no serious axe findings', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: /New Connection/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Display Name')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Host', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Port', exact: true })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Username', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Password', { exact: true })).toBeVisible();
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
});
