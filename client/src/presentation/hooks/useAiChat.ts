import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type AiMessage } from '@/core/services/store';
import type { TableMetadata } from '@/core/domain/entities';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { connectionService } from '@/core/services/ConnectionService';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { parseNodeId } from '@/core/utils/id-parser';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { findReplaySourceUserMessage } from './aiChatReplay';

export interface Attachment {
    id?: string;
    type: 'image' | 'sql' | 'table' | 'file';
    label: string;
    data: string;
    preview?: string;
    rawData?: string;
    mimeType?: 'application/pdf';
}

interface NoSqlSchemaField {
    name: string;
    types: Record<string, unknown>;
    probability?: number;
}

interface AiStreamDoneData {
    message?: string;
    sql?: string;
    explanation?: string;
    recommendations?: AiMessage['recommendations'];
    provider?: string;
    providerLabel?: string;
    model?: string;
    routingMode?: string;
}

type AiStreamEvent =
    | { type: 'chunk'; text?: string }
    | { type: 'done'; data?: AiStreamDoneData }
    | { type: 'error'; text?: string };

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
const MAX_PERSISTED_DRAFT_ATTACHMENT_CHARS = 20000;
const MAX_NATIVE_PDF_BYTES = 5 * 1024 * 1024;

function getFileExtension(name: string): string {
    const baseName = name.split('/').pop() || name;
    const parts = baseName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

function getFileEmoji(ext: string): string {
    if (['pdf'].includes(ext)) return '[PDF]';
    if (['csv', 'tsv'].includes(ext)) return '[DATA]';
    if (EXCEL_EXTENSIONS.has(ext)) return '[XLSX]';
    if (['json', 'xml', 'yaml', 'yml'].includes(ext)) return '[JSON]';
    if (['sql'].includes(ext)) return '[SQL]';
    if (['md', 'txt', 'log'].includes(ext)) return '[TXT]';
    if (['py'].includes(ext)) return '[PY]';
    if (['js', 'ts', 'tsx', 'jsx'].includes(ext)) return '[JS]';
    return '[FILE]';
}

function isNoSqlSchemaField(value: unknown): value is NoSqlSchemaField {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<NoSqlSchemaField>;
    return typeof candidate.name === 'string' && !!candidate.types && typeof candidate.types === 'object';
}

function formatNoSqlSchemaFields(stats: unknown, includeProbability = false) {
    if (!Array.isArray(stats)) return '';
    return stats
        .filter(isNoSqlSchemaField)
        .map((field) => {
            const typeNames = Object.keys(field.types).join('/');
            if (!includeProbability) return `${field.name} (${typeNames})`;
            const probability = typeof field.probability === 'number' ? ` (${field.probability}% occurrence)` : '';
            return `- ${field.name}: ${typeNames}${probability}`;
        })
        .join(includeProbability ? '\n' : ', ');
}

function parseAiStreamEvent(data: string): AiStreamEvent | null {
    try {
        const parsed = JSON.parse(data) as Partial<AiStreamEvent>;
        return typeof parsed.type === 'string' ? parsed as AiStreamEvent : null;
    } catch {
        return null;
    }
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
}

function isPersistedDraftAttachment(value: unknown): value is Attachment {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Attachment>;
    return (
        (candidate.type === 'sql' || candidate.type === 'table' || candidate.type === 'file')
        && typeof candidate.label === 'string'
        && typeof candidate.data === 'string'
        && (candidate.preview === undefined || typeof candidate.preview === 'string')
    );
}

function toPersistedDraftAttachments(attachments: Attachment[]): Attachment[] {
    return attachments
        .filter((attachment) => (
            attachment.type !== 'image'
            && attachment.data.length <= MAX_PERSISTED_DRAFT_ATTACHMENT_CHARS
        ))
        .map((attachment) => ({
            type: attachment.type,
            label: attachment.label,
            data: attachment.data,
            preview: attachment.preview,
        }));
}

function toTriggerAttachments(messageAttachments: AiMessage['attachments']): Attachment[] {
    return (messageAttachments || []).map((attachment) => ({
        type: attachment.type === 'image' || attachment.type === 'sql' || attachment.type === 'table' ? attachment.type : 'file',
        label: attachment.label,
        data: attachment.data || '',
        preview: attachment.preview,
    }));
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
            const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
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

// Extract only user-facing content from partial JSON streaming output.
function parsePartialAiResponse(raw: string): { message: string } {
    const result = { message: '' };
    raw = raw.replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '').trim();

    const msgMatch = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"?/s);
    if (msgMatch) {
        try {
            result.message = JSON.parse('"' + msgMatch[1] + '"');
        } catch {
            result.message = msgMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    } else if (raw.trim() && !raw.trim().startsWith('{')) {
        // Fallback for non-JSON or partial raw text
        result.message = raw;
    }

    return result;
}

export function useAiChat() {
    const store = useAppStore();
    const draftKey = `ai-chat-draft-${store.activeAiChatId || 'global'}`;
    const draftState = store.pageStates[draftKey];
    const draftInput = draftState && typeof draftState.input === 'string'
        ? draftState.input
        : '';
    const draftAttachments = useMemo(
        () => (Array.isArray(draftState?.attachments)
            ? draftState.attachments.filter(isPersistedDraftAttachment)
            : []),
        [draftState],
    );
    const [input, setInput] = useState(draftInput);
    const [isLoading, setIsLoading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>(draftAttachments);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const text = getWorkspaceText(store.lang);
    const {
        activeConnectionId, connections, activeDatabase,
        activeAiChatId, addAiMessage, updateAiMessage, tabs, activeTabId,
        aiModel, aiMode, aiRoutingMode,
    } = store;

    const setPageState = store.setPageState;
    const persistedDraftAttachments = useMemo(
        () => toPersistedDraftAttachments(attachments),
        [attachments],
    );
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeTab = tabs.find(t => t.id === activeTabId);
    const preferences = useAiPreferences();
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedAssistant = useMemo(
        () => resolveAiSelection(assistantSelection, aiModel, preferences.customProviders),
        [assistantSelection, aiModel, preferences.customProviders],
    );
    const queryClient = useQueryClient();

    const previousDraftKeyRef = useRef(draftKey);

    useEffect(() => {
        if (previousDraftKeyRef.current === draftKey) {
            return;
        }

        previousDraftKeyRef.current = draftKey;
        setInput(draftInput);
        setAttachments(draftAttachments);
    }, [draftAttachments, draftInput, draftKey]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPageState(draftKey, {
                input,
                attachments: persistedDraftAttachments,
            });
        }, 250);

        return () => clearTimeout(timer);
    }, [draftKey, input, persistedDraftAttachments, setPageState]);

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
            const truncated = text.length > 50000
                ? text.slice(0, 50000) + '\n\n[... locally extracted PDF text truncated at 50,000 chars]'
                : text;
            let rawData: string | undefined;
            if (file.size <= MAX_NATIVE_PDF_BYTES) {
                rawData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                }).catch(() => undefined);
            }
            setAttachments(prev => [...prev, {
                type: 'file',
                label: `PDF: ${file.name}`,
                data: `[PDF File: ${file.name}]\n[Locally extracted text fallback]\n\n${truncated}`,
                preview: `PDF - ${(file.size / 1024).toFixed(0)} KB`,
                rawData,
                mimeType: 'application/pdf',
            }]);
            return;
        }

        if (EXCEL_EXTENSIONS.has(ext)) {
            const buffer = await file.arrayBuffer();
            const text = await readExcelAsText(buffer, file.name);
            setAttachments(prev => [...prev, {
                type: 'file',
                label: `Excel: ${file.name}`,
                data: `[Excel File: ${file.name}]\n\n${text}`,
                preview: `Excel - ${(file.size / 1024).toFixed(0)} KB`,
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
                preview: `${ext.toUpperCase() || 'TEXT'} - ${(file.size / 1024).toFixed(0)} KB`,
            }]);
            return;
        }

        if (file.size < 512 * 1024) {
            try {
                const text = await file.text();
                setAttachments(prev => [...prev, {
                    type: 'file',
                    label: `File: ${file.name}`,
                    data: `[File: ${file.name}]\n\n${text}`,
                    preview: `${ext.toUpperCase()} - ${(file.size / 1024).toFixed(0)} KB`,
                }]);
            } catch {
                setAttachments(prev => [...prev, {
                    type: 'file',
                    label: `Unreadable: ${file.name}`,
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
                    label: text.aiChat.sqlFromTab(activeTab.title),
                    data: sql,
                }]);
            }
        }
    };

    const handleMentionTable = async () => {
        if (!activeConnection) return;

        const isNoSql = activeConnection.type === 'mongodb' || activeConnection.type === 'mongodb+srv';

        if (isNoSql) {
            if (!activeDatabase) return;

            if (store.nosqlActiveCollection) {
                const schemaStr = store.nosqlSchemaStats ?
                    `${text.aiChat.schemaPrefix(store.nosqlActiveCollection)}\n` +
                    formatNoSqlSchemaFields(store.nosqlSchemaStats, true)
                    : text.aiChat.collectionWithoutSchema(store.nosqlActiveCollection);

                setAttachments(prev => [...prev, {
                    type: 'table',
                    label: `Schema: ${store.nosqlActiveCollection}` ,
                    data: schemaStr,
                }]);
            }

            return;
        }

        const tableId = activeTab?.metadata?.tableId;

        if (tableId) {
            const { dbName, schema, table } = parseNodeId(tableId);
            const resolvedDatabase = dbName || activeDatabase || activeConnection.database || activeConnection.name;
            const resolvedTable = table || activeTab?.title || tableId;
            const cachedMetadata = queryClient.getQueryData(["metadata", activeConnectionId, tableId]) as TableMetadata | undefined;

            try {
                const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
                await adapter.connect(activeConnection);
                const metadata = cachedMetadata || await adapter.getMetadata(tableId);
                const visibleColumns = metadata.columns.slice(0, 40);
                const columnLines = visibleColumns.length > 0
                    ? visibleColumns.map((column) => {
                        const flags = [
                            column.isPrimaryKey ? 'PK' : '',
                            column.isForeignKey ? 'FK' : '',
                            column.isNullable ? '' : 'NOT NULL',
                        ].filter(Boolean).join(", ");
                        return `- ${column.name}: ${column.type}${flags ? ` [${flags}]` : ""}`;
                    }).join("\n")
                    : "- No columns found";
                const extraColumnsNote = metadata.columns.length > visibleColumns.length
                    ? `\n- ... ${metadata.columns.length - visibleColumns.length} more columns`
                    : "";
                const indexLines = metadata.indices?.length
                    ? metadata.indices.slice(0, 10).map((index) =>
                        `- ${index.name}: ${index.columns.join(", ")}${index.isPrimary ? " [PRIMARY]" : index.isUnique ? " [UNIQUE]" : ""}`
                    ).join("\n")
                    : "";
                const schemaContext = [
                    `[SQL SCHEMA] Database: ${resolvedDatabase}` ,
                    `Schema: ${schema}` ,
                    `Table: ${resolvedTable}` ,
                    metadata.comment ? `Comment: ${metadata.comment}` : "" ,
                    "Columns:",
                    `${columnLines}${extraColumnsNote}` ,
                    indexLines ? `Indexes:\n${indexLines}` : "" ,
                ].filter(Boolean).join("\n");

                setAttachments(prev => [...prev, {
                    type: 'table',
                    label: `Schema: ${schema}.${resolvedTable}` ,
                    data: schemaContext,
                }]);
                return;
            } catch {
                setAttachments(prev => [...prev, {
                    type: 'table',
                    label: `Table: ${schema}.${resolvedTable}` ,
                    data: `[SQL CONTEXT] Database: ${resolvedDatabase}\nSchema: ${schema}\nTable: ${resolvedTable}\nDetailed metadata could not be loaded for this table.`,
                }]);
                return;
            }
        }

        if (activeDatabase) {
            setAttachments(prev => [...prev, {
                type: 'table',
                label: `Database: ${activeDatabase}` ,
                data: text.aiChat.databaseContext(activeConnection.name, activeDatabase, activeConnection.type),
            }]);
        }
    };

    const lastUpdateRef = useRef<number>(0);
    const pendingUpdateRef = useRef<{ message: string } | null>(null);

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const processSseLine = useCallback((chatId: string, aiMessageId: string, raw: string, line: string) => {
        if (!line.startsWith('data: ')) return raw;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') return raw;

        try {
            const event = parseAiStreamEvent(data);
            if (!event) return raw;
            if (event.type === 'chunk' && event.text) {
                const nextRaw = raw + event.text;
                const parsed = parsePartialAiResponse(nextRaw);
                
                // Throttle updates to ~25fps (40ms) or slightly more for better performance
                const now = Date.now();
                if (now - lastUpdateRef.current > 40) { // 40ms = 25fps, very smooth but low CPU
                    updateAiMessage(chatId, aiMessageId, { 
                        content: parsed.message,
                    });
                    lastUpdateRef.current = now;
                    pendingUpdateRef.current = null;
                } else {
                    pendingUpdateRef.current = parsed;
                }
                
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
                        provider: event.data.providerLabel || event.data.provider,
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
                        provider: event.data.providerLabel || event.data.provider,
                        model: event.data.model,
                        routingMode: event.data.routingMode,
                    },
                    timestamp: Date.now()
                });
                return raw;
            }
            if (event.type === 'error') {
                const errorContent = text.aiChat.error(event.text || 'Unknown error');
                updateAiMessage(chatId, aiMessageId, {
                    content: errorContent,
                    error: true,
                });
                void store.syncAiMessage(chatId, {
                    id: aiMessageId,
                    role: 'ai',
                    content: errorContent,
                    error: true,
                    timestamp: Date.now(),
                });
            }
        } catch { /* skip malformed */ }
        return raw;
    }, [store, text, updateAiMessage]);

    const triggerGenerate = useCallback(async (chatId: string, prompt: string, customAttachments: Attachment[] = [], customImageData?: string) => {
        setIsLoading(true);
        const aiMsgId = `msg-${Date.now()}-ai`;
        addAiMessage(chatId, { id: aiMsgId, role: 'ai', content: '', timestamp: Date.now() });

        // Setup abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;
        let rawText = '';
        try {

            const adapter = connectionService.getActiveAdapter();
            if (!adapter?.generateSqlStream) throw new Error("API Adapter does not support AI streaming.");

            const contextParts: string[] = [];
            let imageData = customImageData;

            let document: { name: string; mimeType: 'application/pdf'; data: string } | undefined;
            for (const att of customAttachments) {
                if (att.type === 'image') {
                    if (!imageData) {
                        imageData = att.data;
                    } else {
                        contextParts.push(`[IMAGE] ${att.label}:` +
                            ' Additional image attached. Only the first image is sent to the vision lane in the current chat flow.');
                    }
                    continue;
                }
                if (!document && att.mimeType === 'application/pdf' && att.rawData) {
                    document = {
                        name: att.label.replace(/^PDF:\s*/, ''),
                        mimeType: att.mimeType,
                        data: att.rawData,
                    };
                }

                contextParts.push(`[${att.type.toUpperCase()}] ${att.label}:\n${att.data}`);
            }

            const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv';
            if (isNoSql && store.nosqlActiveCollection && !customAttachments.some(a => a.type === 'table')) {
                const schemaSummary = store.nosqlSchemaStats ? 
                     `[NOSQL SCHEMA] Collection: ${store.nosqlActiveCollection}\nFields: ` + 
                     formatNoSqlSchemaFields(store.nosqlSchemaStats)
                     : `[NOSQL CONTEXT] Collection: ${store.nosqlActiveCollection}`;
                contextParts.unshift(schemaSummary);
            }

            // Prepare chat history (filtered to only past messages)
            const chat = store.aiChats.find(c => c.id === chatId);
            const history = chat?.messages?.filter(m => m.id !== aiMsgId) || [];

            const response = await adapter.generateSqlStream({
                database: activeDatabase || undefined,
                prompt: prompt || text.aiChat.attachmentOnlyPrompt,
                image: imageData,
                context: contextParts.length > 0 ? contextParts.join('\n\n') : undefined,
                model: resolvedAssistant.model,
                document,
                mode: aiMode,
                routingMode: aiRoutingMode,
                providerOverride: resolvedAssistant.providerOverride,
                history: history.length > 0 ? history.map(m => ({ role: m.role, content: m.content })) : undefined,
            }, { signal: controller.signal });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || response.statusText);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No readable stream');

            const decoder = new TextDecoder();
            let buffer = '';
            rawText = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                // Check if aborted during read
                if (controller.signal.aborted) throw new Error('Aborted');

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    rawText = processSseLine(chatId, aiMsgId, rawText, line.trimEnd());
                }
            }

            buffer += decoder.decode();
            if (buffer) {
                const remainingLines = buffer.split(/\r?\n/);
                for (const line of remainingLines) {
                    rawText = processSseLine(chatId, aiMsgId, rawText, line.trimEnd());
                }
            }
            if (pendingUpdateRef.current) {
                updateAiMessage(chatId, aiMsgId, { 
                    content: pendingUpdateRef.current.message,
                });
            }
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            if ((error instanceof DOMException && error.name === 'AbortError') || errorMessage === 'Aborted') {
                const abortedContent = (rawText ? parsePartialAiResponse(rawText).message : '') + `\n\n[${text.aiChat.aborted}]`;
                updateAiMessage(chatId, aiMsgId, { content: abortedContent });
                void store.syncAiMessage(chatId, {
                    id: aiMsgId,
                    role: 'ai',
                    content: abortedContent,
                    timestamp: Date.now(),
                });
            } else {
                const failedContent = text.aiChat.error(errorMessage);
                updateAiMessage(chatId, aiMsgId, { content: failedContent, error: true });
                void store.syncAiMessage(chatId, {
                    id: aiMsgId,
                    role: 'ai',
                    content: failedContent,
                    error: true,
                    timestamp: Date.now(),
                });
            }
        } finally {
            setIsLoading(false);
            lastUpdateRef.current = 0;
            pendingUpdateRef.current = null;
            abortControllerRef.current = null;
        }
    }, [addAiMessage, updateAiMessage, processSseLine, activeDatabase, aiMode, aiRoutingMode, activeConnection?.type, resolvedAssistant.model, resolvedAssistant.providerOverride, store, text]);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const handleSend = useCallback(async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading || !activeAiChatId) return;

        if (!activeConnection) {
            addAiMessage(activeAiChatId, {
                id: `msg-${Date.now()}`,
                role: 'ai',
                content: text.aiChat.noDatabaseMessage,
                error: true,
                timestamp: Date.now(),
            });
            return;
        }

        const attachmentLabels = attachments.map(a => {
            if (a.type === 'image') return '';
            if (a.type === 'sql') return text.aiChat.attachedSql;
            if (a.type === 'table') return a.label;
            return a.label;
        });

        const displayContent = [input.trim(), ...attachmentLabels].filter(Boolean).join('\n');

        const userMsg: AiMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: displayContent,
            timestamp: Date.now(),
            attachments: attachments.map(a => ({ type: a.type, label: a.label, preview: a.preview, data: a.data }))
        };
        addAiMessage(activeAiChatId, userMsg);

        const currentInput = input.trim();
        const currentAttachments = [...attachments];
        
        setInput('');
        setAttachments([]);
        
        await triggerGenerate(activeAiChatId, currentInput, currentAttachments);
    }, [input, attachments, isLoading, activeAiChatId, activeConnection, addAiMessage, text, triggerGenerate]);

    const handleRegenerate = useCallback(async (chatId: string, aiMessageId?: string) => {
        const chat = store.aiChats.find(c => c.id === chatId);
        if (!chat || isLoading) return;

        const messages = chat.messages || [];
        const lastUserMsg = findReplaySourceUserMessage(messages, aiMessageId);
        if (!lastUserMsg) return;

        await store.editAiMessage(chatId, lastUserMsg.id, lastUserMsg.content);
        await triggerGenerate(chatId, lastUserMsg.content, toTriggerAttachments(lastUserMsg.attachments));
    }, [store, isLoading, triggerGenerate]);

    const handleEditSubmit = useCallback(async (chatId: string, messageId: string, newContent: string) => {
        if (isLoading) return;

        const chat = store.aiChats.find(c => c.id === chatId);
        const messageToReplay = chat?.messages.find(m => m.id === messageId);

        await store.editAiMessage(chatId, messageId, newContent);
        await triggerGenerate(chatId, newContent, toTriggerAttachments(messageToReplay?.attachments));
    }, [isLoading, store, triggerGenerate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const locale = store.lang === 'en' ? 'en-US' : 'vi-VN';
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    };

    return {
        input, setInput, isLoading, attachments, messagesEndRef, fileInputRef,
        handleFileSelected, handlePasteQuery, handleMentionTable, removeAttachment, handleSend, handleKeyDown, formatTime,
        handleRegenerate, handleEditSubmit, handleStop
    };
}

