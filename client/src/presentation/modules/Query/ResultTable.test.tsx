import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResultTable } from './ResultTable';

vi.mock('@/core/services/store', () => ({
    useAppStore: () => ({ lang: 'en' }),
}));

vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({
    useResponsiveLayoutMode: () => ({ isCompactMobileLayout: false }),
}));

const results = {
    columns: ['id'],
    rows: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
};

describe('ResultTable server pagination', () => {
    it('changes page size and resets the page in one controlled update', async () => {
        const onPaginationChange = vi.fn();
        const user = userEvent.setup();

        render(
            <ResultTable
                results={results}
                pageIndex={1}
                pageSize={100}
                totalCount={500_000}
                onPaginationChange={onPaginationChange}
            />,
        );

        await user.selectOptions(screen.getByRole('combobox'), '500');

        expect(onPaginationChange).toHaveBeenLastCalledWith(0, 500);
    });

    it('requests the next server page instead of paginating the loaded rows', async () => {
        const onPaginationChange = vi.fn();
        const user = userEvent.setup();

        render(
            <ResultTable
                results={results}
                pageIndex={0}
                pageSize={100}
                totalCount={500_000}
                onPaginationChange={onPaginationChange}
            />,
        );

        await user.click(screen.getByTitle('Next page'));

        expect(onPaginationChange).toHaveBeenCalledWith(1, 100);
        expect(screen.getByText('1–100 / 500,000')).toBeInTheDocument();
    });
});