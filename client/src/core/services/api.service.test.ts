import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiService } from './api.service';
import { useAppStore } from './store';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should inject Authorization header when token exists', async () => {
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
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
        }),
      }),
    );
  });

  it('should attempt refresh on 401 and then call logout if refresh fails', async () => {
    const logoutMock = vi.fn();
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      accessToken: 'expired-token',
      logout: logoutMock,
    } as any);

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Token expired' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Refresh failed' }),
      });

    await expect(apiService.get('/secure-endpoint')).rejects.toThrow('Token expired');
    expect(logoutMock).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('should expose structured error fields for auth flows', async () => {
    vi.spyOn(useAppStore, 'getState').mockReturnValue({
      accessToken: null,
      logout: vi.fn(),
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({
        message: 'Please verify email',
        unverified: true,
        email: 'ada@example.com',
      }),
    });

    await expect(apiService.post('/auth/login', {}, {}, false)).rejects.toMatchObject({
      message: 'Please verify email',
      data: {
        unverified: true,
        email: 'ada@example.com',
      },
    });
  });
});
