import type { StateCreator } from 'zustand';
import { apiService } from '../../api.service';

export interface AiMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    sql?: string;
    explanation?: string;
    error?: boolean;
    timestamp: number;
    attachments?: { type: string; label: string; preview?: string }[];
}

export interface AiChat {
    id: string;
    title: string;
    messages: AiMessage[];
    createdAt: number;
    updatedAt: number;
}

export interface AiChatSlice {
    aiChats: AiChat[];
    activeAiChatId: string | null;
    aiModel: string;
    aiMode: string;
    fetchAiChats: () => Promise<void>;
    loadAiChatMessages: (chatId: string) => Promise<void>;
    createAiChat: () => Promise<string | null>;
    deleteAiChat: (id: string) => Promise<void>;
    setActiveAiChat: (id: string) => void;
    addAiMessage: (chatId: string, message: AiMessage) => Promise<void>;
    syncAiMessage: (chatId: string, message: AiMessage) => Promise<void>;
    updateAiMessage: (chatId: string, messageId: string, updates: Partial<AiMessage>) => void;
    updateAiChatTitle: (chatId: string, title: string) => Promise<void>;
    clearAiChats: () => void;
    setAiModel: (model: string) => void;
    setAiMode: (mode: string) => void;
}

export const createAiChatSlice: StateCreator<AiChatSlice> = (set, get) => ({
    aiChats: [],
    activeAiChatId: null,
    aiModel: 'gemini-3-flash-preview',
    aiMode: 'planning',
    fetchAiChats: async () => {
        try {
            const data = await apiService.get<any[]>('/api/ai/chats');
            const formatted = data.map(chat => ({
                id: chat.id,
                title: chat.title,
                createdAt: new Date(chat.createdAt).getTime(),
                updatedAt: new Date(chat.updatedAt).getTime(),
                messages: [] // Loaded lazily
            }));
            set({ aiChats: formatted });
            if (formatted.length > 0 && !get().activeAiChatId) {
                set({ activeAiChatId: formatted[0].id });
            }
        } catch (e) {
            console.error('Failed to fetch AI chats:', e);
        }
    },
    loadAiChatMessages: async (chatId: string) => {
        try {
            const data = await apiService.get<any>(`/api/ai/chats/${chatId}`);
            if (data.messages) {
                const msgs = data.messages.map((m: any) => ({
                    id: m.id,
                    role: m.role === 'model' ? 'ai' : m.role, // Handle Prisma enum
                    content: m.content,
                    sql: m.sql,
                    explanation: m.explanation,
                    error: m.error,
                    attachments: m.attachments,
                    timestamp: new Date(m.createdAt).getTime()
                }));
                // Ensure welcome message is always first if empty
                if (msgs.length === 0) {
                     msgs.push({
                        id: 'welcome',
                        role: 'ai',
                        content: 'Xin chào! Tôi là AI Assistant — bạn có thể hỏi tôi bất cứ điều gì: SQL, coding, kiến thức chung, hay chỉ đơn giản là trò chuyện. Khi cần truy vấn database, tôi sẽ tự động sinh SQL dựa trên schema của bạn.',
                        timestamp: Date.now(),
                    });
                }
                set((state) => ({
                    aiChats: state.aiChats.map(c => c.id === chatId ? { ...c, messages: msgs } : c)
                }));
            }
        } catch (e) {
            console.error('Failed to load chat messages', e);
        }
    },
    createAiChat: async () => {
        try {
            const res = await apiService.post<any>('/api/ai/chats', {
                title: 'Cuộc trò chuyện mới',
            });
            const newChat: AiChat = {
                id: res.id,
                title: res.title,
                messages: [{
                    id: 'welcome',
                    role: 'ai',
                    content: 'Xin chào! Tôi là AI Assistant — bạn có thể hỏi tôi bất cứ điều gì: SQL, coding, kiến thức chung, hay chỉ đơn giản là trò chuyện. Khi cần truy vấn database, tôi sẽ tự động sinh SQL dựa trên schema của bạn.',
                    timestamp: Date.now(),
                }],
                createdAt: new Date(res.createdAt).getTime(),
                updatedAt: new Date(res.updatedAt).getTime(),
            };
            set((state) => ({
                aiChats: [newChat, ...state.aiChats],
                activeAiChatId: res.id,
            }));
            return res.id;
        } catch (e) {
            console.error('Failed to create chat', e);
            return null;
        }
    },
    deleteAiChat: async (id) => {
        try {
            await apiService.delete(`/api/ai/chats/${id}`);
            set((state) => {
                const remaining = state.aiChats.filter(c => c.id !== id);
                return {
                    aiChats: remaining,
                    activeAiChatId: state.activeAiChatId === id ? (remaining[0]?.id || null) : state.activeAiChatId,
                };
            });
        } catch (e) {
            console.error('Failed to delete chat', e);
        }
    },
    setActiveAiChat: (id) => set({ activeAiChatId: id }),
    addAiMessage: async (chatId, message) => {
        // Optimistic UI update
        set((state) => ({
            aiChats: state.aiChats.map(chat =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: [...(chat.messages || []), message],
                        updatedAt: Date.now(),
                        title: (chat.messages || []).length <= 1 && message.role === 'user'
                            ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
                            : chat.title,
                    }
                    : chat
            ),
        }));

        // We only auto-sync user messages. AI messages are synced separately via syncAiMessage when streaming finishes.
        if (message.role === 'user') {
            try {
                await apiService.post(`/api/ai/chats/${chatId}/messages`, {
                    role: message.role,
                    content: message.content,
                    attachments: message.attachments
                });

                // Update title on backend if it's the first user message
                const chat = get().aiChats.find(c => c.id === chatId);
                if (chat && (chat.messages || []).length <= 2) {
                    await apiService.patch(`/api/ai/chats/${chatId}`, { title: chat.title });
                }
            } catch (e) {
                console.error('Failed to save message', e);
            }
        }
    },
    syncAiMessage: async (chatId, message) => {
        // Called explicitly to save AI messages to the backend once stream finishes
        try {
             // Only sync if the message has content
            if (!message.content && !message.sql && !message.error) return;
            await apiService.post(`/api/ai/chats/${chatId}/messages`, {
                role: 'ai', // map "model" to "ai" logic handled by backend taking what it gets, but Prisma only stores string
                content: message.content,
                sql: message.sql,
                explanation: message.explanation,
                error: message.error || false,
                attachments: message.attachments
            });
        } catch (e) {
            console.error('Failed to sync AI message', e);
        }
    },
    updateAiMessage: (chatId, messageId, updates) => set((state) => ({
        aiChats: state.aiChats.map(chat =>
            chat.id === chatId
                ? {
                    ...chat,
                    messages: (chat.messages || []).map(msg =>
                        msg.id === messageId ? { ...msg, ...updates } : msg
                    ),
                    updatedAt: Date.now(),
                }
                : chat
        ),
    })),
    updateAiChatTitle: async (chatId, title) => {
        try {
            await apiService.patch(`/api/ai/chats/${chatId}`, { title });
            set((state) => ({
                aiChats: state.aiChats.map(chat =>
                    chat.id === chatId ? { ...chat, title } : chat
                ),
            }));
        } catch (e) {}
    },
    clearAiChats: () => set({ aiChats: [], activeAiChatId: null }),
    setAiModel: (model) => set({ aiModel: model }),
    setAiMode: (mode) => set({ aiMode: mode }),
});
