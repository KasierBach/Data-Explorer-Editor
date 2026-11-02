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

test('R12 language survives public route unmount and workspace reload', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/sql-explorer');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
