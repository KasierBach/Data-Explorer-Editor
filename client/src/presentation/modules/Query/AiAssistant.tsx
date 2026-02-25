import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    Sparkles, Send, Loader2, Copy, Play, ChevronDown, X, Plus,
    MessageSquare, Trash2, Clock, ChevronLeft, Image, FileCode2,
    Table2, Paperclip
} from 'lucide-react';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { cn } from '@/lib/utils';

interface Attachment {
    type: 'image' | 'sql' | 'table';
    label: string;
    data: string; // base64 for image, text for sql/table
    preview?: string; // thumbnail URL for images
}

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
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const {
        activeConnectionId, connections, activeDatabase, accessToken,
        aiChats, activeAiChatId, createAiChat, deleteAiChat,
        setActiveAiChat, addAiMessage, tabs, activeTabId,
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

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setShowContextMenu(false);
            }
        };
        if (showContextMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showContextMenu]);

    const handleNewChat = () => {
        createAiChat();
        setShowHistory(false);
        setAttachments([]);
    };

    const handleSelectChat = (chatId: string) => {
        setActiveAiChat(chatId);
        setShowHistory(false);
    };

    const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        deleteAiChat(chatId);
    };

    // --- Attachment handlers ---
    const handleAddImage = () => {
        setShowContextMenu(false);
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setAttachments(prev => [...prev, {
                type: 'image',
                label: file.name,
                data: base64,
                preview: base64,
            }]);
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
    };

    const handlePasteSql = () => {
        setShowContextMenu(false);
        // Get SQL from active query tab
        if (activeTab?.type === 'query' && activeTab.metadata?.sql) {
            const sql = activeTab.metadata.sql;
            if (sql.trim()) {
                setAttachments(prev => [...prev, {
                    type: 'sql',
                    label: `SQL từ "${activeTab.title}"`,
                    data: sql,
                }]);
            }
        }
    };

    const handleMentionTable = () => {
        setShowContextMenu(false);
        // Add active database info as context
        if (activeConnection && activeDatabase) {
            setAttachments(prev => [...prev, {
                type: 'table',
                label: `DB: ${activeDatabase}`,
                data: `Database đang kết nối: ${activeConnection.name}, Database: ${activeDatabase}, Type: ${activeConnection.type}`,
            }]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading || !activeAiChatId) return;
        if (!activeConnection) {
            addAiMessage(activeAiChatId, {
                id: `msg-${Date.now()}`,
                role: 'ai',
                content: '⚠️ Chưa kết nối database. Hãy kết nối trước khi sử dụng AI.',
                error: true,
                timestamp: Date.now(),
            });
            return;
        }

        // Build display content for user message
        const attachmentLabels = attachments.map(a => {
            if (a.type === 'image') return `📷 ${a.label}`;
            if (a.type === 'sql') return `📋 SQL đính kèm`;
            if (a.type === 'table') return `📊 ${a.label}`;
            return a.label;
        });
        const displayContent = [
            input.trim(),
            ...attachmentLabels
        ].filter(Boolean).join('\n');

        const userMsg: AiMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: displayContent,
            timestamp: Date.now(),
        };
        addAiMessage(activeAiChatId, userMsg);

        // Build context from attachments
        const contextParts: string[] = [];
        let imageData: string | undefined;

        for (const att of attachments) {
            if (att.type === 'image') {
                imageData = att.data;
            } else {
                contextParts.push(`[${att.type.toUpperCase()}] ${att.label}:\n${att.data}`);
            }
        }

        const contextStr = contextParts.length > 0 ? contextParts.join('\n\n') : undefined;

        setInput('');
        setAttachments([]);
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:3000/api/ai/generate-sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    connectionId: activeConnection.id,
                    database: activeDatabase || undefined,
                    prompt: input || '(xem hình/context đính kèm)',
                    image: imageData,
                    context: contextStr,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || response.statusText);
            }

            const result = await response.json();

            addAiMessage(activeAiChatId, {
                id: `msg-${Date.now()}-ai`,
                role: 'ai',
                content: result.message || result.explanation || 'Đã xử lý xong.',
                sql: result.sql || undefined,
                explanation: result.explanation,
                timestamp: Date.now(),
            });
        } catch (error: any) {
            addAiMessage(activeAiChatId, {
                id: `msg-${Date.now()}-err`,
                role: 'ai',
                content: `❌ Lỗi: ${error.message}`,
                error: true,
                timestamp: Date.now(),
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    // --- Chat History View ---
    if (showHistory) {
        return (
            <div className="flex flex-col h-full bg-card border-l border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-500/10 to-blue-500/10">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowHistory(false)}>
                            <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <span className="text-xs font-bold text-foreground">Lịch sử chat</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
                        <X className="w-3 h-3" />
                    </Button>
                </div>

                <div className="p-2 border-b">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
                        onClick={handleNewChat}
                    >
                        <Plus className="w-3 h-3" />
                        Cuộc trò chuyện mới
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {aiChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                            <span>Chưa có cuộc trò chuyện nào</span>
                        </div>
                    ) : (
                        <div className="p-1 space-y-0.5">
                            {aiChats.map(chat => (
                                <div
                                    key={chat.id}
                                    onClick={() => handleSelectChat(chat.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer group transition-colors",
                                        chat.id === activeAiChatId
                                            ? "bg-violet-500/15 text-foreground"
                                            : "hover:bg-muted/50 text-muted-foreground"
                                    )}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium truncate">{chat.title}</div>
                                        <div className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTime(chat.updatedAt)}
                                            <span className="ml-1">• {chat.messages.length - 1} tin nhắn</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                                        onClick={(e) => handleDeleteChat(e, chat.id)}
                                    >
                                        <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-violet-500/10" onClick={handleNewChat} title="Cuộc trò chuyện mới">
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
                    <MessageSquare className="w-3 h-3 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{activeChat.title}</span>
                    <span className="text-[9px] text-muted-foreground/40">{aiChats.length} chats</span>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed ${msg.role === 'user'
                            ? 'bg-violet-500/20 text-foreground ml-4'
                            : msg.error
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-muted/30 text-foreground/80 border border-border/30'
                            }`}>
                            <div className="whitespace-pre-wrap">{msg.content}</div>

                            {msg.sql && (
                                <div className="mt-2 rounded-md overflow-hidden border border-border/50 bg-background/50">
                                    <div className="flex items-center justify-between px-2 py-1 bg-muted/20 border-b border-border/30">
                                        <span className="text-[9px] text-muted-foreground font-mono">SQL</span>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-green-500/20" onClick={() => onInsertSql(msg.sql!)} title="Insert vào Editor">
                                                <ChevronDown className="w-3 h-3 text-green-400" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-blue-500/20" onClick={() => { onInsertSql(msg.sql!); onRunSql(msg.sql!); }} title="Chạy ngay">
                                                <Play className="w-3 h-3 text-blue-400" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted/50" onClick={() => navigator.clipboard.writeText(msg.sql!)} title="Copy SQL">
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <pre className="p-2 text-[11px] font-mono text-cyan-400 overflow-x-auto whitespace-pre-wrap">{msg.sql}</pre>
                                </div>
                            )}
                        </div>
                    </div>
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

            {/* Attachments preview */}
            {attachments.length > 0 && (
                <div className="px-2 pt-1.5 pb-0.5 border-t bg-muted/5 flex flex-wrap gap-1.5">
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

            {/* Input area */}
            <div className="p-2 border-t bg-muted/5">
                <div className="flex items-center gap-1.5">
                    {/* Context menu trigger */}
                    <div className="relative" ref={contextMenuRef}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10"
                            onClick={() => setShowContextMenu(!showContextMenu)}
                            title="Đính kèm context"
                        >
                            <Paperclip className="w-3.5 h-3.5" />
                        </Button>

                        {/* Context popup menu */}
                        {showContextMenu && (
                            <div className="absolute bottom-full left-0 mb-1 w-52 bg-popover border border-border rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <div className="px-2 py-1">
                                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Đính kèm context</span>
                                </div>

                                <button
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
                                    onClick={handleAddImage}
                                >
                                    <Image className="w-4 h-4 text-pink-400" />
                                    <div>
                                        <div className="font-medium">Hình ảnh</div>
                                        <div className="text-[9px] text-muted-foreground">Upload ảnh để AI phân tích</div>
                                    </div>
                                </button>

                                <button
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left",
                                        (!activeTab || activeTab.type !== 'query' || !activeTab.metadata?.sql) && "opacity-40 pointer-events-none"
                                    )}
                                    onClick={handlePasteSql}
                                >
                                    <FileCode2 className="w-4 h-4 text-cyan-400" />
                                    <div>
                                        <div className="font-medium">SQL từ Editor</div>
                                        <div className="text-[9px] text-muted-foreground">Đính kèm SQL đang mở</div>
                                    </div>
                                </button>

                                <button
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left",
                                        (!activeConnection || !activeDatabase) && "opacity-40 pointer-events-none"
                                    )}
                                    onClick={handleMentionTable}
                                >
                                    <Table2 className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <div className="font-medium">Database Context</div>
                                        <div className="text-[9px] text-muted-foreground">Thêm thông tin DB đang kết nối</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={activeConnection
                            ? "Hỏi bất cứ điều gì... (Enter để gửi)"
                            : "Kết nối database trước..."}
                        disabled={isLoading || !activeConnection}
                        className="text-xs h-8 bg-background/50 border-border/30 focus-visible:ring-violet-500/30"
                    />
                    <Button
                        size="icon"
                        className="h-8 w-8 bg-violet-500 hover:bg-violet-600 shrink-0"
                        onClick={handleSend}
                        disabled={isLoading || (!input.trim() && attachments.length === 0) || !activeConnection}
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    </Button>
                </div>
                <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[8px] text-muted-foreground/50">
                        Powered by Google Gemini • AI có thể sinh SQL không chính xác — hãy kiểm tra trước khi chạy
                    </span>
                </div>
            </div>
        </div>
    );
};
