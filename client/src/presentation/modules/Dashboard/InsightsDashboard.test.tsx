import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsDashboard } from './InsightsDashboard';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/core/services/store', () => ({
    useAppStore: () => ({ activeConnectionId: 'connection-1', connections: [{ id: 'connection-1', name: 'Local', type: 'postgres' }], lang: 'en' }),
}));

vi.mock('@/core/services/ConnectionService', () => ({
    connectionService: { getAdapter: vi.fn() },
}));

describe('InsightsDashboard', () => {
    beforeEach(() => mockUseQuery.mockReset());

    it('does not present failed metrics as zero-valued data', () => {
        mockUseQuery
            .mockReturnValueOnce({ data: ['app'], isLoading: false })
            .mockReturnValueOnce({ data: undefined, isLoading: false, error: new Error('connection refused'), refetch: vi.fn(), isFetching: false })
            .mockReturnValueOnce({ data: [], refetch: vi.fn(), isFetching: false });

        render(<InsightsDashboard />);

        expect(screen.getByText('Database insights unavailable')).toBeInTheDocument();
        expect(screen.getByText('connection refused')).toBeInTheDocument();
        expect(screen.queryByText('Total Tables')).not.toBeInTheDocument();
    });
});
