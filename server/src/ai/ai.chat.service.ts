import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAiChatDto,
  UpdateAiChatDto,
  AddMessageDto,
} from './dto/ai-chat.dto';

@Injectable()
export class AiChatService {
  constructor(private prisma: PrismaService) {}

  private toPrismaMessagePayload(dto: AddMessageDto) {
    return dto.attachments === undefined
      ? Prisma.JsonNull
      : (dto.attachments as Prisma.InputJsonValue);
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
    const chat = await this.prisma.aiChat.findUnique({ where: { id } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.aiChat.delete({ where: { id } });
    return { success: true };
  }

  async addMessage(userId: string, chatId: string, dto: AddMessageDto) {
    const chat = await this.prisma.aiChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    // Update the chat timestamp and create the message atomically so a failed
    // write cannot leave updatedAt bumped without the message existing.
    return this.prisma.$transaction(async (tx) => {
      await tx.aiChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      return tx.aiMessage.create({
        data: {
          chatId,
          role: dto.role,
          content: dto.content,
          sql: dto.sql,
          explanation: dto.explanation,
          error: dto.error || false,
          attachments: this.toPrismaMessagePayload(dto),
        },
      });
    });
  }

  async updateMessage(
    userId: string,
    chatId: string,
    messageId: string,
    dto: AddMessageDto,
  ) {
    const chat = await this.prisma.aiChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    const target = await this.prisma.aiMessage.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true },
    });
    if (!target || target.chatId !== chatId)
      throw new NotFoundException('Message not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.aiChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });

      return tx.aiMessage.update({
        where: { id: messageId },
        data: {
          role: dto.role,
          content: dto.content,
          sql: dto.sql,
          explanation: dto.explanation,
          error: dto.error || false,
          attachments: this.toPrismaMessagePayload(dto),
        },
      });
    });
  }

  async deleteMessage(userId: string, chatId: string, messageId: string) {
    const chat = await this.prisma.aiChat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    const deleted = await this.prisma.aiMessage.deleteMany({
      where: { id: messageId, chatId },
    });

    if (deleted.count === 0) throw new NotFoundException('Message not found');

    return { success: true };
  }

  async deleteMessagesAfter(userId: string, chatId: string, messageId: string) {
    const chat = await this.prisma.aiChat.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.userId !== userId) throw new ForbiddenException('Access denied');

    const target = await this.prisma.aiMessage.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, createdAt: true },
    });
    if (!target || target.chatId !== chatId)
      throw new NotFoundException('Message not found');

    const deleted = await this.prisma.aiMessage.deleteMany({
      where: {
        chatId,
        OR: [
          { createdAt: { gt: target.createdAt } },
          { createdAt: target.createdAt, id: { gt: target.id } },
        ],
      },
    });

    return { success: true, count: deleted.count };
  }
}
