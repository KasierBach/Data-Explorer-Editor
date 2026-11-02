import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from './api.service';
import { useAppStore } from './store';

describe('R10 writes are not retried after database/network failure', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    useAppStore.setState({ accessToken: 'fixture-token', lang: 'en' });
  });

  it.each([400, 409, 500, 503])('keeps HTTP %s and its reason after one write attempt', async (status) => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status, headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'fixture failed', reason: 'QUERY_CONFLICT', statusCode: status }),
    });
    await expect(apiService.patch('/query/row', { id: 1 })).rejects.toMatchObject({ statusCode: status, reason: 'QUERY_CONFLICT' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: '{"id":1}' });
  });

  it('does not replay a POST when the response is lost after an unknown commit outcome', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network response lost'));
    await expect(apiService.post('/query', { sql: 'INSERT INTO fixture VALUES (1)' })).rejects.toThrow('network response lost');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
