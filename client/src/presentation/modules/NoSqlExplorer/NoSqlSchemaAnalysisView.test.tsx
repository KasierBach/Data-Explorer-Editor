import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      lang: 'en',
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

  it('surfaces collection overview and filters risky fields', async () => {
    mockApiPost.mockResolvedValue([
      {
        name: 'status',
        types: { string: 100 },
        count: 100,
        probability: 100,
        sampleValues: ['active'],
      },
      {
        name: 'rating',
        types: { number: 30, string: 30 },
        count: 60,
        probability: 60,
        sampleValues: [4, '5'],
      },
      {
        name: 'notes',
        types: { string: 10 },
        count: 10,
        probability: 10,
        sampleValues: ['draft'],
      },
    ]);

    render(<NoSqlSchemaAnalysisView />);

    expect(await screen.findByText('Field inventory')).toBeInTheDocument();
    expect(screen.getByText('Mixed-type fields')).toBeInTheDocument();
    expect(screen.getByText('Coverage gap: notes (10%)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mixed types/i }));

    await waitFor(() => {
      expect(screen.getByText('rating')).toBeInTheDocument();
      expect(screen.queryByText('status')).not.toBeInTheDocument();
      expect(screen.queryByText('notes')).not.toBeInTheDocument();
    });
  });
});
