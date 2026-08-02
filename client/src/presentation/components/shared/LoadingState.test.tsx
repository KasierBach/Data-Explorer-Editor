import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
    it('announces progress and keeps the requested layout responsive', () => {
        render(<LoadingState label="Loading dashboard" variant="table" />);

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveAttribute('aria-busy', 'true');
        expect(status).toHaveTextContent('Loading dashboard');
        expect(status).toHaveClass('min-h-56');
    });
});
