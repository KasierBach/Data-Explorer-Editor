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

async function mockAuthApi(page: Page) {
    await page.route('http://localhost:3001/api/**', async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());

        if (request.method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: apiHeaders });
            return;
        }

        if (pathname === '/api/auth/login' && request.method() === 'POST') {
            const payload = request.postDataJSON() as { email?: string };
            if (payload.email === 'operator@example.com') {
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

            await fulfillJson(route, { message: 'Invalid credentials' }, 401);
            return;
        }

        if (pathname === '/api/auth/refresh') {
            await fulfillJson(route, { message: 'Session expired' }, 401);
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

test.beforeEach(async ({ page }) => {
    await mockAuthApi(page);
});

test('login with valid credentials reaches the workspace', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login$/);

    await page.locator('#email').fill('operator@example.com');
    await page.locator('#password').fill('correct-horse-battery');
    await page.getByRole('button', { name: /^(Sign in|Đăng nhập|Log in|Đăng nhập bằng Email|Sign in with Email)$/ }).click();

    await expect(page).toHaveURL(/\/(sql-explorer|onboarding|legal-consent)/, { timeout: 30_000 });
});

test('login with wrong credentials shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('intruder@example.com');
    await page.locator('#password').fill('wrong-password');
    await page.getByRole('button', { name: /^(Sign in|Đăng nhập|Log in|Đăng nhập bằng Email|Sign in with Email)$/ }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login$/);
});

test('unauthenticated access to the workspace redirects to login', async ({ page }) => {
    await page.goto('/sql-explorer');

    await expect(page).toHaveURL(/\/login$/);
});
