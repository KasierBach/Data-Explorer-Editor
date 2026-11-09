import type { StateCreator } from 'zustand';
import { AiChatService, type AiMessagePersistenceResult } from '../../AiChatService';

export type AiMessageDelivery = 'local' | 'pending' | 'saved' | 'failed' | 'interrupted';

export interface AiMessageDeliveryError {
    message: string;
    statusCode?: number;
    reason?: string;
}

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
    clientId?: string;
    delivery?: AiMessageDelivery;
    deliveryError?: AiMessageDeliveryError;
    role: 'user' | 'ai';
    content: string;
    sql?: string;
    explanation?: string;
    thought?: string;
    recommendations?: AiRecommendation[];
    sources?: string[];
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    warnings?: string[];
    generationId?: string;
    contractVersion?: 1;
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
    serverUpdatedAt?: string;
}

export function findAiMessage(chat: AiChat | undefined, messageId: string): AiMessage | undefined {
    return chat?.messages.find(message => message.id === messageId || message.clientId === messageId);
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
    addAiMessage: (chatId: string, message: AiMessage) => Promise<AiMessage>;
    syncAiMessage: (chatId: string, message: AiMessage) => Promise<AiMessage | undefined>;
    waitForAiMessagePersistence: (chatId: string, messageId: string) => Promise<AiMessage>;
    updateAiMessage: (chatId: string, messageId: string, updates: Partial<AiMessage>) => void;
    updateAiChatTitle: (chatId: string, title: string) => Promise<void>;
    clearAiChats: () => void;
    setAiModel: (model: string) => void;
    setAiMode: (mode: string) => void;
    setAiRoutingMode: (mode: string) => void;
    deleteAiMessage: (chatId: string, messageId: string) => Promise<void>;
    editAiMessage: (chatId: string, messageId: string, newContent: string) => Promise<void>;
}

