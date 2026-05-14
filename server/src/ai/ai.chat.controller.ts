import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AiChatService } from './ai.chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAiChatDto, UpdateAiChatDto, AddMessageDto } from './dto/ai-chat.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('ai/chats')
@UseGuards(JwtAuthGuard)
export class AiChatController {
    constructor(private readonly aiChatService: AiChatService) {}

    @Get()
    getChats(@Request() req: AuthenticatedRequest) {
        return this.aiChatService.getChats(req.user.id);
    }

    @Get(':id')
    getChatById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.aiChatService.getChatById(req.user.id, id);
    }

    @Post()
    createChat(@Request() req: AuthenticatedRequest, @Body() dto: CreateAiChatDto) {
        return this.aiChatService.createChat(req.user.id, dto);
    }

    @Patch(':id')
    updateChat(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateAiChatDto) {
        return this.aiChatService.updateChat(req.user.id, id, dto);
    }

    @Delete(':id')
    deleteChat(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.aiChatService.deleteChat(req.user.id, id);
    }

    @Post(':id/messages')
    addMessage(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AddMessageDto) {
        return this.aiChatService.addMessage(req.user.id, id, dto);
    }

    @Delete(':id/messages/:messageId')
    deleteMessage(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Param('messageId') messageId: string) {
        return this.aiChatService.deleteMessage(req.user.id, id, messageId);
    }

    @Delete(':id/messages/after/:messageId')
    deleteMessagesAfter(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Param('messageId') messageId: string) {
        return this.aiChatService.deleteMessagesAfter(req.user.id, id, messageId);
    }
}
