import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { useNoSqlQuery } from './useNoSqlQuery';

vi.mock('@/core/services/ConnectionService', () => ({
    connectionService: {
        getAdapter: vi.fn(),
    },
}));

vi.mock('@/core/services/store', () => ({
    useAppStore: {
        getState: vi.fn(),
    },
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    },
}));

describe('useNoSqlQuery', () => {
    const connect = vi.fn();
    const executeQuery = vi.fn();
    const setNosqlPagination = vi.fn();
    const setNosqlResult = vi.fn();
    const setNosqlQueryRunning = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(connectionService.getAdapter).mockReturnValue({
            connect,
            executeQuery,
        } as never);
        vi.mocked(useAppStore.getState).mockReturnValue({
            nosqlActiveCollection: 'products',
            nosqlActiveDatabase: 'warehouse',
            nosqlActiveConnectionId: 'mongo-1',
            nosqlMqlQuery: JSON.stringify({
                action: 'find',
                collection: 'products',
                filter: {},
            }),
            nosqlPageIndex: 0,
            nosqlPageSize: 50,
            connections: [{
                id: 'mongo-1',
                type: 'mongodb',
                allowQueryExecution: true,
                readOnly: false,
            }],
            lang: 'en',
            setNosqlPagination,
            setNosqlResult,
            setNosqlQueryRunning,
        } as never);
        executeQuery.mockResolvedValue({
            rows: [{ _id: '1' }],
            columns: ['_id'],
            rowCount: 1,
            truncated: true,
            hasNextPage: true,
            appliedLimit: 100,
            appliedOffset: 200,
            limitSource: 'requested',
        });
    });

    it('passes a bounded server window for MongoDB pages', async () => {
        const { result } = renderHook(() => useNoSqlQuery());

        await act(async () => {
            await result.current.executeMql({ pageIndex: 2, pageSize: 100 });
        });

        expect(setNosqlPagination).toHaveBeenCalledWith(2, 100);
        expect(executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            { database: 'warehouse', limit: 100, offset: 200 },
        );
        expect(result.current.result).toEqual(expect.objectContaining({
            truncated: true,
            hasNextPage: true,
            appliedOffset: 200,
        }));
    });
});
