import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatService } from './AiChatService';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AiChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('updates an existing message via PATCH instead of creating a new message', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
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
      json: () => Promise.resolve({}),
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
