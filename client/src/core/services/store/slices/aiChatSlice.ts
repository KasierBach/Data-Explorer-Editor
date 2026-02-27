import type { StateCreator } from 'zustand';

export interface AiMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
    sql?: string;
    explanation?: string;
    error?: boolean;
    timestamp: number;
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
    createAiChat: () => string;
    deleteAiChat: (id: string) => void;
    setActiveAiChat: (id: string) => void;
    addAiMessage: (chatId: string, message: AiMessage) => void;
    updateAiChatTitle: (chatId: string, title: string) => void;
    clearAiChats: () => void;
    setAiModel: (model: string) => void;
    setAiMode: (mode: string) => void;
}

export const createAiChatSlice: StateCreator<AiChatSlice> = (set) => ({
    aiChats: [],
    activeAiChatId: null,
    aiModel: 'gemini-3-flash-preview',
    aiMode: 'planning',
    createAiChat: () => {
        const id = `chat-${Date.now()}`;
        const newChat: AiChat = {
            id,
            title: 'Cuộc trò chuyện mới',
            messages: [{
                id: 'welcome',
                role: 'ai',
                content: 'Xin chào! Tôi là AI Assistant — bạn có thể hỏi tôi bất cứ điều gì: SQL, coding, kiến thức chung, hay chỉ đơn giản là trò chuyện. Khi cần truy vấn database, tôi sẽ tự động sinh SQL dựa trên schema của bạn.',
                timestamp: Date.now(),
            }],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        set((state) => ({
            aiChats: [newChat, ...state.aiChats],
            activeAiChatId: id,
        }));
        return id;
    },
    deleteAiChat: (id) => set((state) => {
        const remaining = state.aiChats.filter(c => c.id !== id);
        return {
            aiChats: remaining,
            activeAiChatId: state.activeAiChatId === id
                ? (remaining[0]?.id || null)
                : state.activeAiChatId,
        };
    }),
    setActiveAiChat: (id) => set({ activeAiChatId: id }),
    addAiMessage: (chatId, message) => set((state) => ({
        aiChats: state.aiChats.map(chat =>
            chat.id === chatId
                ? {
                    ...chat,
                    messages: [...chat.messages, message],
                    updatedAt: Date.now(),
                    title: chat.messages.length <= 1 && message.role === 'user'
                        ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
                        : chat.title,
                }
                : chat
        ),
    })),
    updateAiChatTitle: (chatId, title) => set((state) => ({
        aiChats: state.aiChats.map(chat =>
            chat.id === chatId ? { ...chat, title } : chat
        ),
    })),
    clearAiChats: () => set({ aiChats: [], activeAiChatId: null }),
    setAiModel: (model) => set({ aiModel: model }),
    setAiMode: (mode) => set({ aiMode: mode }),
});
