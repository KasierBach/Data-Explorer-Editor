import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedDashboardView } from './SavedDashboardView';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
        removeQueries: vi.fn(),
        setQueryData: vi.fn(),
    }),
}));

vi.mock('@/core/services/store', () => ({
    useAppStore: (selector: (state: { closeTab: () => void; lang: string }) => unknown) => selector({
        closeTab: vi.fn(),
        lang: 'en',
    }),
}));

describe('SavedDashboardView', () => {
    beforeEach(() => mockUseQuery.mockReset());

    it('keeps cached snapshots visible when a refresh fails', () => {
        mockUseQuery.mockReturnValue({
            data: {
                id: 'dashboard-1',
                name: 'Revenue',
                description: null,
                visibility: 'private',
                createdAt: '2026-08-25T00:00:00.000Z',
                updatedAt: '2026-08-25T00:00:00.000Z',
                owner: { id: 'user-1', email: 'owner@example.com' },
                isOwner: false,
                widgets: [],
            },
            isLoading: false,
            error: new Error('offline'),
            refetch: vi.fn(),
            isFetching: false,
        });

        render(<SavedDashboardView dashboardId="dashboard-1" />);

        expect(screen.getByText('Revenue')).toBeInTheDocument();
        expect(screen.getByText(/Showing the latest available snapshot/)).toBeInTheDocument();
        expect(screen.queryByText('Dashboard unavailable')).not.toBeInTheDocument();
    });

    it('shows the unavailable state when no dashboard was loaded', () => {
        mockUseQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('offline'),
            refetch: vi.fn(),
            isFetching: false,
        });

        render(<SavedDashboardView dashboardId="dashboard-1" />);

        expect(screen.getByText('Dashboard unavailable')).toBeInTheDocument();
    });
});
