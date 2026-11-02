import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

type Row = Record<string, string | number>;
type Key = { column: string; value: string | number };
type Mutation = { identity?: Key[]; identities?: Key[][]; updates?: Row; pkValue?: unknown };

async function openGrid(page: Page, initialRows: Row[], keys: string[], keyType = 'text') {
  const rows = initialRows.map(row => ({ ...row }));
  const writes: Mutation[] = [];
  await seedPersistedWorkspace(page, {
    lang: 'en', activeConnectionId: 'connection-e2e', activeDatabase: 'analytics',
    isSidebarOpen: false, isAiPanelOpen: false, isResultPanelOpen: false,
    tabs: [{ id: 'r04-tab', title: 'items', type: 'table', metadata: {
      tableId: 'db:analytics.schema:public.table:items', connectionId: 'connection-e2e',
      database: 'analytics', page: 1, pageSize: 100,
    } }], activeTabId: 'r04-tab',
  });
  await mockAuthenticatedApi(page);
  const respond = (route: Route, json: unknown) => route.fulfill({
    headers: { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' }, json,
  });
  await page.route('http://localhost:3001/api/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fallback();
    const path = new URL(req.url()).pathname;
    if (path === '/api/metadata/full') return respond(route, { columns: Object.keys(initialRows[0]).map(name => ({
      name, type: keys.includes(name) ? keyType : 'text', isPrimaryKey: keys.includes(name), isNullable: false,
    })) });
    if (path === '/api/query/table-window') return respond(route, {
      rows, columns: Object.keys(initialRows[0]), rowCount: rows.length, hasNextPage: false, countStatus: 'skipped',
    });
    if ((path === '/api/query/row' && req.method() === 'PATCH') || path === '/api/query/delete-rows') {
      const payload = req.postDataJSON() as Mutation;
      writes.push(payload);
      const matches = (row: Row, identity: Key[]) => identity.every(key => row[key.column] === key.value);
      if (payload.identity) {
        const target = rows.find(row => matches(row, payload.identity!));
        expect(target).toBeDefined(); Object.assign(target!, payload.updates);
        return respond(route, { success: true, rowCount: 1 });
      }
      const before = rows.length;
      for (let index = rows.length - 1; index >= 0; index--) {
        if (payload.identities?.some(identity => matches(rows[index], identity))) rows.splice(index, 1);
      }
      return respond(route, { success: true, rowCount: before - rows.length });
    }
    return route.fallback();
  });
  await page.goto('/sql-explorer');
  await expect(page.getByRole('button', { name: 'Edit Data', exact: true })).toBeVisible();
  return { rows, writes };
}

test('text 001 stays distinct through editing, cancel and confirmed delete (mock API)', async ({ page }) => {
  const { rows, writes } = await openGrid(page, [{ id: '001', note: 'first' }, { id: '1', note: 'second' }], ['id']);
  await page.getByRole('button', { name: 'Edit Data', exact: true }).click();
  await page.getByRole('textbox', { name: 'note, row 1', exact: true }).fill('changed');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ pkValue: '001', identity: [{ column: 'id', value: '001' }], updates: { note: 'changed' } });
  expect(rows).toEqual([{ id: '001', note: 'changed' }, { id: '1', note: 'second' }]);
  await page.getByRole('button', { name: 'Select row 1', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete (1)', exact: true }).click();
  expect(writes).toHaveLength(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete (1)', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].identities).toEqual([[{ column: 'id', value: '001' }]]);
  expect(rows).toEqual([{ id: '1', note: 'second' }]);
});

test('composite pending edits, selected replace and deletion keep full tuples (mock API)', async ({ page }) => {
  const { rows, writes } = await openGrid(page, [{ tenant: 'A', id: 1, note: 'a1' }, { tenant: 'A', id: 2, note: 'a2' }, { tenant: 'B', id: 1, note: 'b1' }], ['tenant', 'id']);
  await page.getByRole('button', { name: 'Edit Data', exact: true }).click();
  await page.getByRole('textbox', { name: 'note, row 1', exact: true }).fill('first');
  await page.getByRole('textbox', { name: 'note, row 2', exact: true }).fill('second');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes.map(write => write.identity)).toEqual([
    [{ column: 'tenant', value: 'A' }, { column: 'id', value: 1 }],
    [{ column: 'tenant', value: 'A' }, { column: 'id', value: 2 }],
  ]);
  await page.getByRole('button', { name: 'Select row 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select row 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Edit Data', exact: true }).click();
  await page.getByRole('button', { name: 'Find / Replace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'Scope', exact: true })).toHaveValue('selected');
  await dialog.getByRole('textbox', { name: 'Find', exact: true }).fill('second');
  await dialog.getByRole('textbox', { name: 'Replace with', exact: true }).fill('selected');
  await dialog.getByRole('button', { name: 'Apply Replace', exact: true }).click();
  await page.getByRole('button', { name: /Save Changes/ }).click();
  await expect.poll(() => writes.length).toBe(3);
  await page.screenshot({ path: `../output/roadmap-r04/grid-${test.info().project.name}.png`, fullPage: true });
  expect(writes[2]).toMatchObject({ identity: [{ column: 'tenant', value: 'A' }, { column: 'id', value: 2 }], updates: { note: 'selected' } });
  page.once('dialog', nativeDialog => nativeDialog.accept());
  await page.getByRole('button', { name: 'Delete (1)', exact: true }).click();
  await expect.poll(() => writes.length).toBe(4);
  expect(writes[3].identities).toEqual([[{ column: 'tenant', value: 'A' }, { column: 'id', value: 2 }]]);
  expect(rows).toEqual([{ tenant: 'A', id: 1, note: 'first' }, { tenant: 'B', id: 1, note: 'b1' }]);
});

for (const keyType of ['no-key', 'timestamp with time zone', 'decimal']) {
  test(`unsafe identity ${keyType} visibly disables row mutations (mock API)`, async ({ page }) => {
    const { writes } = await openGrid(page, [{ id: keyType === 'decimal' ? 1 : '2026-01-01T00:00:00.123Z', note: 'readable' }], keyType === 'no-key' ? [] : ['id'], keyType);
    await expect(page.getByRole('button', { name: 'Edit Data', exact: true })).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: 'complete, safe primary key' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select row 1', exact: true })).toBeDisabled();
    expect(writes).toEqual([]);
  });
}
