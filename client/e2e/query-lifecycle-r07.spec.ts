import { expect, test, type Page, type Route } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

type Payload = { connectionId: string; sql: string };
const headers = { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true' };
const respond = (route: Route, value: unknown) => route.fulfill({ headers, json: value });
const connections = [
  { id: 'connection-e2e', name: 'Protected Analytics', type: 'postgres', host: 'fixture', database: 'analytics', allowQueryExecution: true, lastHealthStatus: 'healthy' },
  { id: 'connection-next', name: 'Second Analytics', type: 'postgres', host: 'fixture', database: 'analytics', allowQueryExecution: true, lastHealthStatus: 'healthy' },
];

async function openQueries(page: Page, twoTabs = false) {
  const calls: Payload[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tabs = ['R07 first', ...(twoTabs ? ['R07 second'] : [])].map((title, i) => ({ id: `r07-tab-${i}`, title, type: 'query', metadata: { sql: 'SELECT 1 AS old_value', executedQuery: 'SELECT 1 AS old_value' } }));
  await seedPersistedWorkspace(page, { lang: 'en', connections, activeConnectionId: 'connection-e2e', activeDatabase: 'analytics', tabs, activeTabId: 'r07-tab-0', isSidebarOpen: true, isAiPanelOpen: false, isResultPanelOpen: true });
  const attach = async (target: Page) => {
  await mockAuthenticatedApi(target);
  await target.route('http://localhost:3001/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === 'GET' && path === '/api/connections') return respond(route, connections);
    if (req.method() === 'POST' && path === '/api/connections/connection-next/health-check') return respond(route, { status: 'healthy', latencyMs: 1 });
    if (req.method() === 'POST' && path === '/api/metadata/hierarchy') return respond(route, []);
    if (req.method() === 'POST' && path === '/api/ai/autocomplete') return respond(route, { completion: '' });
    if (req.method() === 'GET' && path === '/api/ai/chats/chat-e2e') return respond(route, { id: 'chat-e2e', title: 'Fixture chat', messages: [] });
    if (req.method() === 'POST' && path === '/api/query') {
      const payload = req.postDataJSON() as Payload;
      calls.push(payload);
      const first = calls.length === 1;
      if (first) await gate;
      const key = first || payload.sql.includes('old_value') && !twoTabs ? 'old_value' : 'current_value';
      await respond(route, { rows: [{ [key]: first ? 'old response' : 'current response' }], columns: [key], rowCount: 1, countStatus: 'skipped', durationMs: 1 });
      return;
    }
    return route.fallback();
  });
  };
  await attach(page);
  await page.goto('/sql-explorer');
  await page.getByRole('button', { name: 'Execute', exact: true }).first().waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Execute', exact: true }).first().click();
  await expect.poll(() => calls.length).toBeGreaterThanOrEqual(1);
  return { calls, release, attach };
}

test('switching connection does not rerun old SQL and a late response cannot replace the new run', async ({ page }) => {
  let aborted = false;
  page.on('requestfailed', req => {
    if (new URL(req.url()).pathname === '/api/query' && req.postDataJSON()?.connectionId === 'connection-e2e') aborted = true;
  });
  const f = await openQueries(page);
  try {
    await page.getByRole('combobox').filter({ hasText: 'Protected Analytics' }).click();
    await page.getByRole('option', { name: /^Second Analytics\b/ }).click();
    const editor = page.locator('.monaco-editor .view-lines').first();
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText('SELECT 2 AS current_value');
    await expect(page.locator('.monaco-editor .view-lines').first()).toContainText('current_value');
    await page.getByRole('button', { name: 'Execute', exact: true }).first().click();
    await expect(page.getByText('current response', { exact: true })).toBeVisible();
    f.release();
    expect(f.calls.map(call => ({ connectionId: call.connectionId, sql: call.sql }))).toEqual([
      { connectionId: 'connection-e2e', sql: 'SELECT 1 AS old_value' },
      { connectionId: 'connection-next', sql: 'SELECT 2 AS current_value' },
    ]);
    await expect.poll(() => aborted).toBe(true);
    await expect(page.getByText('old response', { exact: true })).not.toBeVisible();
    await expect(page.getByText('current response', { exact: true })).toBeVisible();
  } finally { f.release(); }
});

test('two query tabs with the same SQL have independent execution results', async ({ page }) => {
  const f = await openQueries(page, true);
  try {
    await page.getByText('R07 second', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Execute', exact: true }).first().click();
    f.release();
    await expect.poll(() => f.calls.length).toBe(2);
    await expect(page.getByText('current response', { exact: true })).toBeVisible();
    await expect(page.getByText('old response', { exact: true })).not.toBeVisible();
  } finally { f.release(); }
});

test('reloading after a connection switch never executes the persisted SQL on the new target', async ({ page }) => {
  const f = await openQueries(page);
  const restored = await page.context().newPage();
  try {
    await page.getByRole('combobox').filter({ hasText: 'Protected Analytics' }).click();
    await page.getByRole('option', { name: /^Second Analytics\b/ }).click();
    f.release();
    await f.attach(restored);
    await restored.goto('/sql-explorer');
    await restored.getByRole('combobox').filter({ hasText: 'Second Analytics' }).waitFor({ state: 'visible' });
    await restored.getByRole('button', { name: /^(Execute|Thực thi)$/ }).first().waitFor({ state: 'visible' });
    await restored.waitForLoadState('networkidle');
    expect(f.calls.map(call => call.connectionId)).toEqual(['connection-e2e']);
    await expect(restored.locator('.monaco-editor .view-lines').first()).toContainText('SELECT 1 AS old_value');
    await restored.getByRole('button', { name: /^(Execute|Thực thi)$/ }).first().click();
    await expect(restored.getByText('current response', { exact: true })).toBeVisible();
    expect(f.calls.map(call => ({ connectionId: call.connectionId, sql: call.sql }))).toEqual([
      { connectionId: 'connection-e2e', sql: 'SELECT 1 AS old_value' },
      { connectionId: 'connection-next', sql: 'SELECT 1 AS old_value' },
    ]);
  } finally { f.release(); await restored.close(); }
});