export const createAiChatSlice: StateCreator<AiChatSlice> = (set, get, api) => {
    let generation = 0;
    const chatRevisions = new Map<string, number>();
    const deletingChats = new Set<string>();
    const chatWrites = new Map<string, Promise<unknown>>();
    const pendingSaves = new Map<string, { payload: string; promise: Promise<AiMessage> }>();
    const savedIds = new Map<string, string>();
    const savedPayloads = new Map<string, string>();
    const messageKey = (chatId: string, clientId: string) => JSON.stringify([chatId, clientId]);
    const actorKey = (state: AiChatSlice) => {
        const auth = state as AiChatSlice & { isAuthenticated?: boolean; user?: { id?: string; email?: string } | null };
        return JSON.stringify([auth.isAuthenticated, auth.user?.id || auth.user?.email || null]);
    };
    const invalidate = () => {
        generation += 1;
        chatWrites.clear();
        pendingSaves.clear();
        savedIds.clear();
        savedPayloads.clear();
    };
    // Auth resets use setState directly, not necessarily clearAiChats.
    api.subscribe((state, previous) => {
        if (actorKey(state) !== actorKey(previous)) invalidate();
        for (const chat of previous.aiChats) {
            if (!state.aiChats.some(current => current.id === chat.id)) {
                chatRevisions.set(chat.id, (chatRevisions.get(chat.id) || 0) + 1);
            }
        }
    });
    const capture = (chatId?: string) => ({
        generation,
        actor: actorKey(get()),
        revision: chatId ? chatRevisions.get(chatId) || 0 : 0,
    });
    type Owner = ReturnType<typeof capture>;
    const isCurrent = (owner: Owner, chatId?: string, allowDeleting = false) => {
        const state = get();
        const auth = state as AiChatSlice & { isAuthenticated?: boolean };
        return owner.generation === generation && owner.actor === actorKey(state) && auth.isAuthenticated !== false &&
            (!chatId || (owner.revision === (chatRevisions.get(chatId) || 0) &&
                state.aiChats.some(chat => chat.id === chatId) && (allowDeleting || !deletingChats.has(chatId))));
    };
    const assertCurrent = (owner: Owner, chatId?: string) => {
        if (!isCurrent(owner, chatId)) throw new DOMException('Chat persistence was interrupted', 'AbortError');
    };
    const enqueue = <T,>(chatId: string, owner: Owner, operation: () => Promise<T>): Promise<T> => {
        const previous = chatWrites.get(chatId) || Promise.resolve();
        const task = previous.catch(() => undefined).then(() => {
            assertCurrent(owner, chatId);
            return operation();
        });
        chatWrites.set(chatId, task);
        const release = () => { if (chatWrites.get(chatId) === task) chatWrites.delete(chatId); };
        void task.then(release, release);
        return task;
    };
    const payloadKey = (message: AiMessage) => JSON.stringify([
        message.role, message.content, message.sql, message.explanation, message.thought, message.error || false,
        message.attachments, message.modelInfo, message.recommendations, message.sources, message.usage,
        message.warnings, message.generationId, message.contractVersion,
    ]);
    const versioned = (chat: AiChat, version?: string, fromList = false): AiChat => version &&
        (!fromList || !chat.serverUpdatedAt || Date.parse(version) >= Date.parse(chat.serverUpdatedAt))
        ? { ...chat, serverUpdatedAt: version, updatedAt: Date.parse(version) }
        : chat;
    const deliveryError = (error: unknown): AiMessageDeliveryError => {
        const details = error as { message?: string; statusCode?: number; reason?: string } | null;
        return { message: details?.message || 'Failed to persist message', statusCode: details?.statusCode, reason: details?.reason };
    };
    const persistMessage = (chatId: string, input: AiMessage, syncTitle = false): Promise<AiMessage> => {
        const owner = capture(chatId);
        assertCurrent(owner, chatId);
        const chat = get().aiChats.find(current => current.id === chatId);
        const existing = findAiMessage(chat, input.clientId || input.id);
        if (!existing) return Promise.reject(new Error('Message is no longer in this chat'));
        const clientId = existing.clientId || existing.id;
        const key = messageKey(chatId, clientId);
        if (existing.id === 'welcome') return Promise.reject(new Error('Welcome messages are local only'));
        if (existing.delivery === 'failed' && !savedIds.has(key) &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing.id) === false) {
            return Promise.reject(new Error('Reload before retrying an unconfirmed legacy message save'));
        }
        const message = { ...existing, ...input, id: existing.id, clientId };
        const payload = payloadKey(message);
        const pending = pendingSaves.get(key);
        if (pending?.payload === payload) return pending.promise;
        if (existing.delivery === 'saved' || existing.delivery === undefined) {
            savedIds.set(key, existing.id);
            if (!savedPayloads.has(key)) savedPayloads.set(key, payloadKey(existing));
        }
        if (!pending && savedPayloads.get(key) === payload) return Promise.resolve(existing);
        set(state => ({ aiChats: state.aiChats.map(current => current.id === chatId ? {
            ...current,
            messages: current.messages.map(item => item === existing ? { ...message, delivery: 'pending', deliveryError: undefined } : item),
        } : current) }));
        const task: Promise<AiMessage> = enqueue(chatId, owner, async (): Promise<AiMessage> => {
            try {
                if (pending) await pending.promise;
                assertCurrent(owner, chatId);
                const currentChat = get().aiChats.find(current => current.id === chatId);
                const currentMessage = findAiMessage(currentChat, clientId);
                if (!currentMessage) throw new DOMException('Message was removed', 'AbortError');
                const canonicalId = savedIds.get(key);
                const options = { expectedUpdatedAt: currentChat?.serverUpdatedAt };
                const result: AiMessagePersistenceResult = canonicalId
                    ? await AiChatService.updateMessage(chatId, canonicalId, { ...message, id: canonicalId }, options)
                    : await AiChatService.saveMessage(chatId, message, options);
                assertCurrent(owner, chatId);
                savedIds.set(key, result.id);
                savedPayloads.set(key, payload);
                set(state => ({ aiChats: state.aiChats.map(current => current.id === chatId ? {
                    ...versioned(current, result.chatUpdatedAt),
                    messages: current.messages.map(item => (item.id === clientId || item.clientId === clientId) ? {
                        ...item, id: result.id, clientId,
                        delivery: pendingSaves.get(key)?.promise === task ? 'saved' : 'pending', deliveryError: undefined,
                    } : item),
                } : current) }));
                if (syncTitle) {
                    const latest = get().aiChats.find(current => current.id === chatId);
                    if (latest && latest.messages.filter(item => item.role === 'user').length === 1) {
                        try {
                            const response = await AiChatService.updateChat(chatId, { title: latest.title });
                            assertCurrent(owner, chatId);
                            set(state => ({ aiChats: state.aiChats.map(current => current.id === chatId
                                ? versioned(current, response.updatedAt) : current) }));
                        } catch (error) {
                            assertCurrent(owner, chatId);
                            console.error('Failed to sync chat title', error);
                        }
                    }
                }
                const saved = findAiMessage(get().aiChats.find(current => current.id === chatId), clientId);
                if (!saved) throw new DOMException('Message was removed', 'AbortError');
                return saved;
            } catch (error) {
                if (isCurrent(owner, chatId) && pendingSaves.get(key)?.promise === task) {
                    set(state => ({ aiChats: state.aiChats.map(current => current.id === chatId ? {
                        ...current,
                        messages: current.messages.map(item => item.clientId === clientId || item.id === clientId
                            ? { ...item, delivery: 'failed', deliveryError: deliveryError(error) } : item),
                    } : current) }));
                }
                throw error;
            }
        });
        pendingSaves.set(key, { payload, promise: task });
        const release = () => { if (pendingSaves.get(key)?.promise === task) pendingSaves.delete(key); };
        void task.then(release, release);
        return task;
    };

    return {
        aiChats: [],
        activeAiChatId: null,
        aiModel: 'groq:openai/gpt-oss-120b',
        aiMode: 'planning',
        aiRoutingMode: 'auto',
        isFetchingAiChats: false,
        fetchAiChats: async () => {
            const owner = capture();
            const revisions = new Map(chatRevisions);
            set({ isFetchingAiChats: true });
            try {
                const formatted = await AiChatService.fetchChats();
                if (!isCurrent(owner)) return;
                const chats = formatted.filter(chat => !deletingChats.has(chat.id) &&
                    (chatRevisions.get(chat.id) || 0) === (revisions.get(chat.id) || 0));
                set(state => ({
                    aiChats: chats.map(chat => {
                        const current = state.aiChats.find(item => item.id === chat.id);
                        return current ? { ...versioned(current, chat.serverUpdatedAt, true), title: chat.title } : chat;
                    }),
                    activeAiChatId: state.activeAiChatId || chats[0]?.id || null,
                }));
            } catch (error) {
                if (isCurrent(owner)) console.error('Failed to fetch AI chats:', error);
            } finally {
                if (isCurrent(owner)) set({ isFetchingAiChats: false });
            }
        },
        loadAiChatMessages: async (chatId) => {
            const owner = capture(chatId);
            await enqueue(chatId, owner, async () => {
                const snapshot = await AiChatService.loadMessages(chatId, true);
                assertCurrent(owner, chatId);
                const current = get().aiChats.find(chat => chat.id === chatId);
                const messages: AiMessage[] = snapshot.messages.map(message => {
                    const previous = current?.messages.find(item => item.id === message.id ||
                        savedIds.get(messageKey(chatId, item.clientId || item.id)) === message.id);
                    const loaded = { ...message, clientId: previous?.clientId || message.id, delivery: 'saved' as const };
                    const key = messageKey(chatId, loaded.clientId);
                    savedIds.set(key, loaded.id);
                    savedPayloads.set(key, payloadKey(loaded));
                    return loaded;
                });
                for (const local of current?.messages || []) {
                    if (local.id !== 'welcome' && local.delivery && local.delivery !== 'saved') {
                        const index = messages.findIndex(message => message.id === local.id || message.clientId === local.clientId);
                        if (index === -1) messages.push(local);
                        else messages[index] = local;
                    }
                }
                if (messages.length === 0) messages.push({
                    id: 'welcome', role: 'ai', delivery: 'local',
                    content: 'Xin chào! Tôi là AI Assistant — bạn có thể hỏi tôi bất cứ điều gì: SQL, coding, kiến thức chung, hay chỉ đơn giản là trò chuyện. Khi cần truy vấn database, tôi sẽ tự động sinh SQL dựa trên schema của bạn.',
                    timestamp: Date.now(),
                });
                set(state => ({ aiChats: state.aiChats.map(chat => chat.id === chatId
                    ? { ...versioned(chat, snapshot.serverUpdatedAt), messages } : chat) }));
            });
        },
        createAiChat: async () => {
            const owner = capture();
            try {
                const res = await AiChatService.createChat();
                assertCurrent(owner);
                const newChat: AiChat = {
                    id: res.id, title: res.title,
                    messages: [{
                        id: 'welcome', role: 'ai', delivery: 'local',
                        content: 'Xin chào! Tôi là AI Assistant — bạn có thể hỏi tôi bất cứ điều gì: SQL, coding, kiến thức chung, hay chỉ đơn giản là trò chuyện. Khi cần truy vấn database, tôi sẽ tự động sinh SQL dựa trên schema của bạn.',
                        timestamp: Date.now(),
                    }],
                    createdAt: Date.parse(res.createdAt), updatedAt: Date.parse(res.updatedAt), serverUpdatedAt: res.updatedAt,
                };
                set(state => ({ aiChats: [newChat, ...state.aiChats], activeAiChatId: res.id }));
                return res.id;
            } catch (error) {
                if (isCurrent(owner)) console.error('Failed to create chat', error);
                return null;
            }
        },
        deleteAiChat: async (id) => {
            chatRevisions.set(id, (chatRevisions.get(id) || 0) + 1);
            deletingChats.add(id);
            const owner = capture(id);
            try {
                await AiChatService.deleteChat(id);
                if (!isCurrent(owner, id, true)) return;
                set(state => {
                    const remaining = state.aiChats.filter(chat => chat.id !== id);
                    return { aiChats: remaining, activeAiChatId: state.activeAiChatId === id ? remaining[0]?.id || null : state.activeAiChatId };
                });
            } finally {
                deletingChats.delete(id);
            }
        },
        setActiveAiChat: (id) => set({ activeAiChatId: id }),
        addAiMessage: async (chatId, message) => {
            assertCurrent(capture(chatId), chatId);
            const existing = findAiMessage(get().aiChats.find(chat => chat.id === chatId), message.clientId || message.id);
            if (existing) return message.role === 'user' ? persistMessage(chatId, message) : existing;
            const local: AiMessage = { ...message, clientId: message.clientId || message.id, delivery: message.delivery || 'local' };
            set(state => ({ aiChats: state.aiChats.map(chat => chat.id === chatId ? {
                ...chat, messages: [...chat.messages, local], updatedAt: Date.now(),
                title: chat.messages.filter(item => item.role === 'user').length === 0 && message.role === 'user'
                    ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '') : chat.title,
            } : chat) }));
            return message.role === 'user' ? persistMessage(chatId, local, true) : local;
        },
        syncAiMessage: async (chatId, message) => {
            if (!message.content && !message.sql && !message.error) return;
            return persistMessage(chatId, message);
        },
        waitForAiMessagePersistence: async (chatId, messageId) => {
            const owner = capture(chatId);
            assertCurrent(owner, chatId);
            const message = findAiMessage(get().aiChats.find(chat => chat.id === chatId), messageId);
            if (!message) throw new Error('Message is no longer in this chat');
            const pending = pendingSaves.get(messageKey(chatId, message.clientId || message.id));
            if (pending) await pending.promise;
            assertCurrent(owner, chatId);
            const current = findAiMessage(get().aiChats.find(chat => chat.id === chatId), messageId);
            if (!current || (current.delivery && current.delivery !== 'saved')) {
                throw new Error(current?.deliveryError?.message || 'Message has not been saved');
            }
            return current;
        },
        updateAiMessage: (chatId, messageId, updates) => {
            if (!isCurrent(capture(chatId), chatId)) return;
            set(state => ({ aiChats: state.aiChats.map(chat => chat.id === chatId ? {
                ...chat,
                messages: chat.messages.map(message => {
                    if (message.id !== messageId && message.clientId !== messageId) return message;
                    const clientId = message.clientId || message.id;
                    const key = messageKey(chatId, clientId);
                    if (message.delivery === 'saved' || message.delivery === undefined) {
                        savedIds.set(key, message.id);
                        if (!savedPayloads.has(key)) savedPayloads.set(key, payloadKey(message));
                    }
                    return { ...message, ...updates, id: message.id, clientId };
                }),
                updatedAt: Date.now(),
            } : chat) }));
        },
        updateAiChatTitle: async (chatId, title) => {
            const owner = capture(chatId);
            await enqueue(chatId, owner, async () => {
                const response = await AiChatService.updateChat(chatId, { title });
                assertCurrent(owner, chatId);
                set(state => ({ aiChats: state.aiChats.map(chat => chat.id === chatId
                    ? { ...versioned(chat, response.updatedAt), title } : chat) }));
            });
        },
        clearAiChats: () => {
            invalidate();
            set({ aiChats: [], activeAiChatId: null, isFetchingAiChats: false });
        },
        setAiModel: (model) => set({ aiModel: model }),
        setAiMode: (mode) => set({ aiMode: mode }),
        setAiRoutingMode: (mode) => set({ aiRoutingMode: mode }),
        deleteAiMessage: async (chatId, messageId) => {
            const owner = capture(chatId);
            const message = await get().waitForAiMessagePersistence(chatId, messageId);
            await enqueue(chatId, owner, async () => {
                const response = await AiChatService.deleteMessage(chatId, message.id);
                assertCurrent(owner, chatId);
                set(state => ({ aiChats: state.aiChats.map(chat => chat.id === chatId ? {
                    ...versioned(chat, response.chatUpdatedAt),
                    messages: chat.messages.filter(item => item.id !== message.id),
                } : chat) }));
                const key = messageKey(chatId, message.clientId || message.id);
                savedIds.delete(key);
                savedPayloads.delete(key);
            });
        },
        editAiMessage: async (chatId, messageId, newContent) => {
            const owner = capture(chatId);
            await get().waitForAiMessagePersistence(chatId, messageId);
            await enqueue(chatId, owner, async () => {
                const chat = get().aiChats.find(current => current.id === chatId);
                const message = findAiMessage(chat, messageId);
                if (!message) throw new Error('Message is no longer in this chat');
                const result = await AiChatService.editMessageAndTruncate(chatId, message.id,
                    { ...message, content: newContent }, { expectedUpdatedAt: chat?.serverUpdatedAt });
                assertCurrent(owner, chatId);
                const clientId = message.clientId || message.id;
                set(state => ({ aiChats: state.aiChats.map(current => {
                    if (current.id !== chatId) return current;
                    const index = current.messages.findIndex(item => item.id === message.id || item.clientId === clientId);
                    if (index === -1) return current;
                    for (const removed of current.messages.slice(index + 1)) {
                        const key = messageKey(chatId, removed.clientId || removed.id);
                        savedIds.delete(key);
                        savedPayloads.delete(key);
                    }
                    const edited = { ...message, ...result.message, id: result.id, clientId, delivery: 'saved' as const, deliveryError: undefined };
                    const key = messageKey(chatId, clientId);
                    savedIds.set(key, edited.id);
                    savedPayloads.set(key, payloadKey(edited));
                    return { ...versioned(current, result.chatUpdatedAt), messages: [...current.messages.slice(0, index), edited] };
                }) }));
            });
        },
    };
};
