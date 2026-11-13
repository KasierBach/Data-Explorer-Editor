import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AiChat, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAiChatDto,
  UpdateAiChatDto,
  AddMessageDto,
  EditMessageAndTruncateDto,
} from './dto/ai-chat.dto';

@Injectable()
export class AiChatService {
  constructor(private prisma: PrismaService) {}

  private toPrismaMessagePayload(dto: AddMessageDto) {
    if (dto.attachments == null) return Prisma.JsonNull;

    // Reuse the A02 envelope without persisting arbitrary provider overrides,
    // raw responses, or credential fields alongside its public metadata.
    const record = (value: unknown): Record<string, unknown> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException('Invalid message payload');
      }
      return value as Record<string, unknown>;
    };
    const stringFields = (value: Record<string, unknown>, keys: string[]) => {
      const result: Record<string, string> = {};
      for (const key of keys) {
        if (typeof value[key] === 'string') result[key] = value[key];
      }
      return result;
    };
    const stringArray = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
    const items = (value: unknown) => {
      if (!Array.isArray(value)) {
        throw new BadRequestException('Invalid message attachments');
      }
      return value.map((item) => {
        const attachment = record(item);
        if (
          typeof attachment.type !== 'string' ||
          typeof attachment.label !== 'string'
        ) {
          throw new BadRequestException('Invalid message attachment');
        }
        return stringFields(attachment, ['type', 'label', 'preview', 'data']);
      });
    };

    if (Array.isArray(dto.attachments)) return items(dto.attachments);
    const envelope = record(dto.attachments);
    const payload: Record<string, Prisma.InputJsonValue | null> = {};
    if (envelope.items !== undefined) payload.items = items(envelope.items);
    if (envelope.modelInfo != null) {
      payload.modelInfo = stringFields(record(envelope.modelInfo), [
        'provider',
        'providerLabel',
        'model',
        'routingMode',
      ]);
    }
    if (envelope.recommendations !== undefined) {
      if (!Array.isArray(envelope.recommendations)) {
        throw new BadRequestException('Invalid message recommendations');
      }
      payload.recommendations = envelope.recommendations.map((item) => {
        const recommendation = record(item);
        const result: Record<string, Prisma.InputJsonValue> = stringFields(
          recommendation,
          ['type', 'title', 'summary', 'sql', 'chartType'],
        );
        if (Array.isArray(recommendation.fields))
          result.fields = stringArray(recommendation.fields);
        return result;
      });
    }
    if (Array.isArray(envelope.sources)) {
      const sources = new Set<string>();
      for (const source of stringArray(envelope.sources)) {
        if (
          [...source].some((character) => {
            const code = character.charCodeAt(0);
            return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
          }) ||
          /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(source)
        )
          continue;
        try {
          const url = new URL(source.trim());
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.username ||
            url.password
          )
            continue;
          sources.add(url.toString());
          if (sources.size === 6) break;
        } catch {
          /* Invalid citation URLs are not provenance. */
        }
      }
      payload.sources = [...sources];
    }
    const usage = (key: 'usage' | 'observedUsage') => {
      if (envelope[key] === null) {
        payload[key] = null;
        return;
      }
      if (envelope[key] === undefined) return;
      const value = record(envelope[key]);
      const counters: Record<string, number | null> = {};
      for (const counter of [
        'promptTokens',
        'completionTokens',
        'totalTokens',
      ]) {
        const observed = value[counter];
        if (
          observed === null ||
          (typeof observed === 'number' &&
            Number.isSafeInteger(observed) &&
            observed >= 0)
        )
          counters[counter] = observed;
      }
      if (Object.keys(counters).length) payload[key] = counters;
    };

    usage('usage');
    usage('observedUsage');
    if (
      typeof envelope.usageCoverage === 'string' &&
      ['complete', 'partial', 'unavailable'].includes(envelope.usageCoverage)
    )
      payload.usageCoverage = envelope.usageCoverage;
    const attemptCount =
      typeof envelope.attemptCount === 'number' &&
      Number.isSafeInteger(envelope.attemptCount) &&
      envelope.attemptCount >= 0 &&
      envelope.attemptCount <= 8
        ? envelope.attemptCount
        : undefined;
    const measuredAttemptCount =
      typeof envelope.measuredAttemptCount === 'number' &&
      Number.isSafeInteger(envelope.measuredAttemptCount) &&
      envelope.measuredAttemptCount >= 0 &&
      envelope.measuredAttemptCount <= 8
        ? envelope.measuredAttemptCount
        : undefined;
    if (attemptCount !== undefined) payload.attemptCount = attemptCount;
    if (
      measuredAttemptCount !== undefined &&
      (attemptCount === undefined || measuredAttemptCount <= attemptCount)
    )
      payload.measuredAttemptCount = measuredAttemptCount;
    if (envelope.costCoverage === 'unavailable')
      payload.costCoverage = 'unavailable';
    if (Array.isArray(envelope.warnings)) {
      payload.warnings = stringArray(envelope.warnings).filter((value) =>
        value.trim(),
      );
    }
    if (typeof envelope.generationId === 'string')
      payload.generationId = envelope.generationId;
    if (envelope.contractVersion === 1) payload.contractVersion = 1;
    return payload;
  }

  private async withOwnedChatWrite<T>(
    userId: string,
    chatId: string,
    write: (
      tx: Prisma.TransactionClient,
      chat: Pick<AiChat, 'id' | 'userId' | 'updatedAt'>,
      bumpChat: (expectedUpdatedAt?: string) => Promise<Date>,
    ) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const chat = await tx.aiChat.findUnique({
            where: { id: chatId },
            select: { id: true, userId: true, updatedAt: true },
          });
          if (!chat) throw new NotFoundException('Chat not found');
          if (chat.userId !== userId)
            throw new ForbiddenException('Access denied');

          const bumpChat = async (expectedUpdatedAt?: string) => {
            if (
              expectedUpdatedAt !== undefined &&
              new Date(expectedUpdatedAt).getTime() !== chat.updatedAt.getTime()
            ) {
              throw new ConflictException('Chat changed; reload before saving');
            }
            // Strictly increasing timestamps distinguish even same-ms writes.
            const updatedAt = new Date(
              Math.max(Date.now(), chat.updatedAt.getTime() + 1),
            );
            const changed = await tx.aiChat.updateMany({
              where: { id: chatId, userId, updatedAt: chat.updatedAt },
              data: { updatedAt },
            });
            if (changed.count !== 1)
              throw new ConflictException('Chat changed; reload before saving');
            return updatedAt;
          };
          return write(tx, chat, bumpChat);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034')
          throw new ConflictException('Chat changed; reload and retry');
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Message id already exists; retry with the same payload or use a new id',
          );
        }
      }
      // A failed write or COMMIT must never be reported as saved.
      throw error;
    }
  }

  async getChats(userId: string) {
    return this.prisma.aiChat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        connectionId: true,
        database: true,
      },
    });
  }

  async getChatById(userId: string, id: string) {
    const chat = await this.prisma.aiChat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    return chat;
  }

  async createChat(userId: string, dto: CreateAiChatDto) {
    return this.prisma.aiChat.create({
      data: {
        title: dto.title,
        connectionId: dto.connectionId,
        database: dto.database,
        userId,
      },
    });
  }

  async updateChat(userId: string, id: string, dto: UpdateAiChatDto) {
    const chat = await this.prisma.aiChat.findUnique({ where: { id } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.aiChat.update({
      where: { id },
      data: { title: dto.title },
    });
  }

  async deleteChat(userId: string, id: string) {
    return this.withOwnedChatWrite(userId, id, async (tx, _chat, bumpChat) => {
      const updatedAt = await bumpChat();
      const deleted = await tx.aiChat.deleteMany({
        where: { id, userId, updatedAt },
      });
      if (deleted.count !== 1) throw new NotFoundException('Chat not found');
      return { success: true };
    });
  }

  async addMessage(userId: string, chatId: string, dto: AddMessageDto) {
    return this.withOwnedChatWrite(
      userId,
      chatId,
      async (tx, chat, bumpChat) => {
        const attachments = this.toPrismaMessagePayload(dto);
        if (dto.clientMessageId) {
          const existing = await tx.aiMessage.findUnique({
            where: { id: dto.clientMessageId },
          });
          if (existing) {
            const samePayload =
              existing.chatId === chatId &&
              existing.role === dto.role &&
              existing.content === dto.content &&
              existing.sql === (dto.sql ?? null) &&
              existing.explanation === (dto.explanation ?? null) &&
              existing.error === (dto.error ?? false) &&
              isDeepStrictEqual(
                existing.attachments,
                attachments === Prisma.JsonNull ? null : attachments,
              );
            if (!samePayload)
              throw new ConflictException(
                'Message id already exists with a different chat or payload',
              );
            // A committed retry does not overwrite or bump again, even when its
            // original expected version is stale after the successful first write.
            return {
              ...existing,
              chatUpdatedAt: chat.updatedAt,
              persistence: { state: 'already_saved' as const },
            };
          }
        }
        const chatUpdatedAt = await bumpChat(dto.expectedUpdatedAt);
        const message = await tx.aiMessage.create({
          data: {
            ...(dto.clientMessageId ? { id: dto.clientMessageId } : {}),
            chatId,
            role: dto.role,
            content: dto.content,
            sql: dto.sql,
            explanation: dto.explanation,
            error: dto.error ?? false,
            attachments,
          },
        });
        return {
          ...message,
          chatUpdatedAt,
          persistence: { state: 'saved' as const },
        };
      },
    );
  }

  async updateMessage(
    userId: string,
    chatId: string,
    messageId: string,
    dto: AddMessageDto,
  ) {
    return this.withOwnedChatWrite(
      userId,
      chatId,
      async (tx, _chat, bumpChat) => {
        const target = await tx.aiMessage.findUnique({
          where: { id: messageId },
          select: { id: true, chatId: true },
        });
        if (!target || target.chatId !== chatId)
          throw new NotFoundException('Message not found');
        const chatUpdatedAt = await bumpChat(dto.expectedUpdatedAt);
        const message = await tx.aiMessage.update({
          where: { id: messageId },
          data: {
            role: dto.role,
            content: dto.content,
            sql: dto.sql,
            explanation: dto.explanation,
            error: dto.error ?? false,
            attachments: this.toPrismaMessagePayload(dto),
          },
        });
        return {
          ...message,
          chatUpdatedAt,
          persistence: { state: 'saved' as const },
        };
      },
    );
  }

  async editMessageAndTruncate(
    userId: string,
    chatId: string,
    messageId: string,
    dto: EditMessageAndTruncateDto,
  ) {
    return this.withOwnedChatWrite(
      userId,
      chatId,
      async (tx, _chat, bumpChat) => {
        const target = await tx.aiMessage.findUnique({
          where: { id: messageId },
          select: { id: true, chatId: true, createdAt: true },
        });
        if (!target || target.chatId !== chatId)
          throw new NotFoundException('Message not found');
        const chatUpdatedAt = await bumpChat(dto.expectedUpdatedAt);
        const message = await tx.aiMessage.update({
          where: { id: messageId },
          data: {
            role: dto.role,
            content: dto.content,
            sql: dto.sql,
            explanation: dto.explanation,
            error: dto.error ?? false,
            attachments: this.toPrismaMessagePayload(dto),
          },
        });
        const deleted = await tx.aiMessage.deleteMany({
          where: {
            chatId,
            chat: { userId },
            OR: [
              { createdAt: { gt: target.createdAt } },
              { createdAt: target.createdAt, id: { gt: target.id } },
            ],
          },
        });
        return {
          ...message,
          chatUpdatedAt,
          deletedCount: deleted.count,
          persistence: { state: 'saved' as const },
        };
      },
    );
  }

  async deleteMessage(userId: string, chatId: string, messageId: string) {
    return this.withOwnedChatWrite(
      userId,
      chatId,
      async (tx, _chat, bumpChat) => {
        const chatUpdatedAt = await bumpChat();
        const deleted = await tx.aiMessage.deleteMany({
          where: { id: messageId, chatId, chat: { userId } },
        });
        if (deleted.count === 0)
          throw new NotFoundException('Message not found');
        return { success: true, chatUpdatedAt };
      },
    );
  }

  async deleteMessagesAfter(userId: string, chatId: string, messageId: string) {
    return this.withOwnedChatWrite(
      userId,
      chatId,
      async (tx, _chat, bumpChat) => {
        const target = await tx.aiMessage.findUnique({
          where: { id: messageId },
          select: { id: true, chatId: true, createdAt: true },
        });
        if (!target || target.chatId !== chatId)
          throw new NotFoundException('Message not found');
        const chatUpdatedAt = await bumpChat();
        const deleted = await tx.aiMessage.deleteMany({
          where: {
            chatId,
            chat: { userId },
            OR: [
              { createdAt: { gt: target.createdAt } },
              { createdAt: target.createdAt, id: { gt: target.id } },
            ],
          },
        });
        return { success: true, count: deleted.count, chatUpdatedAt };
      },
    );
  }
}
