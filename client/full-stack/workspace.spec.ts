import { expect, test, type Locator, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
const { PrismaClient }: typeof import('../../server/node_modules/@prisma/client') = serverRequire('@prisma/client');
const { PrismaPg }: typeof import('../../server/node_modules/@prisma/adapter-pg') = serverRequire('@prisma/adapter-pg');
const { Pool }: typeof import('../../server/node_modules/@types/pg') = serverRequire('pg');
const bcrypt: typeof import('../../server/node_modules/bcryptjs') = serverRequire('bcryptjs');
const { createE2eEnvironment } = serverRequire('./test/e2e-environment.cjs');
const fixtureEnv = createE2eEnvironment(process.env);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: fixtureEnv.DATABASE_URL }) });
const database = new Pool({ connectionString: fixtureEnv.DATABASE_URL });
const suffix = randomUUID().replaceAll('-', '');
const queryTable = `r10_browser_query_${suffix}`;
const rowTable = `r10_browser_rows_${suffix}`;
const emails = [`r10-browser-a-${suffix}@example.com`, `r10-browser-b-${suffix}@example.com`];
const password = 'R10Browser!Passw0rd';
const api = 'http://127.0.0.1:3001/api';
const connectionName = `R10 Browser ${suffix}`;
const savedName = `R10 Saved ${suffix}`;

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/^Email$/).fill(email);
  await page.getByLabel(/^(Password|Mật khẩu)$/).fill(password);
  const loginResponse = page.waitForResponse(response => response.url() === `${api}/auth/login` && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^(Sign in with email|Đăng nhập bằng Email)$/ }).click();
  const response = await loginResponse;
  expect(response.status()).toBe(200);
  const payload: { data?: { access_token?: string }; access_token?: string } = await response.json();
  const token = payload.data?.access_token ?? payload.access_token;
  if (typeof token !== 'string' || !token) throw new Error('UI login did not return an access token');
  await expect(page).toHaveURL(/sql-explorer/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  return token;
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 120; index += 1) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    const backwards = await target.evaluate(element => {
      const active = document.activeElement;
      return Boolean(active && active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING);
    });
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  await expect(target).toBeFocused();
}

async function typeField(page: Page, field: Locator, value: string) {
  await tabTo(page, field);
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(value);
}

async function replaceSql(page: Page, sql: string) {
  await page.locator('.monaco-editor .view-lines').first().click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(sql);
}

