import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    Sparkles, Send, Loader2, X, Plus,
    MessageSquare, Image, FileCode2, Clock,
    Table2, ChevronUp, TriangleAlert
} from 'lucide-react';
import { useAiChat } from '@/presentation/hooks/useAiChat';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { AiChatList } from './AiChatList';
import { AiMessageBubble } from './AiMessageBubble';

interface AiAssistantProps {
    onInsertSql: (sql: string) => void;
    onRunSql: (sql: string) => void;
    onClose: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
    onInsertSql,
    onRunSql,
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
        handlePasteSql,
        handleMentionTable,
        removeAttachment,
        handleSend,
        handleKeyDown
    } = useAiChat();

    const [showHistory, setShowHistory] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [showModeMenu, setShowModeMenu] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);

    const {
        aiModel, setAiModel,
        aiMode, setAiMode
    } = useAppStore();

    const MODES = [
        { id: 'planning', label: 'Planning', description: 'Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work' },
        { id: 'fast', label: 'Fast', description: 'Agent will execute tasks directly. Use for simple tasks that can be completed faster' }
    ];

    const MODELS: Array<{ id: string; label: string; isNew?: boolean; warning?: boolean }> = [
        { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Reasoning)', isNew: true },
        { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (High)', isNew: true },
        { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)', isNew: true },
        { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Balanced)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
        { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
        { id: 'gemma-3-27b', label: 'Gemma 3 27B (Local-like)', warning: true },
    ];

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    const {
        activeConnectionId, connections, activeDatabase,
        aiChats, activeAiChatId, createAiChat, setActiveAiChat, tabs, activeTabId,
    } = useAppStore();

    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeChat = aiChats.find(c => c.id === activeAiChatId);
    const messages = activeChat?.messages || [];
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Auto-create first chat if none exists
    useEffect(() => {
        if (aiChats.length === 0) {
            createAiChat();
        } else if (!activeAiChatId) {
            setActiveAiChat(aiChats[0].id);
        }
    }, [aiChats.length, activeAiChatId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!showHistory) inputRef.current?.focus();
    }, [showHistory, activeAiChatId]);

    // Close context menus on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (contextMenuRef.current && !contextMenuRef.current.contains(target)) setShowContextMenu(false);
            if (modeMenuRef.current && !modeMenuRef.current.contains(target)) setShowModeMenu(false);
            if (modelMenuRef.current && !modelMenuRef.current.contains(target)) setShowModelMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- Chat History View ---
    if (showHistory) {
        return <AiChatList onClose={onClose} onHideHistory={() => setShowHistory(false)} />;
    }

    // --- Main Chat View ---
    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            {/* Hidden file input for image upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelected}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-500/10 to-blue-500/10">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-bold text-foreground">AI Assistant</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">Gemini</span>
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
                {messages.map(msg => (
                    <AiMessageBubble
                        key={msg.id}
                        msg={msg}
                        onInsertSql={onInsertSql}
                        onRunSql={onRunSql}
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

            {/* Input area */}
            <div className="p-3 border-t bg-background">
                <div className="bg-muted/30 border border-border/50 rounded-xl focus-within:ring-1 focus-within:ring-violet-500/30 focus-within:border-violet-500/50 transition-all flex flex-col">

                    {/* Attachments preview inside the box */}
                    {attachments.length > 0 && (
                        <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
                            {attachments.map((att, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium group",
                                        att.type === 'image' && "bg-pink-500/10 text-pink-400 border border-pink-500/20",
                                        att.type === 'sql' && "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
                                        att.type === 'table' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                    )}
                                >
                                    {att.type === 'image' && (
                                        <>
                                            {att.preview && <img src={att.preview} className="w-5 h-5 rounded object-cover" alt="" />}
                                            <Image className="w-3 h-3" />
                                        </>
                                    )}
                                    {att.type === 'sql' && <FileCode2 className="w-3 h-3" />}
                                    {att.type === 'table' && <Table2 className="w-3 h-3" />}
                                    <span className="max-w-[120px] truncate">{att.label}</span>
                                    <button
                                        onClick={() => removeAttachment(i)}
                                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={inputRef as any}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={activeConnection ? "Hỏi bất cứ điều gì..." : "Kết nối database trước..."}
                        disabled={isLoading || !activeConnection}
                        className="w-full bg-transparent border-none text-xs p-3 resize-none focus:outline-none min-h-[60px] max-h-[200px]"
                        rows={1}
                        style={{ fieldSizing: "content" } as any}
                    />

                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-2 pt-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Paperclip */}
                            <div className="relative" ref={contextMenuRef}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground shrink-0"
                                    onClick={() => setShowContextMenu(!showContextMenu)}
                                    title="Đính kèm context"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                                {/* Context popup menu */}
                                {showContextMenu && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-0 w-52 bg-popover border border-border rounded-lg shadow-xl py-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150">
                                        <div className="px-2 py-1">
                                            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Đính kèm context</span>
                                        </div>
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left" onClick={() => { setShowContextMenu(false); fileInputRef.current?.click(); }}>
                                            <Image className="w-4 h-4 text-pink-400" />
                                            <div>
                                                <div className="font-medium">Hình ảnh</div>
                                                <div className="text-[9px] text-muted-foreground">Upload ảnh để AI phân tích</div>
                                            </div>
                                        </button>
                                        <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!activeTab || activeTab.type !== 'query' || !activeTab.metadata?.sql) && "opacity-40 pointer-events-none")} onClick={() => { setShowContextMenu(false); handlePasteSql(); }}>
                                            <FileCode2 className="w-4 h-4 text-cyan-400" />
                                            <div>
                                                <div className="font-medium">SQL từ Editor</div>
                                                <div className="text-[9px] text-muted-foreground">Đính kèm SQL đang mở</div>
                                            </div>
                                        </button>
                                        <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!activeConnection || !activeDatabase) && "opacity-40 pointer-events-none")} onClick={() => { setShowContextMenu(false); handleMentionTable(); }}>
                                            <Table2 className="w-4 h-4 text-emerald-400" />
                                            <div>
                                                <div className="font-medium">Database Context</div>
                                                <div className="text-[9px] text-muted-foreground">Thêm thông tin DB đang kết nối</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mode Selector */}
                            <div className="relative" ref={modeMenuRef}>
                                <button
                                    onClick={() => {
                                        setShowModeMenu(!showModeMenu);
                                        setShowModelMenu(false);
                                        setShowContextMenu(false);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                >
                                    <ChevronUp className="w-3 h-3 opacity-50" />
                                    {MODES.find(m => m.id === aiMode)?.label}
                                </button>
                                {showModeMenu && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-[-1rem] w-[17rem] max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1c1c1c] border border-border/10 rounded-xl shadow-2xl p-1.5 z-[99999] text-foreground animate-in fade-in slide-in-from-bottom-2 duration-150">
                                        <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground mb-1">Conversation mode</div>
                                        <div className="flex flex-col gap-0.5">
                                            {MODES.map(m => (
                                                <button
                                                    key={m.id}
                                                    className={cn("w-full flex flex-col items-start px-2.5 py-2 hover:bg-white/5 rounded-lg transition-colors text-left", aiMode === m.id && "bg-white/5")}
                                                    onClick={() => { setAiMode(m.id); setShowModeMenu(false); }}
                                                >
                                                    <span className="text-xs font-semibold mb-0.5">{m.label}</span>
                                                    <span className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Model Selector */}
                            <div className="relative" ref={modelMenuRef}>
                                <button
                                    onClick={() => {
                                        setShowModelMenu(!showModelMenu);
                                        setShowModeMenu(false);
                                        setShowContextMenu(false);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                >
                                    <ChevronUp className="w-3 h-3 opacity-50" />
                                    {MODELS.find(m => m.id === aiModel)?.label}
                                </button>
                                {showModelMenu && (
                                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1c1c1c] border border-border/10 rounded-xl shadow-2xl p-1.5 z-[99999] text-foreground animate-in fade-in slide-in-from-bottom-2 duration-150">
                                        <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground mb-1">Model</div>
                                        <div className="flex flex-col gap-0.5">
                                            {MODELS.map(m => (
                                                <button
                                                    key={m.id}
                                                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs hover:bg-white/5 rounded-lg transition-colors text-left"
                                                    onClick={() => { setAiModel(m.id); setShowModelMenu(false); }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={aiModel === m.id ? "font-semibold" : "font-medium"}>{m.label}</span>
                                                        {m.warning && <TriangleAlert className="w-3.5 h-3.5 text-yellow-500" />}
                                                    </div>
                                                    {m.isNew && <span className="bg-white/10 text-muted-foreground font-semibold text-[9px] px-2 py-0.5 rounded-full">New</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <Button
                                size="icon"
                                className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 shrink-0 text-white"
                                onClick={handleSend}
                                disabled={isLoading || (!input.trim() && attachments.length === 0) || !activeConnection}
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 ml-0.5" />}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center mt-2 px-1">
                    <span className="text-[9px] text-muted-foreground/70">
                        AI có thể trả lời KHÔNG CHÍNH XÁC — hãy kiểm tra lại trước khi chạy </span>
                </div>
            </div>
        </div>
    );
};
