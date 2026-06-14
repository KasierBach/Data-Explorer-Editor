import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataGridData } from './useDataGridData';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/ConnectionService', () => ({
  connectionService: {
    getAdapter: vi.fn(),
  },
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockGetAdapter = vi.mocked(connectionService.getAdapter);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDataGridData', () => {
  const adapter = {
    getMetadata: vi.fn(),
    fetchTableWindow: vi.fn(),
    executeQuery: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    adapter.getMetadata.mockResolvedValue({
      columns: [
        {
          name: 'id',
          type: 'integer',
          isPrimaryKey: true,
          isNullable: false,
          isForeignKey: false,
        },
      ],
      rowCount: 999,
    });
    adapter.fetchTableWindow.mockResolvedValue({
      columns: ['id'],
      rows: [{ id: 101 }],
      rowCount: 1,
      totalCount: 999,
      countStatus: 'available',
    });
    mockGetAdapter.mockReturnValue(adapter as never);

    mockUseAppStore.mockReturnValue({
      activeConnectionId: 'conn-1',
      activeTabId: 'tab-1',
      connections: [
        {
          id: 'conn-1',
          type: 'postgres',
        },
      ],
      tabs: [
        {
          id: 'tab-1',
          metadata: {
            page: 3,
            pageSize: 50,
          },
        },
      ],
    } as never);
  });

  it('uses the dedicated table-window API for paged table browsing', async () => {
    const { result } = renderHook(
      () => useDataGridData({ tableId: 'db:analytics.schema:public.table:users' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(adapter.fetchTableWindow).toHaveBeenCalled();
    });

    expect(adapter.getMetadata).toHaveBeenCalledWith(
      'db:analytics.schema:public.table:users',
    );
    expect(adapter.fetchTableWindow).toHaveBeenCalledWith({
      database: 'analytics',
      schema: 'public',
      table: 'users',
      includeTotalCount: true,
      limit: 50,
      offset: 100,
    });
    expect(result.current.queryResult).toEqual(
      expect.objectContaining({
        totalCount: 999,
        countStatus: 'available',
      }),
    );
    expect(result.current.pkField).toBe('id');
  });

  it('does not fall back to the legacy large_dataset raw-query shortcut', async () => {
    const { result } = renderHook(
      () => useDataGridData({ tableId: 'large_dataset' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(adapter.fetchTableWindow).toHaveBeenCalled();
    });

    expect(adapter.fetchTableWindow).toHaveBeenCalledWith({
      database: undefined,
      schema: 'public',
      table: 'large_dataset',
      includeTotalCount: true,
      limit: 50,
      offset: 100,
    });
    expect(adapter.executeQuery).not.toHaveBeenCalled();
    expect(result.current.cleanTableName).toBe('large_dataset');
  });
});
