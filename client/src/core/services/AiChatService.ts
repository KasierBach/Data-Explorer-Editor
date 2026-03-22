import { apiService } from './api.service';
import type { AiMessage, AiChat } from './store/slices/aiChatSlice';

export class AiChatService {
    static async fetchChats(): Promise<AiChat[]> {
        const data = await apiService.get<any[]>('/api/ai/chats');
        return data.map(chat => ({
            id: chat.id,
            title: chat.title,
            createdAt: new Date(chat.createdAt).getTime(),
            updatedAt: new Date(chat.updatedAt).getTime(),
            messages: [] // Loaded lazily
        }));
    }

    static async loadMessages(chatId: string): Promise<AiMessage[]> {
        const data = await apiService.get<any>(`/api/ai/chats/${chatId}`);
        if (!data.messages) return [];
        
        return data.messages.map((m: any) => ({
            id: m.id,
            role: m.role === 'model' ? 'ai' : m.role,
            content: m.content,
            sql: m.sql,
            explanation: m.explanation,
            error: m.error,
            attachments: m.attachments,
            timestamp: new Date(m.createdAt).getTime()
        }));
    }

    static async createChat(title: string = 'Cuộc trò chuyện mới'): Promise<any> {
        return await apiService.post<any>('/api/ai/chats', { title });
    }

    static async deleteChat(id: string): Promise<void> {
        await apiService.delete(`/api/ai/chats/${id}`);
    }

    static async saveMessage(chatId: string, message: Partial<AiMessage>): Promise<void> {
        await apiService.post(`/api/ai/chats/${chatId}/messages`, {
            role: message.role,
            content: message.content,
            sql: message.sql,
            explanation: message.explanation,
            error: message.error || false,
            attachments: message.attachments
        });
    }

    static async updateChat(chatId: string, updates: { title?: string }): Promise<void> {
        await apiService.patch(`/api/ai/chats/${chatId}`, updates);
    }
}
