import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NoSqlSidebar } from './NoSqlSidebar';

const setNosqlDatabase = vi.fn();
const setNosqlCollection = vi.fn();

vi.mock('@/core/services/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    lang: 'en',
    pageStates: {},
    setPageState: vi.fn(),
    nosqlActiveConnectionId: 'mongo-1',
    nosqlActiveDatabase: null,
    setNosqlDatabase,
    setNosqlCollection,
    connections: [{ id: 'mongo-1', name: 'Mongo', type: 'mongodb' }],
  }),
}));

vi.mock('@/presentation/hooks/useDatabase', () => ({
  useDatabaseHierarchy: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/core/services/SearchService', () => ({
  SearchService: {
    search: vi.fn().mockResolvedValue([
      {
        id: 'products',
        name: 'products',
        type: 'collection',
        connectionId: 'mongo-1',
        connectionName: 'Mongo',
        database: 'warehouse',
      },
    ]),
  },
}));

vi.mock('../Explorer/ConnectionSelector', () => ({ ConnectionSelector: () => null }));
vi.mock('../Explorer/SidebarContextMenu', () => ({
  SidebarContextMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/presentation/components/Dialogs/CreateDatabaseDialog', () => ({ CreateDatabaseDialog: () => null }));
vi.mock('@/presentation/components/Dialogs/DeleteDatabaseDialog', () => ({ DeleteDatabaseDialog: () => null }));
vi.mock('@/core/services/ConnectionService', () => ({
  connectionService: { setActiveConnection: vi.fn().mockResolvedValue(undefined) },
}));

describe('NoSqlSidebar search', () => {
  it('opens the database and collection returned by indexed search', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NoSqlSidebar />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'prod' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /products/i }));

    await waitFor(() => {
      expect(setNosqlDatabase).toHaveBeenCalledWith('warehouse');
      expect(setNosqlCollection).toHaveBeenCalledWith('products');
    });
  });
});
