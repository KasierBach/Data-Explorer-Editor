import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAiChatDto, UpdateAiChatDto, AddMessageDto } from './dto/ai-chat.dto';

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
            }
        });
    }

    async getChatById(userId: string, id: string) {
        const chat = await this.prisma.aiChat.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
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
            }
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
            data: { updatedAt: new Date() }
        });

        return this.prisma.aiMessage.create({
            data: {
                chatId,
                role: dto.role,
                content: dto.content,
                sql: dto.sql,
                explanation: dto.explanation,
                error: dto.error || false,
                attachments: dto.attachments ? (dto.attachments as any) : null,
            }
        });
    }
}
