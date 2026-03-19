import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService } from './api.service';
import { useAppStore } from './store';

// Mock the fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should inject Authorization header when token exists', async () => {
    // Mock store to return a token
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      accessToken: 'fake-token',
    } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'success' }),
    });

    await apiService.get('/test-endpoint');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test-endpoint'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer fake-token',
        }),
      })
    );
  });

  it('should handle 401 and call logout', async () => {
    const logoutMock = vi.fn();
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      accessToken: 'expired-token',
      logout: logoutMock,
    } as any);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Token expired' }),
    });

    await expect(apiService.get('/secure-endpoint')).rejects.toThrow('Phiên làm việc hết hạn');
    expect(logoutMock).toHaveBeenCalled();
  });
});
