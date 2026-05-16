import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    Sparkles, Plus, MessageSquare, Clock, X, Loader2
} from 'lucide-react';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { useAppStore } from '@/core/services/store';
import { AiChatList } from './AiChatList';
import { AiMessageBubble } from './AiMessageBubble';
import { AiChatInput } from './AiChatInput';

interface AiAssistantProps {
    onInsertQuery: (sql: string) => void;
    onRunQuery: (sql: string) => void;
    onClose: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
    onInsertQuery,
    onRunQuery,
    onClose,
}) => {
    const {
        input,
        setInput,
        isLoading,
        attachments,
        messagesEndRef,
        fileInputRef,
        handleFileSelected,
        handlePasteQuery,
        handleMentionTable,
        removeAttachment,
        handleSend,
        handleKeyDown,
        handleRegenerate,
        handleEditSubmit,
        handleStop
    } = useAiChat();

    const [showHistory, setShowHistory] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [showRoutingMenu, setShowRoutingMenu] = useState(false);

    const {
        aiModel, setAiModel,
        aiMode, setAiMode,
        aiRoutingMode, setAiRoutingMode,
        activeConnectionId, connections, activeDatabase,
        aiChats, activeAiChatId, createAiChat, setActiveAiChat, tabs, activeTabId,
        fetchAiChats, loadAiChatMessages, isFetchingAiChats
    } = useAppStore();

    const MODES = useMemo(() => [
        { id: 'planning', label: 'Planning', description: 'Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work' },
        { id: 'fast', label: 'Fast', description: 'Agent will execute tasks directly. Use for simple tasks that can be completed faster' }
    ], []);

    const ROUTING_MODES = useMemo(() => [
        { id: 'auto', label: 'Auto', description: 'Balance cost and quality automatically. Simple prompts may use cheaper models first.' },
        { id: 'fast', label: 'Fast / Cheap', description: 'Prefer lower-cost providers whenever possible before falling back to Gemini.' },
        { id: 'best', label: 'Best Quality', description: 'Prioritize your selected Gemini model sooner for harder or more important tasks.' },
        { id: 'gemini-only', label: 'Gemini Only', description: 'Always use the selected Gemini model. Best for consistency, highest cost.' },
    ], []);

    const MODELS = useMemo(() => [
        {
            group: 'Google (Gemini)',
            items: [
                { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Reasoning)', isNew: true },
                { id: 'gemini-3-pro', label: 'Gemini 3 Pro (High)', isNew: true },
                { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)', isNew: true },
                { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Balanced)' },
                { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
                { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
            ],
        },
        {
            group: 'Groq (Fast & Free)',
            items: [
                { id: 'groq:llama-3.3-70b-versatile', label: 'Llama 3.3 70B', isNew: true },
                { id: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', isNew: true },
                { id: 'groq:mixtral-8x7b-32768', label: 'Mixtral 8x7B', isNew: true },
                { id: 'groq:gemma2-9b-it', label: 'Gemma 2 9B', isNew: true },
                { id: 'groq:llama-3.1-8b-instant', label: 'Llama 3.1 8B', isNew: true },
            ],
        },
        {
            group: 'OpenRouter (Free)',
            items: [
                { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', isNew: true },
                { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B', isNew: true },
                { id: 'minimax/minimax-m2.5:free', label: 'MiniMax 2.5', isNew: true },
                { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'NVIDIA Nemotron 120B', isNew: true },
                { id: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B', isNew: true },
                { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air', isNew: true },
                { id: 'openrouter/owl-alpha', label: 'Owl Alpha (Reasoner)', isNew: true },
            ],
        },
    ], []);

    const contextMenuRef = useRef<HTMLDivElement>(null);

    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeChat = aiChats.find(c => c.id === activeAiChatId);
    const messages = useMemo(() => activeChat?.messages || [], [activeChat?.messages]);
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv';

    // Fetch chat history from backend on open
    useEffect(() => {
        fetchAiChats();
    }, [fetchAiChats]);

    // Load messages and ensure at least one chat exists
    useEffect(() => {
        if (isFetchingAiChats) return;

        if (aiChats.length === 0) {
            const timer = setTimeout(() => {
                const currentStore = useAppStore.getState();
                if (currentStore.aiChats.length === 0 && !currentStore.isFetchingAiChats) {
                    createAiChat();
                }
            }, 500);
            return () => clearTimeout(timer);
        } else if (!activeAiChatId) {
            setActiveAiChat(aiChats[0].id);
        }
    }, [aiChats, aiChats.length, activeAiChatId, createAiChat, setActiveAiChat, isFetchingAiChats]);

    // Load messages lazily when a chat is selected
    useEffect(() => {
        if (activeAiChatId) {
            const chat = aiChats.find(c => c.id === activeAiChatId);
            if (chat && (!chat.messages || chat.messages.length === 0)) {
                loadAiChatMessages(activeAiChatId);
            }
        }
    }, [activeAiChatId, aiChats, loadAiChatMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, messagesEndRef]);

    // Stable handlers to prevent re-rendering all bubbles on every keystroke
    const handleMessageRegenerate = React.useCallback(() => {
        if (activeAiChatId) handleRegenerate(activeAiChatId);
    }, [activeAiChatId, handleRegenerate]);

    const handleMessageEdit = React.useCallback((messageId: string, content: string) => {
        if (activeAiChatId) handleEditSubmit(activeAiChatId, messageId, content);
    }, [activeAiChatId, handleEditSubmit]);

    // Close context menus on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (contextMenuRef.current && !contextMenuRef.current.contains(target)) setShowContextMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Chat History View ---
    if (showHistory) {
        return <AiChatList onClose={onClose} onHideHistory={() => setShowHistory(false)} />;
    }

    return (
        <div className="flex flex-col h-full bg-card border-l border-border min-w-[260px]">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-500/10 to-blue-500/10 gap-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-bold text-foreground">AI Assistant</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">
                        {ROUTING_MODES.find(m => m.id === aiRoutingMode)?.label || 'Auto'}
                    </span>
                </div>
                <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-violet-500/10" onClick={() => { createAiChat(); setShowHistory(false); }} title="Cuộc trò chuyện mới">
                        <Plus className="w-3.5 h-3.5 text-violet-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-muted/50" onClick={() => setShowHistory(true)} title="Lịch sử chat">
                        <Clock className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Active chat title bar */}
            {activeChat && aiChats.length > 1 && (
                <div className="px-3 py-1 border-b bg-muted/10 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-muted-foreground/70" />
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{activeChat.title}</span>
                    <span className="text-[9px] text-muted-foreground/40">{aiChats.length} chats</span>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {!activeConnection && messages.length <= 1 && (
                    <div className="flex flex-col items-center justify-center p-6 my-4 border border-red-500/10 bg-red-500/5 rounded-xl text-center space-y-2 animate-in fade-in zoom-in-95">
                        <span className="text-xs font-bold text-red-500/80 uppercase tracking-widest">
                            Chưa Kết Nối Database
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-relaxed px-4">
                            Bạn cần thiết lập Server & Database (hoặc NoSQL) ở sidebar để AI có thể tự động viết query chuẩn xác.
                        </span>
                    </div>
                )}
                {messages.map(msg => (
                    <AiMessageBubble
                        key={msg.id}
                        msg={msg}
                        onInsertQuery={onInsertQuery}
                        onRunQuery={onRunQuery}
                        onRegenerate={handleMessageRegenerate}
                        onEditSubmit={handleMessageEdit}
                    />
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30 flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                            <span className="text-[10px] text-muted-foreground">Đang nghĩ...</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Isolated Input Section */}
            <AiChatInput
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                attachments={attachments}
                removeAttachment={removeAttachment}
                handleSend={handleSend}
                handleStop={handleStop}
                handleKeyDown={handleKeyDown}
                handleFileSelected={handleFileSelected}
                handlePasteQuery={handlePasteQuery}
                handleMentionTable={handleMentionTable}
                fileInputRef={fileInputRef}
                aiModel={aiModel}
                setAiModel={setAiModel}
                aiMode={aiMode}
                setAiMode={setAiMode}
                aiRoutingMode={aiRoutingMode}
                setAiRoutingMode={setAiRoutingMode}
                MODELS={MODELS}
                MODES={MODES}
                ROUTING_MODES={ROUTING_MODES}
                showContextMenu={showContextMenu}
                setShowContextMenu={setShowContextMenu}
                showRoutingMenu={showRoutingMenu}
                setShowRoutingMenu={setShowRoutingMenu}
                showModeMenu={showModeMenu}
                setShowModeMenu={setShowModeMenu}
                showModelMenu={showModelMenu}
                setShowModelMenu={setShowModelMenu}
                contextMenuRef={contextMenuRef}
                isNoSql={isNoSql}
                activeTab={activeTab}
                activeConnection={activeConnection}
                activeDatabase={activeDatabase}
            />

            <div className="flex items-center justify-center mb-2 px-1">
                <span className="text-[9px] text-muted-foreground/70">
                    AI có thể trả lời KHÔNG CHÍNH XÁC — hãy kiểm tra lại trước khi chạy </span>
            </div>
        </div>
    );
};
