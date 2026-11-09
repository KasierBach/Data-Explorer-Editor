import 'reflect-metadata';
import {
  ConflictException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AiChatController } from './ai.chat.controller';
import { AiChatService } from './ai.chat.service';

const VERSION = new Date('2026-01-01T00:00:00.000Z');
const CREATED = new Date('2026-01-01T00:00:01.000Z');
const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const DTO = { role: 'user' as const, content: 'updated prompt' };
const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('database conflict', {
    code,
    clientVersion: 'test',
  });
const message = (id: string, chatId = 'chat-1', createdAt = CREATED) => ({
  id,
  chatId,
  createdAt,
  role: 'user',
  content: 'original',
  sql: null as string | null,
  explanation: null as string | null,
  error: false,
  attachments: null as unknown,
});

// A transaction-local staged store: failures (including COMMIT) discard writes.
// Nontransactional delegates throw, making ownership/write TOCTOU regressions visible.
function persistenceMock() {
  let state = {
    chats: new Map([
      ['chat-1', { id: 'chat-1', userId: 'user-1', updatedAt: VERSION }],
      ['chat-2', { id: 'chat-2', userId: 'user-1', updatedAt: VERSION }],
      [
        'chat-other',
        { id: 'chat-other', userId: 'user-2', updatedAt: VERSION },
      ],
    ]),
    messages: new Map([
      ['msg-a', message('msg-a')],
      ['msg-b', message('msg-b')],
      ['msg-c', message('msg-c')],
      ['later', message('later', 'chat-1', new Date(CREATED.getTime() + 1))],
      ['other', message('other', 'chat-2')],
    ]),
  };
  const controls = {
    failure: '' as string,
    error: new Error('database unavailable'),
    casMiss: false,
    beforeTransaction: undefined as (() => void) | undefined,
  };
  let tx: any;
  const outside = () =>
    jest.fn(() => {
      throw new Error('Read/write outside transaction');
    });
  const prisma = {
    aiChat: {
      findUnique: outside(),
      update: outside(),
      updateMany: outside(),
      delete: outside(),
    },
    aiMessage: {
      findUnique: outside(),
      create: outside(),
      update: outside(),
      deleteMany: outside(),
    },
    $transaction: jest.fn(
      async (work: (client: any) => Promise<unknown>, _options?: unknown) => {
        controls.beforeTransaction?.();
        const staged = {
          chats: new Map([...state.chats].map(([id, row]) => [id, { ...row }])),
          messages: new Map(
            [...state.messages].map(([id, row]) => [id, { ...row }]),
          ),
        };
        tx = {
          aiChat: {
            findUnique: jest.fn(
              async ({ where }: any) => staged.chats.get(where.id) ?? null,
            ),
            updateMany: jest.fn(async ({ where, data }: any) => {
              const row = staged.chats.get(where.id);
              if (controls.failure === 'bump') throw controls.error;
              if (
                controls.casMiss ||
                !row ||
                row.userId !== where.userId ||
                row.updatedAt.getTime() !== where.updatedAt.getTime()
              )
                return { count: 0 };
              staged.chats.set(row.id, { ...row, ...data });
              return { count: 1 };
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
              const row = staged.chats.get(where.id);
              if (controls.failure === 'chat-delete') throw controls.error;
              if (
                !row ||
                row.userId !== where.userId ||
                row.updatedAt.getTime() !== where.updatedAt.getTime()
              ) {
                return { count: 0 };
              }
              staged.chats.delete(row.id);
              for (const [id, item] of staged.messages)
                if (item.chatId === row.id) staged.messages.delete(id);
              return { count: 1 };
            }),
          },
          aiMessage: {
            findUnique: jest.fn(
              async ({ where }: any) => staged.messages.get(where.id) ?? null,
            ),
            create: jest.fn(async ({ data }: any) => {
              if (controls.failure === 'create') throw controls.error;
              if (controls.failure === 'duplicate') throw knownError('P2002');
              const id = data.id ?? `server-id-${staged.messages.size}`;
              if (staged.messages.has(id)) throw knownError('P2002');
              const row = {
                ...message(id, data.chatId),
                ...data,
                sql: data.sql ?? null,
                explanation: data.explanation ?? null,
                attachments:
                  data.attachments === Prisma.JsonNull
                    ? null
                    : data.attachments,
              };
              staged.messages.set(id, row);
              return row;
            }),
            update: jest.fn(async ({ where, data }: any) => {
              if (controls.failure === 'update') throw controls.error;
              const row = staged.messages.get(where.id);
              if (!row) throw knownError('P2025');
              const defined = Object.fromEntries(
                Object.entries(data).filter(([, value]) => value !== undefined),
              );
              const updated = {
                ...row,
                ...defined,
                attachments:
                  data.attachments === Prisma.JsonNull
                    ? null
                    : data.attachments,
              };
              staged.messages.set(row.id, updated);
              return updated;
            }),
            deleteMany: jest.fn(async ({ where }: any) => {
              if (controls.failure === 'delete') throw controls.error;
              let count = 0;
              for (const [id, row] of staged.messages) {
                if (
                  row.chatId !== where.chatId ||
                  (where.id && row.id !== where.id)
                )
                  continue;
                if (
                  where.chat &&
                  staged.chats.get(row.chatId)?.userId !== where.chat.userId
                )
                  continue;
                if (
                  where.OR &&
                  !where.OR.some((part: any) =>
                    part.createdAt.gt
                      ? row.createdAt > part.createdAt.gt
                      : row.createdAt.getTime() === part.createdAt.getTime() &&
                        row.id > part.id.gt,
                  )
                )
                  continue;
                staged.messages.delete(id);
                count++;
              }
              return { count };
            }),
          },
        };
        const result = await work(tx);
        if (controls.failure === 'commit') throw controls.error;
        if (controls.failure === 'serialization') throw knownError('P2034');
        state = staged;
        return result;
      },
    ),
  };
  return {
    prisma,
    controls,
    service: new AiChatService(prisma as unknown as PrismaService),
    get state() {
      return state;
    },
    get tx() {
      return tx;
    },
    snapshot: () => ({
      chats: [...state.chats.values()],
      messages: [...state.messages.values()],
    }),
  };
}

