import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SavedQueryService, type SaveSavedQueryPayload } from './SavedQueryService';
import { apiService } from './api.service';

vi.mock('./api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('SavedQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all saved queries', async () => {
    const mockQueries = [
      { id: '1', name: 'Query 1', sql: 'SELECT * FROM users' }
    ];
    vi.spyOn(apiService, 'get').mockResolvedValue(mockQueries as any);

    const result = await SavedQueryService.getSavedQueries();

    expect(apiService.get).toHaveBeenCalledWith('/saved-queries');
    expect(result).toEqual(mockQueries);
  });

  it('should create a new saved query', async () => {
    const payload: SaveSavedQueryPayload = {
      name: 'My Query',
      sql: 'SELECT * FROM orders',
      visibility: 'private',
      tags: [],
    };
    const mockResult = { id: '1', ...payload };
    vi.spyOn(apiService, 'post').mockResolvedValue(mockResult as any);

    const result = await SavedQueryService.createSavedQuery(payload);

    expect(apiService.post).toHaveBeenCalledWith('/saved-queries', payload);
    expect(result).toEqual(mockResult);
  });

  it('should update a saved query', async () => {
    const updates = { name: 'Updated Name' };
    const mockResult = { id: '1', name: 'Updated Name' };
    vi.spyOn(apiService, 'patch').mockResolvedValue(mockResult as any);

    const result = await SavedQueryService.updateSavedQuery('1', updates);

    expect(apiService.patch).toHaveBeenCalledWith('/saved-queries/1', updates);
    expect(result).toEqual(mockResult);
  });

  it('should delete a saved query', async () => {
    vi.spyOn(apiService, 'delete').mockResolvedValue(undefined);

    await SavedQueryService.deleteSavedQuery('1');

    expect(apiService.delete).toHaveBeenCalledWith('/saved-queries/1');
  });

  it('should include connectionId and database when provided', async () => {
    const payload: SaveSavedQueryPayload = {
      name: 'DB Query',
      sql: 'SELECT * FROM users',
      visibility: 'private',
      connectionId: 'conn-1',
      organizationId: 'org-1',
      database: 'mydb',
      tags: [],
    };
    vi.spyOn(apiService, 'post').mockResolvedValue({ id: '1', ...payload } as any);

    await SavedQueryService.createSavedQuery(payload);

    expect(apiService.post).toHaveBeenCalledWith('/saved-queries', payload);
  });

  it('should include tags when provided', async () => {
    const payload: SaveSavedQueryPayload = {
      name: 'Tagged Query',
      sql: 'SELECT 1',
      visibility: 'workspace',
      tags: ['analytics', 'dashboard'],
    };
    vi.spyOn(apiService, 'post').mockResolvedValue({ id: '1', ...payload } as any);

    await SavedQueryService.createSavedQuery(payload);

    expect(apiService.post).toHaveBeenCalledWith('/saved-queries', payload);
  });
});
