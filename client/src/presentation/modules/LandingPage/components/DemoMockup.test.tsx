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

    it('offers the original overview image without repeating workflow panels', () => {
        render(<DemoMockup lang="en" />);

        expect(screen.getByRole('link', { name: /View full image/ })).toHaveAttribute('href', '/images/landing/workspace.webp');
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
});
