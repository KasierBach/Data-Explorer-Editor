import type { StateCreator } from 'zustand';
import { AiChatService } from '../../AiChatService';

export interface AiRecommendation {
    type: 'query_fix' | 'index_suggestion' | 'schema_suggestion' | 'chart_suggestion';
    title: string;
    summary: string;
    sql?: string;
    chartType?: string;
    fields?: string[];
}

export interface AiMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    sql?: string;
    explanation?: string;
    thought?: string;
    recommendations?: AiRecommendation[];
    modelInfo?: {
        provider?: string;
        model?: string;
        routingMode?: string;
    };
    error?: boolean;
    timestamp: number;
    attachments?: { type: string; label: string; preview?: string; data?: string }[];
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
    aiRoutingMode: string;
    isFetchingAiChats: boolean;
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
    setAiRoutingMode: (mode: string) => void;
    deleteAiMessage: (chatId: string, messageId: string) => Promise<void>;
    editAiMessage: (chatId: string, messageId: string, newContent: string) => Promise<void>;
}

export const createAiChatSlice: StateCreator<AiChatSlice> = (set, get) => ({
    aiChats: [],
    activeAiChatId: null,
    aiModel: 'groq:meta-llama/llama-4-scout-17b-16e-instruct',
    aiMode: 'planning',
    aiRoutingMode: 'auto',
    isFetchingAiChats: false,
    fetchAiChats: async () => {
        set({ isFetchingAiChats: true });
        try {
            const formatted = await AiChatService.fetchChats();
            set({ aiChats: formatted });
            if (formatted.length > 0 && !get().activeAiChatId) {
                set({ activeAiChatId: formatted[0].id });
            }
        } catch (e) {
            console.error('Failed to fetch AI chats:', e);
        } finally {
            set({ isFetchingAiChats: false });
        }
    },
    loadAiChatMessages: async (chatId: string) => {
        try {
            const msgs = await AiChatService.loadMessages(chatId);
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
        } catch (e) {
            console.error('Failed to load chat messages', e);
        }
    },
    createAiChat: async () => {
        try {
            const res = await AiChatService.createChat();
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
            await AiChatService.deleteChat(id);
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

        if (message.role === 'user') {
            try {
                await AiChatService.saveMessage(chatId, message);
                // Update title on backend if it's the first user message
                const chat = get().aiChats.find(c => c.id === chatId);
                if (chat && (chat.messages || []).length <= 2) {
                    await AiChatService.updateChat(chatId, { title: chat.title });
                }
            } catch (e) {
                console.error('Failed to save message', e);
            }
        }
    },
    syncAiMessage: async (chatId, message) => {
        try {
            if (!message.content && !message.sql && !message.error) return;
            await AiChatService.saveMessage(chatId, message);
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
            await AiChatService.updateChat(chatId, { title });
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
    setAiRoutingMode: (mode) => set({ aiRoutingMode: mode }),
    deleteAiMessage: async (chatId, messageId) => {
        try {
            await AiChatService.deleteMessage(chatId, messageId);
            set((state) => ({
                aiChats: state.aiChats.map(chat =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            messages: chat.messages.filter(m => m.id !== messageId)
                        }
                        : chat
                )
            }));
        } catch (e) {
            console.error('Failed to delete message', e);
        }
    },
    editAiMessage: async (chatId, messageId, newContent) => {
        try {
            // ChatGPT logic: delete all messages after the edited message
            await AiChatService.deleteMessagesAfter(chatId, messageId);

            const state = get();
            const chatToUpdate = state.aiChats.find(c => c.id === chatId);
            const msgToUpdate = chatToUpdate?.messages.find(m => m.id === messageId);
            if (msgToUpdate) {
                await AiChatService.saveMessage(chatId, { ...msgToUpdate, content: newContent } as any);
            }
            
            set((state) => ({
                aiChats: state.aiChats.map(chat => {
                    if (chat.id !== chatId) return chat;
                    
                    const messageIndex = chat.messages.findIndex(m => m.id === messageId);
                    if (messageIndex === -1) return chat;
                    
                    const updatedMessages = chat.messages.slice(0, messageIndex + 1).map(m => 
                        m.id === messageId ? { ...m, content: newContent } : m
                    );
                    
                    return {
                        ...chat,
                        messages: updatedMessages,
                        updatedAt: Date.now()
                    };
                })
            }));
            
            // Note: The caller (UI) is responsible for triggering the new AI request
        } catch (e) {
            console.error('Failed to edit message', e);
        }
    },
});
