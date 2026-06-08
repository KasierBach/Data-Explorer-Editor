import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createAiChatSlice, type AiChatSlice } from './aiChatSlice';

const aiChatServiceMocks = vi.hoisted(() => ({
  fetchChats: vi.fn(),
  loadMessages: vi.fn(),
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  saveMessage: vi.fn(),
  updateChat: vi.fn(),
  deleteMessage: vi.fn(),
  deleteMessagesAfter: vi.fn(),
  updateMessage: vi.fn(),
}));

vi.mock('../../AiChatService', () => ({
  AiChatService: aiChatServiceMocks,
}));

describe('aiChatSlice.editAiMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the existing persisted message instead of appending a new one', async () => {
    const store = createStore<AiChatSlice>()((set, get, api) =>
      createAiChatSlice(set, get, api),
    );

    store.setState({
      aiChats: [
        {
          id: 'chat-1',
          title: 'Chat 1',
          createdAt: 1,
          updatedAt: 1,
          messages: [
            { id: 'welcome', role: 'ai', content: 'hello', timestamp: 1 },
            {
              id: 'user-1',
              role: 'user',
              content: 'show tables',
              timestamp: 2,
              attachments: [
                {
                  type: 'image',
                  label: 'schema.png',
                  preview: 'blob:schema',
                  data: 'data:image/png;base64,abc',
                },
              ],
            },
            { id: 'ai-1', role: 'ai', content: 'SELECT * FROM users', timestamp: 3 },
          ],
        },
      ],
      activeAiChatId: 'chat-1',
    } as Partial<AiChatSlice>);

    await store.getState().editAiMessage('chat-1', 'user-1', 'show me all tables');

    expect(aiChatServiceMocks.deleteMessagesAfter).toHaveBeenCalledWith(
      'chat-1',
      'user-1',
    );
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledWith(
      'chat-1',
      'user-1',
      expect.objectContaining({
        content: 'show me all tables',
        attachments: [
          expect.objectContaining({
            label: 'schema.png',
            data: 'data:image/png;base64,abc',
          }),
        ],
      }),
    );
    expect(aiChatServiceMocks.saveMessage).not.toHaveBeenCalled();
  });
});
