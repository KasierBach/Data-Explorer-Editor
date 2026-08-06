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
      countStatus: 'skipped',
    });
    mockGetAdapter.mockReturnValue(adapter as never);

    mockUseAppStore.mockReturnValue({
      activeConnectionId: 'conn-1',
      activeTabId: 'tab-2',
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
        {
          id: 'tab-2',
          metadata: {
            page: 1,
            pageSize: 10,
          },
        },
      ],
    } as never);
  });

  it('uses the dedicated table-window API for paged table browsing', async () => {
    const { result } = renderHook(
      () => useDataGridData({ tableId: 'db:analytics.schema:public.table:users', tabId: 'tab-1', enabled: true }),
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
      includeTotalCount: false,
      limit: 50,
      offset: 100,
      sortBy: undefined,
      sortOrder: undefined,
    });
    expect(result.current.queryResult).toEqual(
      expect.objectContaining({
        rows: [{ id: 101 }],
        countStatus: 'skipped',
      }),
    );
    expect(result.current.pkField).toBe('id');
  });

  it('does not fall back to the legacy large_dataset raw-query shortcut', async () => {
    const { result } = renderHook(
      () => useDataGridData({ tableId: 'large_dataset', tabId: 'tab-1', enabled: true, includeTotalCount: true }),
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
      sortBy: undefined,
      sortOrder: undefined,
    });
    expect(adapter.executeQuery).not.toHaveBeenCalled();
    expect(result.current.cleanTableName).toBe('large_dataset');
  });
  it('clears the previous page while the next page is loading', async () => {
    let page = 1;
    type WindowResult = {
      columns: string[];
      rows: { id: number }[];
      rowCount: number;
      countStatus: 'skipped';
    };
    let resolveNextPage: ((value: WindowResult) => void) | undefined;

    mockUseAppStore.mockImplementation(() => ({
      activeConnectionId: 'conn-1',
      connections: [{ id: 'conn-1', type: 'postgres' }],
      tabs: [{ id: 'tab-1', metadata: { page, pageSize: 10 } }],
    } as never));
    adapter.fetchTableWindow.mockImplementation(({ offset }) => {
      if (offset === 0) {
        return Promise.resolve({
          columns: ['id'],
          rows: [{ id: 1 }],
          rowCount: 1,
          countStatus: 'skipped' as const,
        });
      }

      return new Promise<WindowResult>((resolve) => {
        resolveNextPage = resolve;
      });
    });

    const { result, rerender } = renderHook(
      () => useDataGridData({ tableId: 'large_dataset', tabId: 'tab-1', enabled: true }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.queryResult?.rows).toEqual([{ id: 1 }]));

    page = 2;
    rerender();

    await waitFor(() => expect(adapter.fetchTableWindow).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 10 })));
    expect(result.current.queryResult).toBeUndefined();

    resolveNextPage?.({ columns: ['id'], rows: [{ id: 11 }], rowCount: 1, countStatus: 'skipped' });
    await waitFor(() => expect(result.current.queryResult?.rows).toEqual([{ id: 11 }]));
  });
});
