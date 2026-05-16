import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService } from './api.service';
import { ConnectionService } from './ConnectionService';
import { SearchService } from './SearchService';
import type { Connection } from './store/slices/connectionSlice';

vi.mock('./api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./SearchService', () => ({
  SearchService: {
    syncIndex: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./store', () => ({
  useAppStore: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
}));

describe('ConnectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('static methods', () => {
    it('should fetch connections via API', async () => {
      const mockConnections: Connection[] = [
        { id: '1', name: 'Test DB', type: 'postgres' }
      ];
      vi.spyOn(apiService, 'get').mockResolvedValue(mockConnections);

      const result = await ConnectionService.getConnections();

      expect(apiService.get).toHaveBeenCalledWith('/connections');
      expect(result).toEqual(mockConnections);
    });

    it('should create a new connection via API', async () => {
      const mockConnection: Connection = { id: '1', name: 'New DB', type: 'postgres' };
      vi.spyOn(apiService, 'post').mockResolvedValue(mockConnection);

      const result = await ConnectionService.createConnection({ name: 'New DB', type: 'postgres' });

      expect(apiService.post).toHaveBeenCalledWith('/connections', { name: 'New DB', type: 'postgres' });
      expect(SearchService.syncIndex).toHaveBeenCalled();
      expect(result).toEqual(mockConnection);
    });

    it('should update connection via API', async () => {
      vi.spyOn(apiService, 'patch').mockResolvedValue(undefined);

      await ConnectionService.updateConnection('1', { name: 'Updated' });

      expect(apiService.patch).toHaveBeenCalledWith('/connections/1', { name: 'Updated' });
      expect(SearchService.syncIndex).toHaveBeenCalled();
    });

    it('should delete connection via API', async () => {
      vi.spyOn(apiService, 'delete').mockResolvedValue(undefined);

      await ConnectionService.deleteConnection('1');

      expect(apiService.delete).toHaveBeenCalledWith('/connections/1');
      expect(SearchService.syncIndex).toHaveBeenCalled();
    });

    it('should check connection health via API', async () => {
      const mockHealth = { status: 'healthy' as const, latencyMs: 50, error: null };
      vi.spyOn(apiService, 'post').mockResolvedValue(mockHealth);

      const result = await ConnectionService.checkConnectionHealth('1');

      expect(apiService.post).toHaveBeenCalledWith('/connections/1/health-check', {});
      expect(result).toEqual(mockHealth);
    });
  });

  describe('singleton instance', () => {
    it('should return same instance', () => {
      const instance1 = ConnectionService.getInstance();
      const instance2 = ConnectionService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should get adapter for connection', () => {
      const service = ConnectionService.getInstance();
      const adapter = service.getAdapter('conn-1', 'postgres');

      expect(adapter).toBeDefined();
    });

    it('should return same adapter for same connection', () => {
      const service = ConnectionService.getInstance();
      const adapter1 = service.getAdapter('conn-1', 'postgres');
      const adapter2 = service.getAdapter('conn-1', 'postgres');

      expect(adapter1).toBe(adapter2);
    });

    it('should return different adapters for different connections', () => {
      const service = ConnectionService.getInstance();
      const adapter1 = service.getAdapter('conn-1', 'postgres');
      const adapter2 = service.getAdapter('conn-2', 'mysql');

      expect(adapter1).not.toBe(adapter2);
    });
  });
});
