import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoMockup } from './DemoMockup';

describe('DemoMockup product overview', () => {
    it('shows the real full workspace image at native proportions', () => {
        render(<DemoMockup lang="en" />);

        const image = screen.getByAltText(/Data Explorer workspace running a JOIN query/i);
        expect(image).toHaveAttribute('src', '/images/landing/workspace.webp');
        expect(image).toHaveAttribute('width', '2880');
        expect(image).toHaveAttribute('height', '1800');
        expect(image).toHaveAttribute('loading', 'eager');
        expect(screen.getAllByRole('img')).toHaveLength(1);
    });

    it('keeps cinematic decoration deterministic and outside the screenshot interaction', () => {
        const { container } = render(<DemoMockup lang="en" />);

        const routes = container.querySelectorAll('.lp-data-route');
        expect(routes).toHaveLength(4);
        expect(container.querySelectorAll('.lp-data-packet')).toHaveLength(4);
        expect(container.querySelector('.lp-data-paths')).toHaveAttribute('preserveAspectRatio', 'none');
        container.querySelectorAll('.lp-data-packet').forEach(packet => expect(packet).toHaveAttribute('pathLength', '100'));
        expect(container.querySelector('.lp-data-paths')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.lp-stage-decoration')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.lp-stage-scan')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('.lp-screenshot-link .lp-stage-scan')).toBeNull();
    });

    it('offers the original overview image without repeating workflow panels', () => {
        render(<DemoMockup lang="en" />);

        expect(screen.getByRole('link', { name: /View full image/ })).toHaveAttribute('href', '/images/landing/workspace.webp');
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
});
