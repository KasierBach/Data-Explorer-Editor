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

  it.each(['vi', 'en'])('keeps the %s featured badge beside the title without shrinking or wrapping', (lang) => {
    const { container } = render(<PricingSection lang={lang} addToRevealRefs={vi.fn()} />);
    const badge = screen.getByText(lang === 'vi' ? 'Đáng giá nhất' : 'Best value');

    expect(badge).toHaveClass('shrink-0', 'whitespace-nowrap', 'lp-plan-badge');
    expect(badge.parentElement).toHaveClass('lp-plan-heading');
    expect(badge.parentElement?.querySelector('h3')).toHaveTextContent(lang === 'vi' ? 'Pro năm' : 'Pro Yearly');
    expect(container.querySelectorAll('.lp-plan-header')).toHaveLength(3);
    expect(container.querySelectorAll('.lp-plan-price')).toHaveLength(3);
    expect(container.querySelectorAll('.lp-plan-divider')).toHaveLength(3);
    for (const cta of container.querySelectorAll('.lp-pricing-card a')) {
      expect(cta).toHaveAttribute('href', '/sql-explorer');
    }
  });
});
