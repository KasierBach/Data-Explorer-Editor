import { useState, useRef, useCallback } from 'react';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface Attachment {
    type: 'image' | 'sql' | 'table' | 'file';
    label: string;
    data: string;
    preview?: string;
}

// File extensions we accept as text/code
const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log',
    'js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'cs', 'cpp', 'c', 'h', 'hpp',
    'php', 'swift', 'dart', 'lua', 'r', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
    'env', 'gitignore', 'dockerignore', 'editorconfig', 'prettierrc', 'eslintrc',
    'makefile', 'dockerfile',
]);

const EXCEL_EXTENSIONS = new Set(['xlsx', 'xls', 'ods']);

function getFileExtension(name: string): string {
    const baseName = name.split('/').pop() || name;
    const parts = baseName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function getFileEmoji(ext: string): string {
    if (['pdf'].includes(ext)) return '📄';
    if (['csv', 'tsv'].includes(ext)) return '📊';
    if (EXCEL_EXTENSIONS.has(ext)) return '📗';
    if (['json', 'xml', 'yaml', 'yml'].includes(ext)) return '📋';
    if (['sql'].includes(ext)) return '🗄️';
    if (['md', 'txt', 'log'].includes(ext)) return '📝';
    if (['py'].includes(ext)) return '🐍';
    if (['js', 'ts', 'tsx', 'jsx'].includes(ext)) return '⚡';
    return '📎';
}

async function readPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ');
            pages.push(`--- Page ${i} ---\n${text}`);
        }
        return pages.join('\n\n');
    } catch (err) {
        return `[PDF parsing failed: ${(err as Error).message}]`;
    }
}

async function readExcelAsText(arrayBuffer: ArrayBuffer, fileName: string): Promise<string> {
    try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheets: string[] = [];
        for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(ws);
            sheets.push(`### Sheet: ${sheetName}\n${csv}`);
        }
        return sheets.join('\n\n');
    } catch (err) {
        return `[Excel parsing failed for ${fileName}: ${(err as Error).message}]`;
    }
}

