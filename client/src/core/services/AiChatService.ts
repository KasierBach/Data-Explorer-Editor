import { apiService } from './api.service';
import type { AiMessage, AiChat } from './store/slices/aiChatSlice';

function normalizeAttachmentPayload(payload: any): {
    attachments?: { type: string; label: string; preview?: string }[];
    modelInfo?: AiMessage['modelInfo'];
    recommendations?: AiMessage['recommendations'];
} {
    if (Array.isArray(payload)) {
        return { attachments: payload };
    }

    if (payload && typeof payload === 'object') {
        return {
            attachments: Array.isArray(payload.items) ? payload.items : undefined,
            modelInfo: payload.modelInfo || undefined,
            recommendations: Array.isArray(payload.recommendations) ? payload.recommendations : undefined,
        };
    }

    return {};
}

export class AiChatService {
    static async fetchChats(): Promise<AiChat[]> {
        const data = await apiService.get<any[]>('/ai/chats');
        return data.map(chat => ({
            id: chat.id,
            title: chat.title,
            createdAt: new Date(chat.createdAt).getTime(),
            updatedAt: new Date(chat.updatedAt).getTime(),
            messages: [] // Loaded lazily
        }));
    }

    static async loadMessages(chatId: string): Promise<AiMessage[]> {
        const data = await apiService.get<any>(`/ai/chats/${chatId}`);
        if (!data.messages) return [];
        
        return data.messages.map((m: any) => ({
            id: m.id,
            role: m.role === 'model' ? 'ai' : m.role,
            content: m.content,
            sql: m.sql,
            explanation: m.explanation,
            thought: m.thought,
            error: m.error,
            ...normalizeAttachmentPayload(m.attachments),
            timestamp: new Date(m.createdAt).getTime()
        }));
    }

    static async createChat(title: string = 'Cuộc trò chuyện mới'): Promise<any> {
        return await apiService.post<any>('/ai/chats', { title });
    }

    static async deleteChat(id: string): Promise<void> {
        await apiService.delete(`/ai/chats/${id}`);
    }

    static async saveMessage(chatId: string, message: Partial<AiMessage>): Promise<void> {
        const attachmentsPayload = message.modelInfo || message.recommendations
            ? {
                items: message.attachments || [],
                modelInfo: message.modelInfo,
                recommendations: message.recommendations,
            }
            : message.attachments;

        await apiService.post(`/ai/chats/${chatId}/messages`, {
            role: message.role,
            content: message.content,
            sql: message.sql,
            explanation: message.explanation,
            thought: message.thought,
            error: message.error || false,
            attachments: attachmentsPayload
        });
    }

    static async updateChat(chatId: string, updates: { title?: string }): Promise<void> {
        await apiService.patch(`/ai/chats/${chatId}`, updates);
    }

    static async deleteMessage(chatId: string, messageId: string): Promise<void> {
        await apiService.delete(`/ai/chats/${chatId}/messages/${messageId}`);
    }

    static async deleteMessagesAfter(chatId: string, messageId: string): Promise<void> {
        await apiService.delete(`/ai/chats/${chatId}/messages/after/${messageId}`);
    }
}
