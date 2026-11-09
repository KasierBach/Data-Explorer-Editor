import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatService, normalizeAiMessageProvenance } from './AiChatService';

const savedResponse = { id: 'server-message', chatUpdatedAt: '2026-11-09T12:00:00.123Z', persistence: { state: 'saved' } };
const clientMessageId = '123e4567-e89b-42d3-a456-426614174000';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AiChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.each(['saved', 'already_saved'])('returns canonical identity and exact version on %s', async (state) => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' },
      json: async () => ({ ...savedResponse, id: clientMessageId, persistence: { state } }) });
    const result = await AiChatService.saveMessage('chat-1', { id: clientMessageId, role: 'user', content: 'hello' },
      { expectedUpdatedAt: '2026-11-09T12:00:00.122Z' });
    expect(result).toMatchObject({ id: clientMessageId, updatedAt: savedResponse.chatUpdatedAt, chatUpdatedAt: savedResponse.chatUpdatedAt, persistence: { state } });
    const [, request] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({ clientMessageId, expectedUpdatedAt: '2026-11-09T12:00:00.122Z' });
  });

  it.each(['welcome', 'legacy-local-id', '123e4567-e89b-42d3-a456-invalid'])('does not send a pretend UUID for %s', async (id) => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => savedResponse });
    const result = await AiChatService.saveMessage('chat-1', { id, role: 'user', content: 'hello' });
    expect(result.id).toBe('server-message');
    const [, request] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(request.body as string)).not.toHaveProperty('clientMessageId');
  });

  it('rejects collisions instead of reporting them saved', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Message id already exists' }) });
    await expect(AiChatService.saveMessage('chat-1', { id: clientMessageId, role: 'user', content: 'collision' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects an unconfirmed save response', async () => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({}) });
    await expect(AiChatService.saveMessage('chat-1', { role: 'user', content: 'hello' })).rejects.toThrow('Invalid message persistence response');
  });

  it('uses the atomic edit endpoint with unchanged provenance envelopes', async () => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({
      ...savedResponse, id: clientMessageId, role: 'user', content: 'edited', deletedCount: 2,
      attachments: { items: [], sources: ['https://example.com/reference'], usage: { totalTokens: 9 }, contractVersion: 1 },
      createdAt: '2026-11-09T11:00:00.001Z',
    }) });
    const result = await AiChatService.editMessageAndTruncate('chat-1', clientMessageId, {
      role: 'user', content: 'edited', sources: ['https://example.com/reference'], usage: { totalTokens: 9 },
    }, { expectedUpdatedAt: '2026-11-09T12:00:00.122Z' });
    expect(result).toMatchObject({ id: clientMessageId, deletedCount: 2, message: {
      content: 'edited', delivery: 'saved', sources: ['https://example.com/reference'], usage: { totalTokens: 9 },
    } });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/messages/${clientMessageId}/edit-and-truncate`), expect.objectContaining({ method: 'PATCH' }));
    const [, request] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({ expectedUpdatedAt: '2026-11-09T12:00:00.122Z', attachments: {
      sources: ['https://example.com/reference'], usage: { totalTokens: 9 }, contractVersion: 1,
    } });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retains the exact chat version when loading a message snapshot', async () => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' },
      json: async () => ({ updatedAt: savedResponse.chatUpdatedAt, messages: [] }) });
    expect(await AiChatService.loadMessages('chat-1', true)).toEqual({ messages: [], serverUpdatedAt: savedResponse.chatUpdatedAt });
    expect(await AiChatService.loadMessages('chat-1')).toEqual([]);
  });

  it('retains chat versions in the lazy chat list', async () => {
    mockFetch.mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, json: async () => [{
      id: 'chat-1', title: 'chat', createdAt: savedResponse.chatUpdatedAt, updatedAt: savedResponse.chatUpdatedAt,
    }] });
    expect(await AiChatService.fetchChats()).toEqual([expect.objectContaining({ serverUpdatedAt: savedResponse.chatUpdatedAt,
      updatedAt: Date.parse(savedResponse.chatUpdatedAt), messages: [] })]);
  });

  it('updates an existing message via PATCH instead of creating a new message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(savedResponse),
    });

    await AiChatService.updateMessage('chat-1', 'msg-1', {
      role: 'user',
      content: 'updated prompt',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/ai/chats/chat-1/messages/msg-1'),
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
  });

  it('wraps AI response metadata into the persisted message payload envelope', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(savedResponse),
    });

    await AiChatService.saveMessage('chat-1', {
      role: 'ai',
      content: 'done',
      attachments: [{ type: 'image', label: 'chart.png', preview: 'thumb' }],
      modelInfo: { provider: 'groq', model: 'llama-4', routingMode: 'best' },
      recommendations: [{ type: 'chart_suggestion', title: 'Chart', summary: 'Use a bar chart' }],
    });

    const [, request] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    expect(request.body).toContain('"items"');
    expect(request.body).toContain('"modelInfo"');
    expect(request.body).toContain('"recommendations"');
  });

  it.each(['save', 'update'])('persists safe bounded provenance-only envelopes on %s', async (operation) => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(savedResponse),
    });
    const message = {
      role: 'ai' as const,
      content: 'sources only',
      sources: [
        'https://EXAMPLE.com:443/reference',
        'https://example.com/reference',
        'javascript:alert(1)',
        'data:text/html,unsafe',
        'https://user:secret@example.com/private',
        'https://example.com/\tunsafe',
        'https://example.com/%0aunsafe',
        ...Array.from({ length: 8 }, (_, index) => `https://example.org/source-${index}`),
      ],
      usage: { promptTokens: 0 },
      warnings: ['Provider coverage is limited'],
      generationId: 'server-generation-1',
    };
    if (operation === 'save') await AiChatService.saveMessage('chat-1', message);
    else await AiChatService.updateMessage('chat-1', 'msg-1', message);

    const [, request] = mockFetch.mock.calls.at(-1) as [string, RequestInit];
    const persisted = JSON.parse(request.body as string);
    expect(persisted.attachments).toEqual({
      items: [],
      sources: ['https://example.com/reference', ...Array.from({ length: 5 }, (_, index) => `https://example.org/source-${index}`)],
      usage: { promptTokens: 0 },
      warnings: message.warnings,
      generationId: message.generationId,
      contractVersion: 1,
    });
    expect(persisted.modelInfo).toBeUndefined();
    expect(persisted.usage).toBeUndefined();
  });

  describe.each(['save', 'update'] as const)('%s execution metadata', (operation) => {
    it.each([
      { usageCoverage: 'complete', attemptCount: 1, measuredAttemptCount: 1, costCoverage: 'unavailable',
        usage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 }, observedUsage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 } },
      { usageCoverage: 'partial', attemptCount: 3, measuredAttemptCount: 1, costCoverage: 'unavailable',
        usage: null, observedUsage: { promptTokens: 12, completionTokens: null, totalTokens: null } },
      { usageCoverage: 'partial', attemptCount: 2, measuredAttemptCount: 1, costCoverage: 'unavailable',
        usage: null, observedUsage: { promptTokens: null, completionTokens: 0, totalTokens: null } },
      { usageCoverage: 'partial', attemptCount: 2, measuredAttemptCount: 1, costCoverage: 'unavailable',
        usage: null, observedUsage: { promptTokens: null, completionTokens: null, totalTokens: 9 } },
      { usageCoverage: 'unavailable', attemptCount: 2, measuredAttemptCount: 0, costCoverage: 'unavailable', usage: null, observedUsage: null },
      { usageCoverage: 'unavailable', attemptCount: 0, measuredAttemptCount: 0, costCoverage: 'unavailable', usage: null, observedUsage: null },
      { usage: { promptTokens: 0, completionTokens: null, totalTokens: null } },
      { usage: null },
      { observedUsage: null },
      {},
    ])('round-trips optional nullable metadata without inference: %j', async (metadata) => {
      const input = { role: 'ai' as const, content: 'Final answer', generationId: 'received-generation', ...metadata };
      let stored: Record<string, unknown> | undefined;
      mockFetch.mockImplementation(async (_url: string, request?: RequestInit) => {
        if (request?.method === 'GET') return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({
          updatedAt: savedResponse.chatUpdatedAt,
          messages: [{ id: clientMessageId, role: 'model', content: input.content, attachments: stored, createdAt: '2026-11-09T11:00:00.001Z' }],
        }) };
        stored = JSON.parse(request!.body as string).attachments;
        return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({
          ...savedResponse, id: clientMessageId, role: 'ai', content: input.content, attachments: stored, createdAt: '2026-11-09T11:00:00.001Z',
        }) };
      });
      const result = operation === 'save'
        ? await AiChatService.saveMessage('chat-1', input as never)
        : await AiChatService.updateMessage('chat-1', clientMessageId, input as never);
      const expected = { ...metadata, generationId: input.generationId, contractVersion: 1 };
      expect(stored).toEqual({ items: [], ...expected });
      expect(normalizeAiMessageProvenance(result.message)).toEqual(expected);
      const snapshot = await AiChatService.loadMessages('chat-1', true);
      expect(snapshot.serverUpdatedAt).toBe(savedResponse.chatUpdatedAt);
      expect(normalizeAiMessageProvenance(snapshot.messages[0])).toEqual(expected);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it.each([
    { input: { usageCoverage: 'complete', costCoverage: 'unavailable', attemptCount: 8, measuredAttemptCount: 8 },
      expected: { usageCoverage: 'complete', costCoverage: 'unavailable', attemptCount: 8, measuredAttemptCount: 8 } },
    { input: { usageCoverage: 'partial', costCoverage: 'unavailable', attemptCount: 1, measuredAttemptCount: 2 },
      expected: { usageCoverage: 'partial', costCoverage: 'unavailable', attemptCount: 1 } },
    { input: { measuredAttemptCount: 1 }, expected: { measuredAttemptCount: 1 } },
    { input: { usage: null, observedUsage: null }, expected: { usage: null, observedUsage: null } },
    { input: { usage: { promptTokens: null, completionTokens: 0, totalTokens: undefined }, observedUsage: { promptTokens: 3, completionTokens: null, totalTokens: null } },
      expected: { usage: { promptTokens: null, completionTokens: 0 }, observedUsage: { promptTokens: 3, completionTokens: null, totalTokens: null } } },
    { input: { usage: { promptTokens: 3, completionTokens: 4 }, observedUsage: { promptTokens: 3, completionTokens: 4 } },
      expected: { usage: { promptTokens: 3, completionTokens: 4 }, observedUsage: { promptTokens: 3, completionTokens: 4 } } },
    { input: { usageCoverage: 'COMPLETE', costCoverage: 'complete', attemptCount: 9, measuredAttemptCount: 9, usage: {}, observedUsage: {} }, expected: {} },
    { input: { usageCoverage: null, costCoverage: null, attemptCount: -1, measuredAttemptCount: 1.5, observedUsage: { promptTokens: -1, completionTokens: 1.5, totalTokens: Number.MAX_SAFE_INTEGER + 1 } }, expected: {} },
    { input: { attemptCount: '2', measuredAttemptCount: true, usage: { promptTokens: NaN, completionTokens: Infinity, totalTokens: '3' } }, expected: {} },
    { input: { attemptCount: Number.MAX_SAFE_INTEGER + 1, measuredAttemptCount: -1, observedUsage: [] }, expected: {} },
    { input: { usage: undefined, observedUsage: undefined, apiKey: 'not-metadata', rawResponse: { secret: 'not-metadata' } }, expected: {} },
  ])('normalizes optional counters and coverage without claiming ledger authority: %j', ({ input, expected }) => {
    expect(normalizeAiMessageProvenance(input)).toEqual(expected);
  });

  it.each(['promptTokens', 'completionTokens', 'totalTokens'] as const)('drops only invalid observed %s while preserving safe siblings', (key) => {
    const input = { promptTokens: 0, completionTokens: 2, totalTokens: 5, [key]: Number.MAX_SAFE_INTEGER + 1 };
    const expected = { ...input };
    delete expected[key];
    expect(normalizeAiMessageProvenance({ usage: input, observedUsage: input })).toEqual({ usage: expected, observedUsage: expected });
  });

  it.each([
    { payload: [{ type: 'sql', label: 'legacy.sql', data: 'SELECT 1' }], version: undefined },
    { payload: { items: [{ type: 'sql', label: 'legacy.sql' }], modelInfo: { model: 'legacy-model' } }, version: undefined },
    { payload: { sources: ['https://example.com/reference'], contractVersion: 1 }, version: 1 },
    { payload: { sources: ['https://example.com/reference'], contractVersion: 2 }, version: undefined },
    { payload: { sources: ['javascript:alert(1)', 'https://user:secret@example.com/private', 'https://example.com/\nunsafe'], usage: { promptTokens: -1, totalTokens: '42' } }, version: undefined },
    { payload: null, version: undefined },
  ])('loads legacy and optional provenance payloads without inventing metadata: $payload', async ({ payload, version }) => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({
        messages: [{ id: 'msg-1', role: 'model', content: 'legacy answer', attachments: payload, createdAt: '2026-06-07T12:00:00.000Z' }],
      }),
    });
    const [message] = await AiChatService.loadMessages('chat-1');
    expect(message.role).toBe('ai');
    expect(message.contractVersion).toBe(version);
    expect(message.usage).toBeUndefined();
    expect(message.warnings).toBeUndefined();
    expect(message.generationId).toBeUndefined();
    if (Array.isArray(payload)) expect(message.attachments).toEqual(payload);
    else if (payload && 'items' in payload) {
      expect(message.attachments).toEqual(payload.items);
      expect(message.modelInfo).toEqual(payload.modelInfo);
    } else if (payload?.sources?.[0]?.startsWith('https:')) {
      expect(message.sources).toEqual(['https://example.com/reference']);
      expect(message.modelInfo).toBeNull();
    } else expect(message.sources).toBeUndefined();
  });

  it('hydrates persisted message payload envelopes back into UI message fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () =>
        Promise.resolve({
          messages: [
            {
              id: 'msg-1',
              role: 'ai',
              content: 'ready',
              attachments: {
                items: [{ type: 'image', label: 'chart.png', preview: 'thumb' }],
                modelInfo: { provider: 'groq', model: 'llama-4', routingMode: 'best' },
                recommendations: [{ type: 'chart_suggestion', title: 'Chart', summary: 'Use a bar chart' }],
              },
              createdAt: '2026-06-07T12:00:00.000Z',
            },
          ],
        }),
    });

    const messages = await AiChatService.loadMessages('chat-1');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: 'ready',
      attachments: [{ type: 'image', label: 'chart.png', preview: 'thumb' }],
      modelInfo: { provider: 'groq', model: 'llama-4', routingMode: 'best' },
      recommendations: [{ type: 'chart_suggestion', title: 'Chart', summary: 'Use a bar chart' }],
    });
  });
});