describe('AiChatService persistence integrity', () => {
  it('atomically edits the target and truncates the deterministic createdAt/id window', async () => {
    const db = persistenceMock();
    const result = await db.service.editMessageAndTruncate(
      'user-1',
      'chat-1',
      'msg-b',
      {
        ...DTO,
        expectedUpdatedAt: VERSION.toISOString(),
      },
    );
    expect(result).toMatchObject({
      id: 'msg-b',
      content: DTO.content,
      deletedCount: 2,
      persistence: { state: 'saved' },
      chatUpdatedAt: expect.any(Date),
    });
    expect(db.state.messages.has('msg-a')).toBe(true);
    expect(db.state.messages.has('msg-b')).toBe(true);
    expect(db.state.messages.has('msg-c')).toBe(false);
    expect(db.state.messages.has('later')).toBe(false);
    expect(db.state.messages.has('other')).toBe(true);
    expect(db.tx.aiMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        chatId: 'chat-1',
        chat: { userId: 'user-1' },
        OR: [
          { createdAt: { gt: CREATED } },
          { createdAt: CREATED, id: { gt: 'msg-b' } },
        ],
      },
    });
    expect(db.tx.aiChat.updateMany).toHaveBeenCalledWith({
      where: { id: 'chat-1', userId: 'user-1', updatedAt: VERSION },
      data: { updatedAt: result.chatUpdatedAt },
    });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.prisma.aiChat.findUnique).not.toHaveBeenCalled();
    expect(db.prisma.aiMessage.findUnique).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
  });

  it.each(['bump', 'update', 'delete', 'commit'])(
    'rolls back edit, history and timestamp if %s fails',
    async (failure) => {
      const db = persistenceMock();
      const before = db.snapshot();
      db.controls.failure = failure;
      await expect(
        db.service.editMessageAndTruncate('user-1', 'chat-1', 'msg-b', DTO),
      ).rejects.toBe(db.controls.error);
      expect(db.snapshot()).toEqual(before);
    },
  );

  it('rejects stale expectedUpdatedAt before touching the target or history', async () => {
    const db = persistenceMock();
    const before = db.snapshot();
    await expect(
      db.service.editMessageAndTruncate('user-1', 'chat-1', 'msg-b', {
        ...DTO,
        expectedUpdatedAt: new Date(VERSION.getTime() - 1).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.snapshot()).toEqual(before);
    expect(db.tx.aiChat.updateMany).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.update).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses a compare-and-swap miss rather than overwriting concurrent history', async () => {
    const db = persistenceMock();
    db.controls.casMiss = true;
    await expect(
      db.service.editMessageAndTruncate('user-1', 'chat-1', 'msg-b', DTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.tx.aiMessage.update).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('maps a serializable transaction conflict to 409 and discards staged history edits', async () => {
    const db = persistenceMock();
    const before = db.snapshot();
    db.controls.failure = 'serialization';
    await expect(
      db.service.editMessageAndTruncate('user-1', 'chat-1', 'msg-b', DTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.snapshot()).toEqual(before);
  });

  it.each(['edit', 'update', 'delete-after', 'delete-message'])(
    'rejects cross-chat targets for %s',
    async (operation) => {
      const db = persistenceMock();
      const before = db.snapshot();
      const call =
        operation === 'edit'
          ? db.service.editMessageAndTruncate('user-1', 'chat-1', 'other', DTO)
          : operation === 'update'
            ? db.service.updateMessage('user-1', 'chat-1', 'other', DTO)
            : operation === 'delete-after'
              ? db.service.deleteMessagesAfter('user-1', 'chat-1', 'other')
              : db.service.deleteMessage('user-1', 'chat-1', 'other');
      await expect(call).rejects.toThrow('Message not found');
      expect(db.snapshot()).toEqual(before);
    },
  );

  it.each([
    'add',
    'edit',
    'update',
    'delete-chat',
    'delete-message',
    'delete-after',
  ])(
    'rejects a different actor inside the transaction for %s',
    async (operation) => {
      const db = persistenceMock();
      const before = db.snapshot();
      const call =
        operation === 'add'
          ? db.service.addMessage('user-2', 'chat-1', DTO)
          : operation === 'edit'
            ? db.service.editMessageAndTruncate(
                'user-2',
                'chat-1',
                'msg-b',
                DTO,
              )
            : operation === 'update'
              ? db.service.updateMessage('user-2', 'chat-1', 'msg-b', DTO)
              : operation === 'delete-chat'
                ? db.service.deleteChat('user-2', 'chat-1')
                : operation === 'delete-message'
                  ? db.service.deleteMessage('user-2', 'chat-1', 'msg-b')
                  : db.service.deleteMessagesAfter('user-2', 'chat-1', 'msg-b');
      await expect(call).rejects.toThrow('Access denied');
      expect(db.snapshot()).toEqual(before);
      expect(db.tx.aiMessage.findUnique).not.toHaveBeenCalled();
      expect(db.tx.aiChat.updateMany).not.toHaveBeenCalled();
      expect(db.prisma.aiChat.findUnique).not.toHaveBeenCalled();
    },
  );

  it('keeps the legacy update route non-truncating and preserves legacy attachment arrays', async () => {
    const db = persistenceMock();
    const attachments = [
      {
        type: 'image',
        label: 'diagram.png',
        data: 'data:image/png;base64,abc',
      },
    ];
    const result = await db.service.updateMessage('user-1', 'chat-1', 'msg-b', {
      ...DTO,
      attachments,
    });
    expect(result).toMatchObject({ id: 'msg-b', attachments });
    expect(db.state.messages.size).toBe(5);
    expect(db.tx.aiMessage.deleteMany).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
  });

  it('returns the generated canonical DB id when no clientMessageId is supplied', async () => {
    const db = persistenceMock();
    const result = await db.service.addMessage('user-1', 'chat-1', DTO);
    expect(result.id).toBe('server-id-5');
    expect(db.state.messages.get(result.id)?.content).toBe(DTO.content);
    expect(result.persistence.state).toBe('saved');
  });

  it('persists a stable clientMessageId and makes identical scoped retries idempotent', async () => {
    const db = persistenceMock();
    const dto = {
      ...DTO,
      clientMessageId: CLIENT_ID,
      expectedUpdatedAt: VERSION.toISOString(),
    };
    const first = await db.service.addMessage('user-1', 'chat-1', dto);
    const retry = await db.service.addMessage('user-1', 'chat-1', dto);
    expect(first.id).toBe(CLIENT_ID);
    expect(retry).toMatchObject({
      id: CLIENT_ID,
      content: DTO.content,
      persistence: { state: 'already_saved' },
    });
    expect(retry.chatUpdatedAt).toEqual(first.chatUpdatedAt);
    expect(db.state.messages.size).toBe(6);
    expect(db.tx.aiChat.updateMany).not.toHaveBeenCalled();
    expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
  });

  it.each([
    'different-payload',
    'same-actor-other-chat',
    'other-actor-owned-chat',
  ])(
    'rejects same-id collision %s without overwriting or exposing the existing row',
    async (kind) => {
      const db = persistenceMock();
      await db.service.addMessage('user-1', 'chat-1', {
        ...DTO,
        clientMessageId: CLIENT_ID,
      });
      const before = db.snapshot();
      const actor = kind === 'other-actor-owned-chat' ? 'user-2' : 'user-1';
      const chatId =
        kind === 'other-actor-owned-chat'
          ? 'chat-other'
          : kind === 'same-actor-other-chat'
            ? 'chat-2'
            : 'chat-1';
      await expect(
        db.service.addMessage(actor, chatId, {
          ...DTO,
          clientMessageId: CLIENT_ID,
          content: kind === 'different-payload' ? 'changed' : DTO.content,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.snapshot()).toEqual(before);
      expect(db.tx.aiChat.updateMany).not.toHaveBeenCalled();
      expect(db.tx.aiMessage.update).not.toHaveBeenCalled();
      expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
    },
  );

  it('checks ownership before even resolving a duplicate id for another actor', async () => {
    const db = persistenceMock();
    await db.service.addMessage('user-1', 'chat-1', {
      ...DTO,
      clientMessageId: CLIENT_ID,
    });
    await expect(
      db.service.addMessage('user-2', 'chat-1', {
        ...DTO,
        clientMessageId: CLIENT_ID,
      }),
    ).rejects.toThrow('Access denied');
    expect(db.tx.aiMessage.findUnique).not.toHaveBeenCalled();
  });

  it.each(['create', 'commit', 'duplicate'])(
    'never reports saved or bumps the chat on add %s failure',
    async (failure) => {
      const db = persistenceMock();
      const before = db.snapshot();
      db.controls.failure = failure;
      await expect(
        db.service.addMessage('user-1', 'chat-1', {
          ...DTO,
          clientMessageId: CLIENT_ID,
        }),
      ).rejects[failure === 'duplicate' ? 'toBeInstanceOf' : 'toBe'](
        failure === 'duplicate' ? ConflictException : db.controls.error,
      );
      expect(db.snapshot()).toEqual(before);
    },
  );

  it('blocks a final add after chat deletion without any message creation', async () => {
    const db = persistenceMock();
    await db.service.deleteChat('user-1', 'chat-1');
    await expect(
      db.service.addMessage('user-1', 'chat-1', DTO),
    ).rejects.toThrow('Chat not found');
    expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
    expect(
      [...db.state.messages.values()].some((row) => row.chatId === 'chat-1'),
    ).toBe(false);
  });

  it('checks chat existence inside tx even when it was deleted while a final save was queued', async () => {
    const db = persistenceMock();
    db.controls.beforeTransaction = () => {
      db.state.chats.delete('chat-1');
    };
    await expect(
      db.service.addMessage('user-1', 'chat-1', DTO),
    ).rejects.toThrow('Chat not found');
    expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
    expect(db.prisma.aiChat.findUnique).not.toHaveBeenCalled();
  });

  it.each(['delete-message', 'delete-after', 'edit'])(
    'blocks stale final saves after %s using the chat version',
    async (operation) => {
      const db = persistenceMock();
      if (operation === 'edit')
        await db.service.editMessageAndTruncate(
          'user-1',
          'chat-1',
          'msg-b',
          DTO,
        );
      else if (operation === 'delete-after')
        await db.service.deleteMessagesAfter('user-1', 'chat-1', 'msg-b');
      else await db.service.deleteMessage('user-1', 'chat-1', 'msg-c');
      const before = db.snapshot();
      await expect(
        db.service.addMessage('user-1', 'chat-1', {
          role: 'ai',
          content: 'late response',
          clientMessageId: CLIENT_ID,
          expectedUpdatedAt: VERSION.toISOString(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.snapshot()).toEqual(before);
      expect(db.tx.aiMessage.create).not.toHaveBeenCalled();
    },
  );

  it('bumps monotonically even if two writes happen in the same millisecond', async () => {
    const db = persistenceMock();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(VERSION.getTime());
    try {
      const first = await db.service.deleteMessage('user-1', 'chat-1', 'msg-a');
      const second = await db.service.deleteMessage(
        'user-1',
        'chat-1',
        'msg-b',
      );
      expect(first.chatUpdatedAt.getTime()).toBe(VERSION.getTime() + 1);
      expect(second.chatUpdatedAt.getTime()).toBe(VERSION.getTime() + 2);
    } finally {
      clock.mockRestore();
    }
  });

  it('persists the A02 provenance envelope but excludes raw keys and unrecognized payload fields', async () => {
    const db = persistenceMock();
    const result = await db.service.addMessage('user-1', 'chat-1', {
      ...DTO,
      attachments: {
        contractVersion: 1,
        generationId: 'generation-1',
        sources: [
          'https://example.com/source',
          'https://name:secret-key@example.com',
        ],
        usage: { promptTokens: 0, completionTokens: -1 },
        warnings: ['fallback'],
        modelInfo: {
          provider: 'gemini',
          providerLabel: 'Gemini',
          model: 'test',
          apiKey: 'secret-key',
        },
        items: [
          {
            type: 'image',
            label: 'image.png',
            data: 'abc',
            apiKey: 'secret-key',
          },
        ],
        providerOverride: { apiKey: 'secret-key' },
        rawResponse: { token: 'secret-key' },
      } as any,
    });
    expect(result.attachments).toEqual({
      contractVersion: 1,
      generationId: 'generation-1',
      sources: ['https://example.com/source'],
      usage: { promptTokens: 0 },
      warnings: ['fallback'],
      modelInfo: { provider: 'gemini', providerLabel: 'Gemini', model: 'test' },
      items: [{ type: 'image', label: 'image.png', data: 'abc' }],
    });
    expect(JSON.stringify(result.attachments)).not.toContain('secret-key');
  });
});

describe('AiChatController HTTP persistence contract (mock DB)', () => {
  let app: INestApplication;
  let db: ReturnType<typeof persistenceMock>;
  beforeEach(async () => {
    db = persistenceMock();
    const module = await Test.createTestingModule({
      controllers: [AiChatController],
      providers: [{ provide: AiChatService, useValue: db.service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          if (!req.headers['x-test-user']) throw new UnauthorizedException();
          req.user = { id: req.headers['x-test-user'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });

  it('exposes the approved additive PATCH route and its canonical saved message/version', async () => {
    const response = await request(app.getHttpServer())
      .patch('/ai/chats/chat-1/messages/msg-b/edit-and-truncate')
      .set('x-test-user', 'user-1')
      .send({ ...DTO, expectedUpdatedAt: VERSION.toISOString() })
      .expect(200);
    expect(response.body).toMatchObject({
      id: 'msg-b',
      content: DTO.content,
      deletedCount: 2,
      chatUpdatedAt: expect.any(String),
      persistence: { state: 'saved' },
    });
    expect(db.state.messages.has('msg-c')).toBe(false);
  });

  it('preserves the original PATCH route without truncating messages', async () => {
    await request(app.getHttpServer())
      .patch('/ai/chats/chat-1/messages/msg-b')
      .set('x-test-user', 'user-1')
      .send(DTO)
      .expect(200);
    expect(db.state.messages.size).toBe(5);
  });

  it('returns canonical UUID on POST and already_saved on an identical retry', async () => {
    const dto = {
      ...DTO,
      clientMessageId: CLIENT_ID,
      expectedUpdatedAt: VERSION.toISOString(),
    };
    const first = await request(app.getHttpServer())
      .post('/ai/chats/chat-1/messages')
      .set('x-test-user', 'user-1')
      .send(dto)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/ai/chats/chat-1/messages')
      .set('x-test-user', 'user-1')
      .send(dto)
      .expect(201);
    expect(first.body).toMatchObject({
      id: CLIENT_ID,
      persistence: { state: 'saved' },
    });
    expect(retry.body).toMatchObject({
      id: CLIENT_ID,
      persistence: { state: 'already_saved' },
    });
    expect(retry.body.chatUpdatedAt).toBe(first.body.chatUpdatedAt);
  });

  it.each(['userId', 'actorId', 'user', 'actor'])(
    'rejects spoofed %s in the message body',
    async (field) => {
      const before = db.snapshot();
      await request(app.getHttpServer())
        .patch('/ai/chats/chat-1/messages/msg-b/edit-and-truncate')
        .set('x-test-user', 'user-1')
        .send({ ...DTO, [field]: 'user-2' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/ai/chats/chat-1/messages')
        .set('x-test-user', 'user-1')
        .send({ ...DTO, [field]: 'user-2' })
        .expect(400);
      expect(db.snapshot()).toEqual(before);
      expect(db.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('requires authentication and binds ownership to the authenticated actor', async () => {
    await request(app.getHttpServer())
      .patch('/ai/chats/chat-1/messages/msg-b/edit-and-truncate')
      .send(DTO)
      .expect(401);
    await request(app.getHttpServer())
      .patch('/ai/chats/chat-1/messages/msg-b/edit-and-truncate')
      .set('x-test-user', 'user-2')
      .send(DTO)
      .expect(403);
  });

  it('returns HTTP 409 without deleting history on a stale chat version', async () => {
    const before = db.snapshot();
    await request(app.getHttpServer())
      .patch('/ai/chats/chat-1/messages/msg-b/edit-and-truncate')
      .set('x-test-user', 'user-1')
      .send({ ...DTO, expectedUpdatedAt: '2025-01-01T00:00:00.000Z' })
      .expect(409);
    expect(db.snapshot()).toEqual(before);
  });
});
