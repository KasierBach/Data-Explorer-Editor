import { useState, useRef } from 'react';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';

export interface Attachment {
    type: 'image' | 'sql' | 'table';
    label: string;
    data: string;
    preview?: string;
}

export function useAiChat() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    // Refs for scrolling and inputs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const store = useAppStore();
    const {
        activeConnectionId, connections, activeDatabase,
        activeAiChatId, addAiMessage, tabs, activeTabId,
        aiModel, aiMode,
    } = store;

    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeTab = tabs.find(t => t.id === activeTabId);

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
        e.target.value = '';
    };

    const handlePasteSql = () => {
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
            const adapter = connectionService.getActiveAdapter();

            if (!adapter || !adapter.generateSql) {
                throw new Error("API Adapter does not support AI text generation.");
            }

            const response = await adapter.generateSql({
                database: activeDatabase || undefined,
                prompt: input || '(xem hình/context đính kèm)',
                image: imageData,
                context: contextStr,
                model: aiModel,
                mode: aiMode,
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

    return {
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
        handleKeyDown,
        formatTime
    };
}
