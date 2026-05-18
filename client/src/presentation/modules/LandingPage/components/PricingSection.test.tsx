import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PricingSection } from './PricingSection';

describe('PricingSection', () => {
  it('presents Vietnamese-friendly VND pricing with USD reference copy', () => {
    render(<PricingSection lang="en" addToRevealRefs={vi.fn()} />);

    expect(screen.getByText('149,000 VND')).toBeInTheDocument();
    expect(screen.getByText('~$5.99')).toBeInTheDocument();
    expect(screen.getByText('1,490,000 VND')).toBeInTheDocument();
    expect(screen.getByText('~$59.99')).toBeInTheDocument();
    expect(screen.getAllByText(/MoMo and ZaloPay/i).length).toBeGreaterThan(0);
  });
});
