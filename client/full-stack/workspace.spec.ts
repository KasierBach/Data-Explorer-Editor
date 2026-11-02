import { expect, test, type Page } from '@playwright/test';
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
  await page.getByRole('button', { name: /^(Sign in with email|Đăng nhập bằng Email)$/ }).click();
  await expect(page).toHaveURL(/sql-explorer/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
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

test('real typed row mutation and another user cannot read or write the private connection', async ({ page, browser }) => {
  await login(page, emails[0]);
  const response = await page.request.post(`${api}/auth/login`, { data: { email: emails[0], password } });
  expect(response.status()).toBe(200);
  const token = (await response.json()).data.access_token;
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
    await login(other, emails[1]);
    await expect(other.getByText(`${connectionName}-rows`, { exact: true })).toHaveCount(0);
    const otherLogin = await other.request.post(`${api}/auth/login`, { data: { email: emails[1], password } });
    const otherToken = (await otherLogin.json()).data.access_token;
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
