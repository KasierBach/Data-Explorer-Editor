import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './AiService';
import { useAppStore } from './store';

// Mock global fetch using stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AiService (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({ isAuthenticated: true, isAuthBootstrapped: true, user: { id: 'user-a', email: 'a@example.com', aiEnabled: true } });
  });

  it('does not dispatch autocomplete for a disabled or unhydrated account', async () => {
    useAppStore.setState({ user: { id: 'user-a', email: 'a@example.com', aiEnabled: false } });
    await expect(aiService.getAutocomplete({ connectionId: 'conn-1', beforeCursor: 'SEL' })).rejects.toMatchObject({ reason: 'AI_DISABLED' });
    useAppStore.setState({ isAuthBootstrapped: false, user: { id: 'user-a', email: 'a@example.com', aiEnabled: true } });
    await expect(aiService.getAutocomplete({ connectionId: 'conn-1', beforeCursor: 'SEL' })).rejects.toMatchObject({ reason: 'AI_DISABLED' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not retry autocomplete after a 401 refresh', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    });

    await expect(aiService.getAutocomplete({ connectionId: 'conn-1', beforeCursor: 'SEL' })).resolves.toBe('');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/ai/autocomplete');
  });

  it('should call autocomplete endpoint and return completion string', async () => {
    const mockResponse = {
      success: true,
      data: {
        completion: 'SELECT * FROM users'
      }
    };

    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(mockResponse)
    });

    const params = {
      connectionId: 'conn-1',
      beforeCursor: 'SEL',
      model: 'google/gemma-4-31b-it:free',
      providerOverride: {
        type: 'openai-compatible' as const,
        name: 'custom',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'sk-test',
        model: 'custom-model',
      },
    };

    const result = await aiService.getAutocomplete(params);

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/ai/autocomplete'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(params)
    }));
    expect(result).toBe('SELECT * FROM users');
  });

  it('returns built-in provider configuration status', async () => {
    const providers = { gemini: true, groq: false };
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ success: true, data: { providers } }),
    });

    await expect(aiService.getProviderStatus()).resolves.toEqual({ providers });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/providers/status'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('should return empty string on fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ message: 'Internal Server Error' })
    });

    const result = await aiService.getAutocomplete({ connectionId: '1', beforeCursor: 'abc' });

    expect(result).toBe('');
  });

  it('should return empty string on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const result = await aiService.getAutocomplete({ connectionId: '1', beforeCursor: 'abc' });

    expect(result).toBe('');
  });
});
