import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    Sparkles, Send, Loader2, Copy, Play, ChevronDown, X, Plus,
    MessageSquare, Trash2, Clock, ChevronLeft, Image, FileCode2,
    Table2, Edit2, Check, ChevronUp, TriangleAlert
} from 'lucide-react';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
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
        { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Reasoning)', isNew: true },
        { id: 'gemini-3-pro', label: 'Gemini 3 Pro (High)', isNew: true },
        { id: 'gemini-3-flash', label: 'Gemini 3 Flash (Fast)', isNew: true },
        { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Balanced)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced)' },
        { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
        { id: 'gemma-3-27b', label: 'Gemma 3 27B (Local-like)', warning: true },
    ];

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const modeMenuRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    const {
        activeConnectionId, connections, activeDatabase, accessToken,
        aiChats, activeAiChatId, createAiChat, deleteAiChat,
        setActiveAiChat, addAiMessage, updateAiChatTitle, tabs, activeTabId,
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

    const handleStartRename = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
        e.stopPropagation();
        setEditingChatId(chatId);
        setEditingTitle(currentTitle);
    };

    const handleSaveRename = (e?: React.MouseEvent, chatId?: string) => {
        if (e) e.stopPropagation();
        const idToSave = chatId || editingChatId;
        if (idToSave && editingTitle.trim()) {
            updateAiChatTitle(idToSave, editingTitle.trim());
        }
        setEditingChatId(null);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent, chatId: string) => {
        if (e.key === 'Enter') {
            handleSaveRename(undefined, chatId);
        } else if (e.key === 'Escape') {
            setEditingChatId(null);
        }
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
                    model: aiModel,
                    mode: aiMode,
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
                                    <div className="flex-1 min-w-0 py-1">
                                        {editingChatId === chat.id ? (
                                            <Input
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                                                onBlur={() => handleSaveRename(undefined, chat.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="h-6 text-xs px-1 py-0 mb-0.5"
                                            />
                                        ) : (
                                            <div className="text-xs font-medium truncate pb-0.5">{chat.title}</div>
                                        )}
                                        <div className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTime(chat.updatedAt)}
                                            <span className="ml-1">• {chat.messages.length - 1} tin nhắn</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        {editingChatId === chat.id ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                                onClick={(e) => handleSaveRename(e, chat.id)}
                                            >
                                                <Check className="w-3 h-3" />
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 hover:text-blue-400 hover:bg-blue-500/10"
                                                onClick={(e) => handleStartRename(e, chat.id, chat.title)}
                                            >
                                                <Edit2 className="w-2.5 h-2.5" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 hover:text-red-400 hover:bg-red-500/10"
                                            onClick={(e) => handleDeleteChat(e, chat.id)}
                                        >
                                            <Trash2 className="w-2.5 h-2.5" />
                                        </Button>
                                    </div>
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
                        <div className={`max-w-[90%] rounded-lg p-2.5 text-xs leading-relaxed select-text cursor-text ${msg.role === 'user'
                            ? 'bg-violet-500/20 text-foreground ml-4'
                            : msg.error
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-muted/30 text-foreground/80 border border-border/30'
                            }`}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-td:border prose-th:border prose-table:border-collapse prose-table:w-full prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-a:text-violet-400 select-text">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                            a: ({ node, className, ...props }: any) => <a className={className || "text-violet-400 hover:underline"} {...props} target="_blank" rel="noopener noreferrer" />,
                                            code({ node, inline, className, children, ...props }: any) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                return !inline && match ? (
                                                    <SyntaxHighlighter
                                                        {...props}
                                                        style={vscDarkPlus as any}
                                                        language={match[1]}
                                                        PreTag="div"
                                                        className="rounded-md my-2"
                                                    >
                                                        {String(children).replace(/\n$/, '')}
                                                    </SyntaxHighlighter>
                                                ) : (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            )}

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
                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left" onClick={handleAddImage}>
                                            <Image className="w-4 h-4 text-pink-400" />
                                            <div>
                                                <div className="font-medium">Hình ảnh</div>
                                                <div className="text-[9px] text-muted-foreground">Upload ảnh để AI phân tích</div>
                                            </div>
                                        </button>
                                        <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!activeTab || activeTab.type !== 'query' || !activeTab.metadata?.sql) && "opacity-40 pointer-events-none")} onClick={handlePasteSql}>
                                            <FileCode2 className="w-4 h-4 text-cyan-400" />
                                            <div>
                                                <div className="font-medium">SQL từ Editor</div>
                                                <div className="text-[9px] text-muted-foreground">Đính kèm SQL đang mở</div>
                                            </div>
                                        </button>
                                        <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!activeConnection || !activeDatabase) && "opacity-40 pointer-events-none")} onClick={handleMentionTable}>
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
                    <span className="text-[9px] text-muted-foreground/50">
                        AI có thể trả lời KHÔNG CHÍNH XÁC — hãy kiểm tra lại trước khi chạy </span>
                </div>
            </div>
        </div>
    );
};
