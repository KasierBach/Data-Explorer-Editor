import React, { useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/lib/utils';
import {
    ChevronLeft, X, Plus, MessageSquare, Clock, Check, Edit2, Trash2
} from 'lucide-react';
import { useAppStore } from '@/core/services/store';

interface AiChatListProps {
    onClose: () => void;
    onHideHistory: () => void;
}

export const AiChatList: React.FC<AiChatListProps> = ({ onClose, onHideHistory }) => {
    const {
        aiChats, activeAiChatId, createAiChat, deleteAiChat,
        setActiveAiChat, updateAiChatTitle
    } = useAppStore();

    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    const handleNewChat = () => {
        createAiChat();
        onHideHistory();
    };

    const handleSelectChat = (chatId: string) => {
        setActiveAiChat(chatId);
        onHideHistory();
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

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-500/10 to-blue-500/10">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onHideHistory}>
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
};
