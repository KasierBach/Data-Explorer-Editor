import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

for (const width of [360, 390, 412, 768, 1024, 1280, 1440]) {
  for (const language of ['en', 'vi']) {
    for (const theme of ['light', 'dark']) {
      for (const withTimer of [false, true]) {
        test(`R11 header controls remain reachable ${width} ${language} ${theme} timer=${withTimer}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await mockAuthenticatedApi(page);
          await page.route('http://localhost:3001/api/auth/refresh', async route => {
            await route.fulfill({
              json: {
                access_token: 'e2e-access-token',
                accessTokenExpiresAt: withTimer ? Math.floor(Date.now() / 1000) + 1800 : undefined,
                user: { id: 'user-e2e', email: 'operator@example.test', name: 'Operator', role: 'USER', isOnboarded: true, legalAcceptedAt: '2026-07-23T00:00:00.000Z', language },
              },
              headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' },
            });
          });
          await seedPersistedWorkspace(page, { lang: language, theme, activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', isSidebarOpen: false, isAiPanelOpen: false });
          await page.goto('/sql-explorer');
          const sql = page.getByRole('button', { name: 'SQL', exact: true });
          const noSql = page.getByRole('button', { name: 'NoSQL', exact: true });
          await sql.waitFor({ state: 'visible', timeout: 5_000 });
          await expect(sql).toBeVisible();
          const header = sql.locator('xpath=ancestor::*[@data-testid="workspace-header"]');
          await expect(header).toBeVisible();
          const timerShouldBeVisible = withTimer && width > 480;
          await expect(header.locator('[title="Session Expiration Time"]')).toHaveCount(timerShouldBeVisible ? 1 : 0);
          const expectHeaderGeometry = async () => {
            await expect.poll(() => header.locator('button:visible').evaluateAll(buttons => {
              const boxes = buttons.map(button => ({ button, rect: button.getBoundingClientRect() }));
              return boxes.flatMap(({ button, rect }, i) => {
                const errors: string[] = [];
                if (rect.left < 0 || rect.right > innerWidth + 1 || rect.width < 24 || rect.height < 24) errors.push(`bounds:${button.textContent}`);
                for (const other of boxes.slice(i + 1)) {
                  if (Math.min(rect.right, other.rect.right) - Math.max(rect.left, other.rect.left) > 1 && Math.min(rect.bottom, other.rect.bottom) - Math.max(rect.top, other.rect.top) > 1) errors.push(`overlap:${button.textContent}/${other.button.textContent}`);
                }
                return errors;
              });
            })).toEqual([]);
          };
          await expectHeaderGeometry();
          await noSql.click();
          await expect(page).toHaveURL(/\/nosql-explorer$/);
          await expect(noSql).toHaveAttribute('aria-pressed', 'true');
          await expectHeaderGeometry();
          await page.getByRole('button', { name: 'SQL', exact: true }).click();
          await expect(page).toHaveURL(/\/sql-explorer$/);
          const oppositeThemeLabel = language === 'vi'
            ? (theme === 'light' ? 'Tối' : 'Sáng')
            : (theme === 'light' ? 'Dark' : 'Light');
          await header.getByRole('button', { name: oppositeThemeLabel, exact: true }).click();
          await expect(page.locator('html')).toHaveClass(new RegExp(theme === 'light' ? 'dark' : 'light'));
          await header.getByRole('button', { name: language === 'vi' ? 'Nhóm' : 'Teams', exact: true }).click();
          await expect(page).toHaveURL(/\/teams$/);
        });
      }
    }
  }
}
