import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiDatabaseAdapter } from './ApiDatabaseAdapter';

describe('R07 query request cancellation', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('passes the execution signal to fetch without serializing it into the API body', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ rows: [], columns: [] }) });
    vi.stubGlobal('fetch', fetch);
    const adapter = new ApiDatabaseAdapter(), controller = new AbortController();
    await adapter.connect({ id: 'r07-connection' });
    await adapter.executeQuery('SELECT 1', { signal: controller.signal, limit: 1 });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/query'), expect.objectContaining({ signal: controller.signal, method: 'POST', body: JSON.stringify({ connectionId: 'r07-connection', sql: 'SELECT 1', limit: 1 }) }));
  });
  it('does not send a request after the execution was aborted', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const adapter = new ApiDatabaseAdapter(), controller = new AbortController();
    await adapter.connect({ id: 'r07-connection' });
    controller.abort();
    await expect(adapter.executeQuery('DELETE FROM r07', { signal: controller.signal, confirmed: true })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
