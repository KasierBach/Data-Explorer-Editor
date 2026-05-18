import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillingTab } from './BillingTab';

describe('BillingTab', () => {
  const renderBilling = (plan = 'free') => {
    const actions = {
      handleStartCheckout: vi.fn(),
      handleRefreshBilling: vi.fn(),
    };

    render(
      <BillingTab
        user={{
          email: 'admin@dataexplorer.com',
          plan,
          planExpiresAt: plan === 'pro' ? '2026-06-17T00:00:00.000Z' : undefined,
          subscriptionStatus: plan === 'pro' ? 'active' : 'inactive',
        }}
        t={(key) => key}
        isLoading={false}
        actions={actions}
      />,
    );

    return actions;
  };

  it('shows real MoMo and ZaloPay checkout choices instead of a fake card', () => {
    renderBilling();

    expect(screen.queryByText(/visa ending in 4242/i)).not.toBeInTheDocument();
    expect(screen.getByText('149,000 VND')).toBeInTheDocument();
    expect(screen.getByText('~$5.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /monthly with momo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yearly with zalopay/i })).toBeInTheDocument();
  });

  it('starts checkout with the selected plan and provider', () => {
    const actions = renderBilling();

    fireEvent.click(screen.getByRole('button', { name: /monthly with momo/i }));

    expect(actions.handleStartCheckout).toHaveBeenCalledWith('pro_monthly', 'momo');
  });
});
