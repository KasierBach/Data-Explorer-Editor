import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi, seedPersistedWorkspace } from './support/authenticated-api';

/**
 * Billing return flow: after the MoMo/ZaloPay redirect, /billing/return
 * verifies the payment and reflects the resulting plan state. These tests
 * mock the status endpoint for paid / pending / failed outcomes.
 */

const persistedAuthState = {
    auth: {
        user: {
            id: 'user-e2e',
            email: 'operator@example.com',
            name: 'E2E Operator',
            role: 'USER',
            isOnboarded: true,
            legalAcceptedAt: '2026-07-23T00:00:00.000Z',
            language: 'en',
        },
        accessToken: 'e2e-access-token',
        accessTokenExpiresAt: 4_102_444_800,
        isBootstrapped: true,
    },
};

const paidUser = {
    id: 'user-e2e',
    email: 'operator@example.com',
    name: 'E2E Operator',
    role: 'USER',
    isOnboarded: true,
    legalAcceptedAt: '2026-07-23T00:00:00.000Z',
    language: 'en',
    plan: 'pro',
    subscriptionStatus: 'active',
};

test.describe('billing return page', () => {
    test('shows the Pro active state after a confirmed payment', async ({ page }) => {
        await mockAuthenticatedApi(page);
        await page.route('http://localhost:3001/api/billing/status/payment-e2e', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    payment: { id: 'payment-e2e', status: 'paid', planCode: 'pro_monthly' },
                    user: paidUser,
                }),
            });
        });
        await seedPersistedWorkspace(page, persistedAuthState);

        await page.goto('/billing/return?paymentId=payment-e2e');

        await expect(page.getByRole('heading', { name: 'Pro is active' })).toBeVisible();
        await expect(
            page.getByText('Your billing status has been refreshed from the confirmed payment.'),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'Back to workspace' })).toBeVisible();
    });

    test('keeps the pending state when the provider webhook has not landed yet', async ({ page }) => {
        await mockAuthenticatedApi(page);
        await page.route('http://localhost:3001/api/billing/status/payment-e2e', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    payment: { id: 'payment-e2e', status: 'pending', planCode: 'pro_monthly' },
                    user: persistedAuthState.auth.user,
                }),
            });
        });
        await seedPersistedWorkspace(page, persistedAuthState);

        await page.goto('/billing/return?paymentId=payment-e2e');

        await expect(page.getByRole('heading', { name: 'Payment is pending' })).toBeVisible();
        await expect(
            page.getByText('The provider has not confirmed the payment yet.'),
        ).toBeVisible();
    });

    test('fails safely when the payment cannot be verified', async ({ page }) => {
        await mockAuthenticatedApi(page);
        await page.route('http://localhost:3001/api/billing/status/payment-e2e', async (route) => {
            await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        });
        await seedPersistedWorkspace(page, persistedAuthState);

        await page.goto('/billing/return?paymentId=payment-e2e');

        await expect(page.getByRole('heading', { name: 'Could not verify payment' })).toBeVisible();
    });

    test('fails safely when the paymentId query parameter is missing', async ({ page }) => {
        await mockAuthenticatedApi(page);
        await seedPersistedWorkspace(page, persistedAuthState);

        await page.goto('/billing/return');

        await expect(page.getByRole('heading', { name: 'Could not verify payment' })).toBeVisible();
    });
});
