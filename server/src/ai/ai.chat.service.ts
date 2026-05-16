import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAiChatDto,
  UpdateAiChatDto,
  AddMessageDto,
} from './dto/ai-chat.dto';

@Injectable()
export class AiChatService {
  constructor(private prisma: PrismaService) {}

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
          orderBy: { createdAt: 'asc' },
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

    // Update the updatedAt timestamp of the chat
    await this.prisma.aiChat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return this.prisma.aiMessage.create({
      data: {
        chatId,
        role: dto.role,
        content: dto.content,
        sql: dto.sql,
        explanation: dto.explanation,
        error: dto.error || false,
        attachments: dto.attachments ? dto.attachments : null,
      },
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
      where: { chatId, createdAt: { gt: target.createdAt } },
    });

    return { success: true, count: deleted.count };
  }
}
