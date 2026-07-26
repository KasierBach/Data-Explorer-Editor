import { expect, test, type Page, type Route } from '@playwright/test';

const apiHeaders = {
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Authorization, Content-Type, X-Requested-With',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'access-control-allow-origin': 'http://127.0.0.1:4173',
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: apiHeaders,
    body: JSON.stringify(body),
  });
}

async function mockAuthenticatedApi(page: Page) {
  await page.route('http://localhost:3001/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: apiHeaders });
      return;
    }

    if (pathname === '/api/auth/refresh') {
      await fulfillJson(route, {
        access_token: 'e2e-access-token',
        accessTokenExpiresAt: 4_102_444_800,
        user: {
          id: 'user-e2e',
          email: 'operator@example.com',
          name: 'E2E Operator',
          role: 'USER',
          isOnboarded: true,
          legalAcceptedAt: '2026-07-23T00:00:00.000Z',
          language: 'en',
        },
      });
      return;
    }

    if (pathname === '/api/connections' && request.method() === 'GET') {
      await fulfillJson(route, [{
        id: 'connection-e2e',
        name: 'Protected Analytics',
        type: 'postgres',
        host: 'db.internal',
        port: 5432,
        database: 'analytics',
        allowQueryExecution: true,
        lastHealthStatus: 'healthy',
      }]);
      return;
    }

    if (pathname === '/api/query' && request.method() === 'POST') {
      const payload = request.postDataJSON() as { confirmed?: boolean };
      if (!payload.confirmed) {
        await fulfillJson(route, {
          message: 'This query requires confirmation.',
          reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
          details: {
            analysis: {
              requiresConfirmation: true,
              severity: 'high',
              keywords: ['DELETE'],
              affectedObject: 'users',
              objectType: 'table',
              impactScope: 'rows',
              reason: 'unbounded_row_mutation',
              statement: 'DELETE FROM users',
              summary: 'DELETE without a WHERE clause can remove every row.',
            },
          },
        }, 400);
        return;
      }

      await fulfillJson(route, {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 1,
      });
      return;
    }

    if (pathname === '/api/ai/nlp-to-sql' && request.method() === 'POST') {
      await fulfillJson(route, {
        sql: 'DELETE FROM users',
        explanation: 'Deletes every user row.',
        generationId: '2c1cc849-e91f-4d54-9a40-9ac7c3f5d37f',
      });
      return;
    }

    if (pathname === '/api/ai/sql-feedback' && request.method() === 'POST') {
      await fulfillJson(route, { success: true });
      return;
    }

    if (pathname.endsWith('/health-check')) {
      await fulfillJson(route, {
        status: 'healthy',
        checkedAt: '2026-07-23T00:00:00.000Z',
        latencyMs: 4,
        error: null,
      });
      return;
    }

    if (pathname === '/api/notifications/stream-ticket') {
      await fulfillJson(route, { ticket: 'e2e-ticket' });
      return;
    }

    if (pathname === '/api/notifications/stream') {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { ...apiHeaders, 'cache-control': 'no-cache' },
        body: ': connected\n\n',
      });
      return;
    }

    await fulfillJson(route, []);
  });
}

test('restores an authenticated workspace and guards destructive SQL', async ({ page }) => {
  await mockAuthenticatedApi(page);

  await page.goto('/sql-explorer');

  await expect(page).toHaveURL(/\/sql-explorer$/);
  await expect(page.getByRole('combobox').filter({ hasText: 'Protected Analytics' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('heading', { name: /^(New Query|Truy vấn mới)$/ }).click();
  await page.getByRole('button', { name: 'AI SQL' }).click();
  await page.getByText(/^(Type natural language to generate SQL\.\.\.|Gõ tiếng Việt để sinh SQL, ví dụ: 10 khách hàng mới nhất\.\.\.)$/).click();
  await page.getByPlaceholder(/^(Describe what you want to query in natural language\.\.\.|Mô tả yêu cầu của bạn bằng tiếng Việt hoặc tiếng Anh\.\.\.)$/).fill('Remove inactive users');
  await page.getByRole('button', { name: /^(Generate SQL|Sinh SQL)$/ }).click();
  await expect(page.getByText(/^(Review AI-generated SQL|Kiểm tra SQL do AI tạo)$/)).toBeVisible();
  await expect(page.getByText('DELETE FROM users', { exact: true })).toBeVisible();
  const usefulFeedback = page.getByRole('button', { name: /^(Useful|Hữu ích)$/ });
  await usefulFeedback.click();
  await expect(usefulFeedback).toBeDisabled();
  await page.getByRole('button', { name: /^(Insert into editor|Chèn vào editor)$/ }).click();
  await page.getByRole('button', { name: /^(Execute|Thực thi)$/ }).click();

  const warning = page.getByRole('dialog');
  await expect(warning.getByText(/^(HIGH SEVERITY WARNING|CẢNH BÁO NGHIÊM TRỌNG)$/)).toBeVisible();
  await expect(warning.getByText('DELETE FROM users', { exact: true })).toBeVisible();
  await expect(warning.getByRole('button', { name: /^(I reviewed this, run anyway|Tôi đã review, vẫn chạy)$/ })).toBeVisible();
});
