import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SavedQueryService, type SaveSavedQueryPayload } from './SavedQueryService';
import { apiService } from './api.service';
import type { SavedQuery } from './store/slices/querySlice';

vi.mock('./api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const createMockSavedQuery = (overrides: Partial<SavedQuery>): SavedQuery => ({
  id: 'query-1',
  name: 'Query',
  sql: 'SELECT 1',
  visibility: 'private',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('SavedQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all saved queries', async () => {
    const mockQueries = [
      createMockSavedQuery({ id: '1', name: 'Query 1', sql: 'SELECT * FROM users' })
    ];
    vi.spyOn(apiService, 'get').mockResolvedValue(mockQueries);

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
    const mockResult = createMockSavedQuery({ id: '1', ...payload });
    vi.spyOn(apiService, 'post').mockResolvedValue(mockResult);

    const result = await SavedQueryService.createSavedQuery(payload);

    expect(apiService.post).toHaveBeenCalledWith('/saved-queries', payload);
    expect(result).toEqual(mockResult);
  });

  it('should update a saved query', async () => {
    const updates = { name: 'Updated Name' };
    const mockResult = createMockSavedQuery({ id: '1', name: 'Updated Name' });
    vi.spyOn(apiService, 'patch').mockResolvedValue(mockResult);

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
    vi.spyOn(apiService, 'post').mockResolvedValue(createMockSavedQuery({ id: '1', ...payload }));

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
    vi.spyOn(apiService, 'post').mockResolvedValue(createMockSavedQuery({ id: '1', ...payload }));

    await SavedQueryService.createSavedQuery(payload);

    expect(apiService.post).toHaveBeenCalledWith('/saved-queries', payload);
  });
});