// Extract the "message" field content from partial JSON streaming output
function extractMessageFromPartialJson(raw: string): string {
    const msgMatch = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"?/s);
    if (msgMatch) {
        try {
            return JSON.parse('"' + msgMatch[1] + '"');
        } catch {
            return msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    }
    return raw.replace(/^\s*\{\s*"message"\s*:\s*"?/, '').replace(/"?\s*\}\s*$/, '');
}

export function useAiChat() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const store = useAppStore();
    const {
        activeConnectionId, connections, activeDatabase,
        activeAiChatId, addAiMessage, updateAiMessage, tabs, activeTabId,
        aiModel, aiMode, aiRoutingMode,
    } = store;

    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeTab = tabs.find(t => t.id === activeTabId);

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const ext = getFileExtension(file.name);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                setAttachments(prev => [...prev, {
                    type: 'image',
                    label: file.name,
                    data: reader.result as string,
                    preview: reader.result as string,
                }]);
            };
            reader.readAsDataURL(file);
            return;
        }

        if (ext === 'pdf' || file.type === 'application/pdf') {
            const buffer = await file.arrayBuffer();
            const text = await readPdfText(buffer);
            setAttachments(prev => [...prev, {
                type: 'file',
                label: `📄 ${file.name}`,
                data: `[PDF File: ${file.name}]\n\n${text}`,
                preview: `PDF • ${(file.size / 1024).toFixed(0)} KB`,
            }]);
            return;
        }

        if (EXCEL_EXTENSIONS.has(ext)) {
            const buffer = await file.arrayBuffer();
            const text = await readExcelAsText(buffer, file.name);
            setAttachments(prev => [...prev, {
                type: 'file',
                label: `📗 ${file.name}`,
                data: `[Excel File: ${file.name}]\n\n${text}`,
                preview: `Excel • ${(file.size / 1024).toFixed(0)} KB`,
            }]);
            return;
        }

        if (TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/') || (ext === '' && file.size < 1024 * 1024)) {
            const text = await file.text();
            const truncated = text.length > 50000 ? text.slice(0, 50000) + '\n\n[... truncated at 50,000 chars]' : text;
            const emoji = getFileEmoji(ext);
            setAttachments(prev => [...prev, {
                type: 'file',
                label: `${emoji} ${file.name}`,
                data: `[File: ${file.name} (${ext || 'text'})]\n\n${truncated}`,
                preview: `${ext.toUpperCase() || 'TEXT'} • ${(file.size / 1024).toFixed(0)} KB`,
            }]);
            return;
        }

        if (file.size < 512 * 1024) {
            try {
                const text = await file.text();
                setAttachments(prev => [...prev, {
                    type: 'file',
                    label: `📎 ${file.name}`,
                    data: `[File: ${file.name}]\n\n${text}`,
                    preview: `${ext.toUpperCase()} • ${(file.size / 1024).toFixed(0)} KB`,
                }]);
            } catch {
                setAttachments(prev => [...prev, {
                    type: 'file',
                    label: `❌ ${file.name}`,
                    data: `[Cannot read file: ${file.name}. Unsupported binary format.]`,
                    preview: 'Unsupported',
                }]);
            }
        }
    };

    const handlePasteQuery = () => {
        if (activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv') {
            const mql = store.nosqlMqlQuery;
            if (mql && mql.trim()) {
                setAttachments(prev => [...prev, {
                    type: 'sql',
                    label: `MQL Query`,
                    data: mql,
                }]);
            }
        } else if (activeTab?.type === 'query' && activeTab.metadata?.sql) {
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
            const isNoSql = activeConnection.type === 'mongodb' || activeConnection.type === 'mongodb+srv';
            
            if (isNoSql && store.nosqlActiveCollection) {
                const schemaStr = store.nosqlSchemaStats ? 
                    `Schema cho collection "${store.nosqlActiveCollection}":\n` + 
                    store.nosqlSchemaStats.map((s: any) => `- ${s.name}: ${Object.keys(s.types).join('/')} (${s.probability}% xuất hiện)`).join('\n')
                    : `Collection đang mở: ${store.nosqlActiveCollection} (Chưa chạy phân tích Schema)`;

                setAttachments(prev => [...prev, {
                    type: 'table',
                    label: `Schema: ${store.nosqlActiveCollection}`,
                    data: schemaStr,
                }]);
            } else {
                setAttachments(prev => [...prev, {
                    type: 'table',
                    label: `DB: ${activeDatabase}`,
                    data: `Database đang kết nối: ${activeConnection.name}, Database: ${activeDatabase}, Type: ${activeConnection.type}`,
                }]);
            }
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const processSseLine = useCallback((chatId: string, aiMessageId: string, raw: string, line: string) => {
        if (!line.startsWith('data: ')) return raw;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') return raw;

        try {
            const event = JSON.parse(data);
            if (event.type === 'chunk' && event.text) {
                const nextRaw = raw + event.text;
                const displayText = extractMessageFromPartialJson(nextRaw);
                updateAiMessage(chatId, aiMessageId, { content: displayText });
                return nextRaw;
            }
            if (event.type === 'done' && event.data) {
                const finalMsgContent = event.data.message || raw;
                updateAiMessage(chatId, aiMessageId, {
                    content: finalMsgContent,
                    sql: event.data.sql || undefined,
                    explanation: event.data.explanation || undefined,
                    recommendations: event.data.recommendations || undefined,
                    modelInfo: {
                        provider: event.data.provider,
                        model: event.data.model,
                        routingMode: event.data.routingMode,
                    },
                });
                store.syncAiMessage(chatId, {
                    id: aiMessageId,
                    role: 'ai',
                    content: finalMsgContent,
                    sql: event.data.sql,
                    explanation: event.data.explanation,
                    recommendations: event.data.recommendations,
                    modelInfo: {
                        provider: event.data.provider,
                        model: event.data.model,
                        routingMode: event.data.routingMode,
                    },
                    timestamp: Date.now()
                } as any);
                return raw;
            }
            if (event.type === 'error') {
                updateAiMessage(chatId, aiMessageId, {
                    content: `❌ ${event.text}`,
                    error: true,
                });
            }
        } catch { /* skip malformed */ }
        return raw;
    }, [store, updateAiMessage]);

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

        const attachmentLabels = attachments.map(a => {
            if (a.type === 'image') return '';
            if (a.type === 'sql') return `📋 SQL đính kèm`;
            if (a.type === 'table') return `📊 ${a.label}`;
            return a.label;
        });

        const displayContent = [input.trim(), ...attachmentLabels].filter(Boolean).join('\n');

        const userMsg: AiMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: displayContent,
            timestamp: Date.now(),
            attachments: attachments.map(a => ({ type: a.type, label: a.label, preview: a.preview }))
        };
        addAiMessage(activeAiChatId, userMsg);

        const contextParts: string[] = [];
        let imageData: string | undefined;

        for (const att of attachments) {
            if (att.type === 'image') imageData = att.data;
            else contextParts.push(`[${att.type.toUpperCase()}] ${att.label}:\n${att.data}`);
        }

        setInput('');
        setAttachments([]);
        setIsLoading(true);

        const aiMsgId = `msg-${Date.now()}-ai`;
        addAiMessage(activeAiChatId, { id: aiMsgId, role: 'ai', content: '', timestamp: Date.now() });

        try {
            const adapter = connectionService.getActiveAdapter();
            if (!adapter || !(adapter as any).generateSqlStream) throw new Error("API Adapter does not support AI streaming.");

            const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv';
            if (isNoSql && store.nosqlActiveCollection && !attachments.some(a => a.type === 'table')) {
                const schemaSummary = store.nosqlSchemaStats ? 
                     `[NOSQL SCHEMA] Collection: ${store.nosqlActiveCollection}\nFields: ` + 
                     store.nosqlSchemaStats.map((s: any) => `${s.name} (${Object.keys(s.types).join('/')})`).join(', ')
                     : `[NOSQL CONTEXT] Collection: ${store.nosqlActiveCollection}`;
                contextParts.unshift(schemaSummary);
            }

            const response = await (adapter as any).generateSqlStream({
                database: activeDatabase || undefined,
                prompt: input || '(xem hình/context đính kèm)',
                image: imageData,
                context: contextParts.length > 0 ? contextParts.join('\n\n') : undefined,
                model: aiModel,
                mode: aiMode,
                routingMode: aiRoutingMode,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || response.statusText);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No readable stream');

            const decoder = new TextDecoder();
            let buffer = '';
            let rawText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    rawText = processSseLine(activeAiChatId, aiMsgId, rawText, line.trimEnd());
                }
            }

            buffer += decoder.decode();
            if (buffer) {
                const remainingLines = buffer.split(/\r?\n/);
                for (const line of remainingLines) {
                    rawText = processSseLine(activeAiChatId, aiMsgId, rawText, line.trimEnd());
                }
            }
        } catch (error: any) {
            updateAiMessage(activeAiChatId, aiMsgId, { content: `❌ Lỗi: ${error.message}`, error: true });
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
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    return {
        input, setInput, isLoading, attachments, messagesEndRef, fileInputRef,
        handleFileSelected, handlePasteQuery, handleMentionTable, removeAttachment, handleSend, handleKeyDown, formatTime
    };
}
