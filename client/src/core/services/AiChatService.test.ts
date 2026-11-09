import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatService } from './AiChatService';

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
