import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

for (const width of [1280, 390]) {
  for (const role of ['VIEWER', 'OWNER']) {
    test(`backup controls for ${role} at ${width}px (mock API)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await seedPersistedWorkspace(page, { lang: 'en' });
      await mockAuthenticatedApi(page);
      let exports = 0;
      await page.route('http://localhost:3001/api/organizations/**', async (route) => {
        const req = route.request();
        if (req.method() === 'OPTIONS') return route.fallback();
        const path = new URL(req.url()).pathname;
        const headers = { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' };
        if (req.method() === 'GET' && path === '/api/organizations/me') {
          return route.fulfill({ headers, json: [{ id: 'org-r02', name: 'Backup Team', slug: 'backup-team', currentUserRole: role, memberCount: 1 }] });
        }
        if (req.method() === 'GET' && ['/api/organizations/invitations/me', '/api/organizations/org-r02/members', '/api/organizations/org-r02/teamspaces', '/api/organizations/org-r02/connections', '/api/organizations/org-r02/queries', '/api/organizations/org-r02/dashboards'].includes(path)) {
          return route.fulfill({ headers, json: [] });
        }
        if (req.method() === 'GET' && path === '/api/organizations/org-r02/backup') {
          exports++;
          return route.fulfill(exports === 1 ? { headers, json: { version: 1, organization: { id: 'org-r02' }, savedQueries: [], dashboards: [], erdWorkspaces: [], teamspaces: [], resourcePolicies: [] } } : { headers, status: 403, json: { message: 'Only owners and admins can perform this action' } });
        }
        return route.fallback();
      });
      await page.goto('/teams');
      const tab = page.getByRole('button', { name: 'Backups', exact: true });
      await tab.focus();
      await page.keyboard.press('Enter');
      if (role === 'VIEWER') {
        await expect(page.getByText('Only owners and admins can export or restore a full organization backup.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export backup', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Restore backup', exact: true })).toHaveCount(0);
        expect(exports).toBe(0);
      } else {
        const button = page.getByRole('button', { name: 'Export backup', exact: true });
        await expect(button).toBeEnabled();
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await button.focus();
        const download = page.waitForEvent('download');
        await page.keyboard.press('Enter');
        expect((await download).suggestedFilename()).toBe('data-explorer-backup-backup-team.json');
        await expect(page.getByRole('textbox', { name: 'Restore backup' })).toHaveValue(/org-r02/);
        await button.click();
        await expect(page.getByText('Only owners and admins can perform this action')).toBeVisible();
        const a11y = await new AxeBuilder({ page }).include('.grid.gap-4.p-4').analyze();
        expect(a11y.violations).toEqual([]);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
}
