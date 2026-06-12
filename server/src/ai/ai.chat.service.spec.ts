import { AiChatService } from './ai.chat.service';

describe('AiChatService', () => {
  it('updates an existing message instead of creating a duplicate row during edit', async () => {
    const prisma = {
      aiChat: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'chat-1', userId: 'user-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      aiMessage: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'msg-1', chatId: 'chat-1' }),
        update: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      },
    };

    const service = new AiChatService(prisma as any);

    await (service as any).updateMessage('user-1', 'chat-1', 'msg-1', {
      role: 'user',
      content: 'updated prompt',
      attachments: [
        {
          type: 'image',
          label: 'diagram.png',
          data: 'data:image/png;base64,abc',
        },
      ],
    });

    expect(prisma.aiChat.update).toHaveBeenCalledWith({
      where: { id: 'chat-1' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.aiMessage.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: expect.objectContaining({
        content: 'updated prompt',
        attachments: [
          {
            type: 'image',
            label: 'diagram.png',
            data: 'data:image/png;base64,abc',
          },
        ],
      }),
    });
  });

  it('rejects updates when the message does not belong to the requested chat', async () => {
    const prisma = {
      aiChat: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'chat-1', userId: 'user-1' }),
        update: jest.fn(),
      },
      aiMessage: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'msg-2', chatId: 'chat-2' }),
        update: jest.fn(),
      },
    };

    const service = new AiChatService(prisma as any);

    await expect(
      (service as any).updateMessage('user-1', 'chat-1', 'msg-2', {
        role: 'user',
        content: 'cross chat update',
      }),
    ).rejects.toThrow('Message not found');

    expect(prisma.aiChat.update).not.toHaveBeenCalled();
    expect(prisma.aiMessage.update).not.toHaveBeenCalled();
  });
});
