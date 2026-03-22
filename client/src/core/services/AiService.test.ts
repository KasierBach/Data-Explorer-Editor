import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './AiService';

// Mock global fetch using stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AiService (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
      json: () => Promise.resolve(mockResponse)
    });

    const params = {
      connectionId: 'conn-1',
      beforeCursor: 'SEL'
    };

    const result = await aiService.getAutocomplete(params);

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/ai/autocomplete'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(params)
    }));
    expect(result).toBe('SELECT * FROM users');
  });

  it('should return empty string on fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
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
