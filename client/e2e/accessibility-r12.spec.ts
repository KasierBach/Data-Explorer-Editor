import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApi(page);
  await seedPersistedWorkspace(page, { lang: 'en', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
});

test('R12 Profile traps focus, associates labels, closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/sql-explorer');
  const trigger = page.getByRole('button', { name: 'Profile', exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: /^Profile/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('First Name', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Email Address', { exact: true })).toHaveValue('operator@example.com');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Security', exact: true }).click();
  await expect(dialog.getByLabel('Current Password', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Not supported yet', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Enable 2FA/i })).toHaveCount(0);
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('R12 avatar editor traps child focus and restores both dialog openers', async ({ page }) => {
  await page.goto('/sql-explorer');
  const trigger = page.getByRole('button', { name: 'Profile', exact: true });
  await trigger.click();
  await page.getByRole('menuitem', { name: /^Profile/ }).click();
  const profile = page.getByRole('dialog', { name: 'Account Settings', exact: true });
  const opener = profile.getByRole('button', { name: 'Change Avatar', exact: true });
  await expect(opener).toBeVisible();
  const fileChooser = page.waitForEvent('filechooser');
  await opener.click();
  await (await fileChooser).setFiles({
    name: 'avatar-fixture.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=', 'base64'),
  });
  const child = page.getByRole('dialog', { name: 'Edit avatar', exact: true });
  await expect(child).toBeVisible();
  await expect(child.getByRole('slider')).toHaveCount(3);
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press(index % 3 === 0 ? 'Shift+Tab' : 'Tab');
    await expect.poll(() => child.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  const scan = await new AxeBuilder({ page }).include('[role="dialog"]:not([aria-hidden="true"])').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(child).toHaveCount(0);
  await expect(profile).toBeVisible();
  await expect(opener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(profile).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('R12 Profile close action follows Vietnamese locale', async ({ page }) => {
  await seedPersistedWorkspace(page, { lang: 'vi', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
  await page.goto('/sql-explorer');
  await page.getByRole('button', { name: 'Hồ sơ', exact: true }).click();
  await page.getByRole('menuitem', { name: /^Hồ sơ/ }).click();
  const profile = page.getByRole('dialog', { name: 'Cài đặt tài khoản', exact: true });
  await expect(profile.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
});

test('R12 language survives public route unmount and workspace reload', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/sql-explorer');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