test.beforeAll(async () => {
  const hashed = await bcrypt.hash(password, 4);
  for (const email of emails) {
    await prisma.user.create({ data: {
      email, password: hashed, provider: 'local', role: 'user', language: 'en',
      isOnboarded: true, isEmailVerified: true, legalAcceptedAt: new Date(), securityAlerts: false,
    } });
  }
  for (const table of [queryTable, rowTable]) {
    await database.query(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY, note TEXT NOT NULL)`);
    await database.query(`INSERT INTO "${table}" VALUES ('001', 'first'), ('1', 'second')`);
  }
});

test.afterAll(async () => {
  try {
    for (const table of [queryTable, rowTable]) await database.query(`DROP TABLE IF EXISTS "${table}"`);
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    expect((await database.query('SELECT email FROM "User" WHERE email = ANY($1)', [emails])).rows).toEqual([]);
  } finally {
    await database.end();
    await prisma.$disconnect();
  }
});

test('real login, connection, query save/reload and destructive cancel/confirm', async ({ page }) => {
  await login(page, emails[0]);
  await page.getByRole('heading', { name: /^(New Connection|Kết nối mới)$/ }).click();
  const connectionDialog = page.getByRole('dialog');
  await connectionDialog.getByPlaceholder('e.g. Production DB').fill(connectionName);
  await connectionDialog.getByRole('tab', { name: 'Connection String (URI)', exact: true }).click();
  await connectionDialog.getByLabel('Paste URI / Connection String', { exact: true }).fill('postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e');
  await connectionDialog.getByRole('button', { name: 'Parse & Fill Form', exact: true }).click();
  const createdResponse = page.waitForResponse(response => response.url() === `${api}/connections` && response.request().method() === 'POST');
  await connectionDialog.getByRole('button', { name: /^(Save & Connect|Lưu & Kết nối)$/ }).click();
  expect((await createdResponse).status()).toBe(201);
  await expect(connectionDialog).not.toBeVisible();
  await page.getByRole('combobox').filter({ hasText: connectionName }).waitFor();
  await page.getByRole('heading', { name: /^(New Query|Truy vấn mới)$/ }).click();
  const sql = `SELECT * FROM "${queryTable}" ORDER BY id`;
  await replaceSql(page, sql);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(page.getByText('first', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+S');
  const saveDialog = page.getByRole('dialog');
  await saveDialog.getByPlaceholder('e.g. Revenue by week').fill(savedName);
  const savedResponse = page.waitForResponse(response => response.url() === `${api}/saved-queries` && response.request().method() === 'POST');
  await saveDialog.getByRole('button', { name: /^(Save query|Lưu truy vấn)$/ }).click();
  expect((await savedResponse).status()).toBe(201);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(queryTable);
  expect(await prisma.savedQuery.findMany({ where: { name: savedName }, select: { sql: true } })).toEqual([{ sql }]);
  await replaceSql(page, `DELETE FROM "${queryTable}"`);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const warning = page.getByRole('dialog');
  await warning.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await database.query(`SELECT id FROM "${queryTable}" ORDER BY id`)).rows).toEqual([{ id: '001' }, { id: '1' }]);
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  const confirmedResponse = page.waitForResponse(response => response.url() === `${api}/query` && response.request().method() === 'POST' && response.request().postDataJSON().confirmed === true);
  await warning.getByRole('button', { name: 'I reviewed this, run anyway', exact: true }).click();
  expect((await confirmedResponse).status()).toBe(201);
  expect((await database.query(`SELECT * FROM "${queryTable}"`)).rows).toEqual([]);
});

test('real keyboard login, connection, query save and Profile round-trip', async ({ page }) => {
  await page.goto('/login');
  const emailField = page.getByLabel(/^Email$/);
  await expect(emailField).toBeVisible();
  await typeField(page, emailField, emails[0]);
  await typeField(page, page.getByLabel(/^(Password|Mật khẩu)$/), password);
  await tabTo(page, page.getByRole('button', { name: /^(Sign in with email|Đăng nhập bằng Email)$/ }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/sql-explorer/);
  await tabTo(page, page.getByRole('button', { name: 'EN', exact: true }));
  await page.keyboard.press('Enter');

  const keyboardConnectionName = `${connectionName}-keyboard`;
  await tabTo(page, page.getByRole('button', { name: /New Connection Connect to a new/ }));
  await page.keyboard.press('Enter');
  const connectionDialog = page.getByRole('dialog');
  await expect(connectionDialog).toBeVisible();
  await typeField(page, connectionDialog.getByLabel('Display Name', { exact: true }), keyboardConnectionName);
  await typeField(page, connectionDialog.getByRole('textbox', { name: 'Host', exact: true }), '127.0.0.1');
  await typeField(page, connectionDialog.getByRole('textbox', { name: 'Port', exact: true }), '15432');
  await typeField(page, connectionDialog.getByRole('textbox', { name: 'Username', exact: true }), 'e2e');
  await typeField(page, connectionDialog.getByLabel('Password', { exact: true }), 'e2e-local-only');
  await typeField(page, connectionDialog.getByRole('textbox', { name: 'Database', exact: true }), 'data_explorer_e2e');
  await tabTo(page, connectionDialog.getByRole('button', { name: 'Save & Connect', exact: true }));
  const connectionCreated = page.waitForResponse(response => response.url() === `${api}/connections` && response.request().method() === 'POST');
  await page.keyboard.press('Enter');
  expect((await connectionCreated).status()).toBe(201);
  await expect(connectionDialog).not.toBeVisible();
  const instance = page.getByRole('combobox', { name: 'Select Instance', exact: true });
  await tabTo(page, instance);
  await page.keyboard.press('Enter');
  const option = page.getByRole('option', { name: new RegExp(`^${keyboardConnectionName}`) });
  await expect(option).toBeVisible();
  for (let index = 0; index < 20; index += 1) {
    if (await option.evaluate(element => element === document.activeElement)) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(option).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(instance).toContainText(keyboardConnectionName);

  await page.keyboard.press('Control+KeyN');
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeVisible();
  const editor = page.getByRole('textbox', { name: 'Editor content', exact: true });
  const sql = 'SELECT 42 AS keyboard_value';
  await typeField(page, editor, sql);
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('42', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+KeyS');
  const saveDialog = page.getByRole('dialog');
  await expect(saveDialog).toBeVisible();
  const keyboardSavedName = `${savedName}-keyboard`;
  await typeField(page, saveDialog.getByLabel('Display name', { exact: true }), keyboardSavedName);
  await tabTo(page, saveDialog.getByRole('button', { name: 'Save query', exact: true }));
  const querySaved = page.waitForResponse(response => response.url() === `${api}/saved-queries` && response.request().method() === 'POST');
  await page.keyboard.press('Enter');
  expect((await querySaved).status()).toBe(201);
  await expect(saveDialog).not.toBeVisible();
  expect(await prisma.savedQuery.findMany({ where: { name: keyboardSavedName }, select: { sql: true } })).toEqual([{ sql }]);

  await editor.press('Escape');
  await editor.press('Control+KeyM');
  await tabTo(page, page.getByRole('button', { name: 'Profile', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('menuitem', { name: /^Profile/ }));
  await page.keyboard.press('Enter');
  const profileDialog = page.getByRole('dialog');
  await expect(profileDialog.getByLabel('Email Address', { exact: true })).toHaveValue(emails[0]);
  await tabTo(page, profileDialog.getByRole('button', { name: 'Security', exact: true }));
  await page.keyboard.press('Enter');
  await expect(profileDialog.getByText('Not supported yet', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(profileDialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeFocused();
});

test('real typed row mutation and another user cannot read or write the private connection', async ({ page, browser }) => {
  const token = await login(page, emails[0]);
  const connection = await page.request.post(`${api}/connections`, {
    headers: { Authorization: `Bearer ${token}`, 'x-requested-with': 'XMLHttpRequest' },
    data: { name: `${connectionName}-rows`, type: 'postgres', host: '127.0.0.1', port: 15432,
      username: 'e2e', password: 'e2e-local-only', database: 'data_explorer_e2e', allowQueryExecution: true },
  });
  expect(connection.status()).toBe(201);
  const connectionId = (await connection.json()).data.id;
  await page.reload();
  await page.getByRole('combobox').filter({ hasText: connectionName }).click();
  await page.getByRole('option', { name: new RegExp(`^${connectionName}-rows`) }).click();
  await page.getByText(/^public$/i).first().click();
  await page.getByText(/^Tables$/i).first().click();
  await page.getByText(rowTable, { exact: true }).first().dblclick();
  await page.getByRole('button', { name: 'Edit Data', exact: true }).click();
  await page.getByRole('textbox', { name: 'note, row 1', exact: true }).fill('changed');
  const write = page.waitForResponse(response => response.url() === `${api}/query/row` && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  const written = await write;
  expect(written.status()).toBe(200);
  expect(written.request().postDataJSON().identity).toEqual([{ column: 'id', value: '001' }]);
  expect((await database.query(`SELECT * FROM "${rowTable}" ORDER BY id`)).rows).toEqual([{ id: '001', note: 'changed' }, { id: '1', note: 'second' }]);
  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    const otherToken = await login(other, emails[1]);
    await expect(other.getByText(`${connectionName}-rows`, { exact: true })).toHaveCount(0);
    const headers = { Authorization: `Bearer ${otherToken}`, 'x-requested-with': 'XMLHttpRequest' };
    const deniedRead = await other.request.post(`${api}/query`, { headers, data: { connectionId, sql: `SELECT * FROM "${rowTable}"` } });
    expect([403, 404]).toContain(deniedRead.status());
    const deniedWrite = await other.request.patch(`${api}/query/row`, { headers, data: {
      connectionId, schema: 'public', table: rowTable, pkColumn: 'id', pkValue: '001',
      identity: [{ column: 'id', value: '001' }], updates: { note: 'stolen' },
    } });
    expect([403, 404]).toContain(deniedWrite.status());
    expect((await database.query(`SELECT note FROM "${rowTable}" WHERE id = '001'`)).rows).toEqual([{ note: 'changed' }]);
  } finally {
    await otherContext.close();
  }
});
