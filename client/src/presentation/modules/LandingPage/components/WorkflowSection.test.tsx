import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowSection } from './WorkflowSection';

const cases = [
    ['Query', '/images/landing/query.webp'],
    ['Schema-ERD', '/images/landing/schema-erd.webp'],
    ['Results', '/images/landing/results.webp'],
] as const;

describe('WorkflowSection product showcase', () => {
    it('starts with a query-specific image, not the hero overview', () => {
        render(<WorkflowSection lang="en" />);

        expect(screen.getByRole('tab', { name: /Query/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('img')).toHaveAttribute('src', cases[0][1]);
        expect(screen.getAllByRole('img')).toHaveLength(1);
    });

    it('changes the description and full image for each workflow', async () => {
        const user = userEvent.setup();
        render(<WorkflowSection lang="en" />);

        for (const [label, src] of cases) {
            await user.click(screen.getByRole('tab', { name: new RegExp(label) }));
            expect(screen.getByRole('tab', { name: new RegExp(label) })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('img')).toHaveAttribute('src', src);
            expect(screen.getByRole('img')).toHaveAttribute('width', '2880');
            expect(screen.getByRole('img')).toHaveAttribute('height', '1800');
            expect(screen.getAllByRole('img')).toHaveLength(1);
            expect(screen.getByRole('link', { name: /View full image/ })).toHaveAttribute('href', src);
        }
    });

    it('supports keyboard navigation through the three panels', async () => {
        const user = userEvent.setup();
        render(<WorkflowSection lang="en" />);

        await user.click(screen.getByRole('tab', { name: /Query/ }));
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: /Schema-ERD/ })).toHaveAttribute('aria-selected', 'true');
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('tab', { name: /Results/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('does not autoplay or change a selected workflow over time', () => {
        vi.useFakeTimers();
        try {
            render(<WorkflowSection lang="en" />);
            vi.advanceTimersByTime(10000);
            expect(screen.getByRole('tab', { name: /Query/ })).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('img')).toHaveAttribute('src', cases[0][1]);
        } finally {
            vi.useRealTimers();
        }
    });
});
