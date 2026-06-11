import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoSqlSchemaAnalysisView } from './NoSqlSchemaAnalysisView';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('@/core/services/api.service', () => ({
  apiService: {
    post: vi.fn(),
  },
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockApiPost = vi.mocked(apiService.post);

describe('NoSqlSchemaAnalysisView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAppStore.mockReturnValue({
      nosqlActiveConnectionId: 'mongo-1',
      nosqlActiveCollection: 'products',
      nosqlActiveDatabase: 'warehouse',
      setNosqlSchemaStats: vi.fn(),
    } as never);

    mockApiPost.mockResolvedValue([]);
  });

  it('requests schema analysis with the active NoSQL database from the NoSQL slice', async () => {
    render(<NoSqlSchemaAnalysisView />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/nosql/analyze-schema',
        expect.objectContaining({
          connectionId: 'mongo-1',
          database: 'warehouse',
          collection: 'products',
        }),
      );
    });
  });
});
