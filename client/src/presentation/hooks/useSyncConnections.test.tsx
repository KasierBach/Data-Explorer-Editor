import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/core/services/store';
import { ConnectionService } from '@/core/services/ConnectionService';
import { SearchService } from '@/core/services/SearchService';
import { useSyncConnections } from './useSyncConnections';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/ConnectionService', () => ({
  ConnectionService: {
    getConnections: vi.fn(),
  },
}));

vi.mock('@/core/services/SearchService', () => ({
  SearchService: {
    syncIndex: vi.fn(),
  },
}));

describe('useSyncConnections', () => {
  const setConnections = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppStore).mockReturnValue({
      isAuthenticated: true,
      accessToken: 'access-token',
      setConnections,
    } as never);
    vi.mocked(ConnectionService.getConnections).mockResolvedValue([
      { id: 'conn-1', name: 'Main DB', type: 'postgres' },
    ]);
  });

  it('loads connections after login without rebuilding the search index', async () => {
    renderHook(() => useSyncConnections());

    await waitFor(() => {
      expect(setConnections).toHaveBeenCalledTimes(1);
    });
    expect(SearchService.syncIndex).not.toHaveBeenCalled();
  });
});
