import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { findAiMessage } from '@/core/services/store/slices/aiChatSlice';
import type { TableMetadata } from '@/core/domain/entities';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { assertAiEnabled, isAiEnabled } from '@/core/services/aiAccountPolicy';
import { connectionService } from '@/core/services/ConnectionService';
import { aiService } from '@/core/services/AiService';
import { normalizeAiMessageProvenance } from '@/core/services/AiChatService';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { parseNodeId } from '@/core/utils/id-parser';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import {
    AI_ATTACHMENT_BOUNDS,
    AI_BINARY_REATTACH_WARNING,
    assertAiAttachmentBounds,
    assertAiAttachmentPreflight,
    assertAiBinaryDataUrl,
    assertAiFileSignature,
    assertAiTextFileContent,
    boundAiExtractedText,
    warnAiBinaryOmitted,
} from '@/core/services/aiAttachmentBounds';
import {
    findReplaySourceUserMessage,
    hasAiResponseContent,
    toRequestHistory,
} from './aiChatReplay';
import {
    describeAiProviderError,
    type AiModelRuntimeStatus,
} from '@/presentation/modules/Query/aiProviderStatus';
import {
    getAssistantModelCatalog,
    getAssistantModelProvider,
} from '@/presentation/modules/Query/assistantModelCatalog';

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
    sources?: AiMessage['sources'];
    usage?: AiMessage['usage'];
    warnings?: AiMessage['warnings'];
    generationId?: AiMessage['generationId'];
    contractVersion?: AiMessage['contractVersion'];
    provider?: string;
    providerLabel?: string;
    model?: string;
    routingMode?: string;
}

type AiStreamEvent =
    | { type: 'chunk'; text?: string }
    | { type: 'done'; data?: AiStreamDoneData }
    | { type: 'error'; text?: string };

interface AiChatRequestOwner {
    generation: number;
    chatId: string;
    connectionId: string | null;
    database: string | null;
    actorKey: string | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    controller: AbortController;
    aiMessageId: string | null;
    aiMessageClientId: string | null;
    persistence: Promise<void> | null;
    terminal: boolean;
    rawText: string;
    lastUpdate: number;
    pendingUpdate: { message: string } | null;
    timer: ReturnType<typeof setTimeout> | null;
    reader: ReadableStreamDefaultReader<Uint8Array> | null;
}

// Settle UI work even when an adapter or stream does not honour its signal.
function waitForAiChatRequest<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        pending.then((value) => {
            signal.removeEventListener('abort', onAbort);
            if (signal.aborted) onAbort();
            else resolve(value);
        }, (error: unknown) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
        });
        if (signal.aborted) onAbort();
    });
}

function disposeAiChatRequest(owner: AiChatRequestOwner) {
    owner.controller.abort();
    if (owner.timer !== null) clearTimeout(owner.timer);
    owner.timer = null;
    owner.pendingUpdate = null;
    const reader = owner.reader;
    owner.reader = null;
    if (reader) {
        // Cancellation can itself remain pending; never hold UI ownership on it.
        try { void reader.cancel().catch(() => undefined); } catch { /* already closed */ }
        try { reader.releaseLock(); } catch { /* already released */ }
    }
}

const EXCEL_EXTENSIONS = new Set(['xlsx', 'xls', 'ods']);
const MAX_PERSISTED_DRAFT_ATTACHMENT_CHARS = 20000;

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
        .slice(0, AI_ATTACHMENT_BOUNDS.maxAttachments)
        .map((attachment) => {
            const persisted = {
                type: attachment.type,
                label: attachment.label,
                data: attachment.data,
                preview: attachment.preview,
            };
            return attachment.rawData || attachment.mimeType === 'application/pdf'
                ? warnAiBinaryOmitted(persisted)
                : persisted;
        });
}

function toTriggerAttachments(messageAttachments: AiMessage['attachments']): Attachment[] {
    return (messageAttachments || []).map((attachment) => {
        if (attachment.type === 'image') {
            return {
                type: 'file',
                label: attachment.label,
                data: `[IMAGE] ${attachment.label}: ${AI_BINARY_REATTACH_WARNING}`,
                preview: AI_BINARY_REATTACH_WARNING,
            };
        }
        return {
            type: attachment.type === 'sql' || attachment.type === 'table' ? attachment.type : 'file',
            label: attachment.label,
            data: attachment.data || '',
            preview: attachment.preview,
        };
    });
}

async function readPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const task = pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false });
    try {
        const pdf = await task.promise;
        if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages > AI_ATTACHMENT_BOUNDS.maxPdfPages) {
            throw new Error('PDF has too many pages; attach a smaller excerpt.');
        }
        const pages: string[] = [];
        let characters = 0;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            try {
                const content = await page.getTextContent();
                let pageText = `--- Page ${i} ---\n`;
                for (const item of content.items) {
                    if (!('str' in item)) continue;
                    const remaining = AI_ATTACHMENT_BOUNDS.maxExtractedCharacters - characters - pageText.length;
                    if (remaining <= 0) break;
                    pageText += `${item.str.slice(0, remaining)} `;
                }
                pages.push(pageText);
                characters += pageText.length + 2;
                if (characters >= AI_ATTACHMENT_BOUNDS.maxExtractedCharacters) {
                    return boundAiExtractedText(pages.join('\n\n') + '\n[PDF text omitted beyond the character limit]');
                }
            } finally {
                page.cleanup();
            }
        }
        return pages.join('\n\n');
    } finally {
        await task.destroy();
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
    const draftRevision = Number(draftState?.aiDraftRevision || 0);
    const draftAttachments = useMemo(
        () => (Array.isArray(draftState?.attachments)
            ? draftState.attachments.filter(isPersistedDraftAttachment)
            : []),
        [draftState],
    );
    const [input, setInput] = useState(draftInput);
    const [isLoading, setIsLoading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>(draftAttachments);
    const attachmentsRef = useRef(attachments);
    attachmentsRef.current = attachments;
    const attachmentReadPendingRef = useRef(false);
    const pendingUserMessageRef = useRef<{ chatId: string; actorKey: string | null; message: AiMessage; input: string; attachments: string } | null>(null);
    const [runtimeModelStatuses, setRuntimeModelStatuses] = useState<Record<string, AiModelRuntimeStatus>>({});
    const [configuredProviders, setConfiguredProviders] = useState<Record<string, boolean> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestOwnerRef = useRef<AiChatRequestOwner | null>(null);
    const requestGenerationRef = useRef(0);
    const mountedRef = useRef(true);
    const actorKey = store.user?.id || store.user?.email || null;
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
    const modelStatuses = useMemo(() => {
        const statuses = { ...runtimeModelStatuses };
        if (!configuredProviders) return statuses;
        for (const model of getAssistantModelCatalog().flatMap((group) => group.items)) {
            const provider = getAssistantModelProvider(model.id);
            if (provider && configuredProviders[provider] === false) {
                statuses[model.id] = 'unconfigured';
            }
        }
        return statuses;
    }, [configuredProviders, runtimeModelStatuses]);
    const selectedProvider = getAssistantModelProvider(assistantSelection);
    const isSelectedProviderConfigured =
        !selectedProvider || configuredProviders?.[selectedProvider] !== false;
    const registerModelError = useCallback((message: string) => {
        const failure = describeAiProviderError(message, store.lang);
        if (failure.status) {
            setRuntimeModelStatuses((current) => ({
                ...current,
                [assistantSelection]: failure.status,
            }));
        }
        return failure.message;
    }, [assistantSelection, store.lang]);
    const queryClient = useQueryClient();

    const previousDraftKeyRef = useRef(draftKey);
    const previousDraftRevisionRef = useRef(draftRevision);

    useEffect(() => {
        if (preferences.enabled !== true || !isAiEnabled()) return;
        assertAiEnabled();
        let cancelled = false;
        void aiService.getProviderStatus()
            .then(({ providers }) => {
                if (!cancelled && isAiEnabled()) setConfiguredProviders(providers);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [preferences.enabled]);

    useEffect(() => {
        if (
            previousDraftKeyRef.current === draftKey &&
            previousDraftRevisionRef.current === draftRevision
        ) {
            return;
        }

        previousDraftKeyRef.current = draftKey;
        previousDraftRevisionRef.current = draftRevision;
        setInput(draftInput);
        setAttachments(draftAttachments);
    }, [draftAttachments, draftInput, draftKey, draftRevision]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPageState(draftKey, {
                input,
                attachments: persistedDraftAttachments,
            });
        }, 250);

        return () => clearTimeout(timer);
    }, [draftKey, input, persistedDraftAttachments, setPageState]);

    const appendAttachment = (attachment: Attachment) => {
        try {
            const next = [...attachmentsRef.current, attachment];
            assertAiAttachmentBounds(next);
            attachmentsRef.current = next;
            setAttachments(next);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAiEnabled()) return;
        assertAiEnabled();
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        if (attachmentReadPendingRef.current) {
            toast.error('Wait for the current attachment to finish loading.');
            return;
        }
        attachmentReadPendingRef.current = true;
        const selectedChatId = useAppStore.getState().activeAiChatId;
        const selectedActor = useAppStore.getState().user?.id;
        const isCurrent = () => mountedRef.current && isAiEnabled() &&
            useAppStore.getState().activeAiChatId === selectedChatId && useAppStore.getState().user?.id === selectedActor;
        try {
            const kind = assertAiAttachmentPreflight(file, attachmentsRef.current);
            const header = await file.slice(0, AI_ATTACHMENT_BOUNDS.signatureBytes).arrayBuffer();
            if (!isCurrent()) return;
            assertAiFileSignature(file, kind, header);
            // Reserve again after the asynchronous header read, before any full blob/worker work.
            assertAiAttachmentPreflight(file, attachmentsRef.current);
            const ext = getFileExtension(file.name);
            if (kind === 'text') {
                const content = await file.text();
                if (!isCurrent()) return;
                assertAiTextFileContent(content, file.size);
                appendAttachment({
                    type: 'file',
                    label: `${getFileEmoji(ext)} ${file.name}`,
                    data: `[File: ${file.name} (${ext || 'text'})]\n\n${boundAiExtractedText(content)}`,
                    preview: `${ext.toUpperCase() || 'TEXT'} - ${(file.size / 1024).toFixed(0)} KB`,
                });
                return;
            }
            const rawData = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid attachment data.'));
                reader.onerror = () => reject(reader.error || new Error('Cannot read attachment.'));
                reader.readAsDataURL(file);
            });
            if (!isCurrent()) return;
            assertAiBinaryDataUrl(rawData, kind, file.size);
            if (kind === 'image') {
                appendAttachment({ type: 'image', label: file.name, data: rawData, preview: rawData });
                return;
            }
            assertAiAttachmentPreflight(file, attachmentsRef.current);
            const buffer = await file.arrayBuffer();
            if (!isCurrent()) return;
            if (buffer.byteLength !== file.size) throw new Error('PDF size declaration does not match its content.');
            const extracted = await readPdfText(buffer);
            if (!isCurrent()) return;
            appendAttachment({
                type: 'file',
                label: `PDF: ${file.name}`,
                data: `[PDF File: ${file.name}]\n[Locally extracted text fallback]\n[${AI_BINARY_REATTACH_WARNING}]\n\n${boundAiExtractedText(extracted)}`,
                preview: `PDF - ${(file.size / 1024).toFixed(0)} KB. ${AI_BINARY_REATTACH_WARNING}`,
                rawData,
                mimeType: 'application/pdf',
            });
        } catch (error) {
            if (isCurrent()) toast.error(getErrorMessage(error));
        } finally {
            attachmentReadPendingRef.current = false;
        }
    };

    const handlePasteQuery = () => {
        if (!isAiEnabled()) return;
        assertAiEnabled();
        if (activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv') {
            const mql = store.nosqlMqlQuery;
            if (mql && mql.trim()) {
                appendAttachment({
                    type: 'sql',
                    label: `MQL Query`,
                    data: mql,
                });
            }
        } else if (activeTab?.type === 'query' && activeTab.metadata?.sql) {
            const sql = activeTab.metadata.sql;
            if (sql.trim()) {
                appendAttachment({
                    type: 'sql',
                    label: text.aiChat.sqlFromTab(activeTab.title),
                    data: sql,
                });
            }
        }
    };

    const handleMentionTable = async () => {
        if (!isAiEnabled() || !activeConnection) return;
        assertAiEnabled();

        const isNoSql = activeConnection.type === 'mongodb' || activeConnection.type === 'mongodb+srv';

        if (isNoSql) {
            if (!activeDatabase) return;

            if (store.nosqlActiveCollection) {
                const schemaStr = store.nosqlSchemaStats ?
                    `${text.aiChat.schemaPrefix(store.nosqlActiveCollection)}\n` +
                    formatNoSqlSchemaFields(store.nosqlSchemaStats, true)
                    : text.aiChat.collectionWithoutSchema(store.nosqlActiveCollection);

                appendAttachment({
                    type: 'table',
                    label: `Schema: ${store.nosqlActiveCollection}` ,
                    data: schemaStr,
                });
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
                assertAiEnabled();
                const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
                await adapter.connect(activeConnection);
                if (!isAiEnabled()) return;
                assertAiEnabled();
                const metadata = cachedMetadata || await adapter.getMetadata(tableId);
                if (!isAiEnabled()) return;
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

                appendAttachment({
                    type: 'table',
                    label: `Schema: ${schema}.${resolvedTable}` ,
                    data: schemaContext,
                });
                return;
            } catch {
                if (!isAiEnabled()) return;
                appendAttachment({
                    type: 'table',
                    label: `Table: ${schema}.${resolvedTable}` ,
                    data: `[SQL CONTEXT] Database: ${resolvedDatabase}\nSchema: ${schema}\nTable: ${resolvedTable}\nDetailed metadata could not be loaded for this table.`,
                });
                return;
            }
        }

        if (activeDatabase) {
            appendAttachment({
                type: 'table',
                label: `Database: ${activeDatabase}` ,
                data: text.aiChat.databaseContext(activeConnection.name, activeDatabase, activeConnection.type),
            });
        }
    };

    const hasRequestContext = useCallback((owner: AiChatRequestOwner) => {
        const current = useAppStore.getState();
        return mountedRef.current
            && requestGenerationRef.current === owner.generation
            && isAiEnabled()
            && current.activeAiChatId === owner.chatId
            && current.activeConnectionId === owner.connectionId
            && current.activeDatabase === owner.database
            && (current.user?.id || current.user?.email || null) === owner.actorKey
            && (current.accessToken || null) === owner.accessToken
            && current.isAuthenticated === owner.isAuthenticated
            && current.isAuthenticated
            && current.aiChats.some(chat => chat.id === owner.chatId)
            && (!owner.aiMessageId || !!findAiMessage(current.aiChats.find(chat => chat.id === owner.chatId), owner.aiMessageClientId || owner.aiMessageId));
    }, []);

    const ownsRequest = useCallback((owner: AiChatRequestOwner) => (
        requestOwnerRef.current === owner && !owner.controller.signal.aborted && hasRequestContext(owner)
    ), [hasRequestContext]);

    const releaseRequest = useCallback((owner: AiChatRequestOwner) => {
        disposeAiChatRequest(owner);
        if (requestOwnerRef.current !== owner) return;
        requestOwnerRef.current = null;
        if (mountedRef.current) setIsLoading(false);
    }, []);

    const claimRequest = useCallback((chatId: string): AiChatRequestOwner | null => {
        if (!mountedRef.current || requestOwnerRef.current || !isAiEnabled()) return null;
        const owner: AiChatRequestOwner = {
            generation: ++requestGenerationRef.current,
            chatId,
            connectionId: activeConnectionId,
            database: activeDatabase,
            actorKey,
            accessToken: store.accessToken || null,
            isAuthenticated: store.isAuthenticated,
            controller: new AbortController(),
            aiMessageId: null,
            aiMessageClientId: null,
            persistence: null,
            terminal: false,
            rawText: '',
            lastUpdate: 0,
            pendingUpdate: null,
            timer: null,
            reader: null,
        };
        requestOwnerRef.current = owner;
        if (!ownsRequest(owner)) {
            requestOwnerRef.current = null;
            return null;
        }
        setIsLoading(true);
        return owner;
    }, [activeConnectionId, activeDatabase, actorKey, store.accessToken, store.isAuthenticated, ownsRequest]);

    const reportPersistenceFailure = useCallback((error: unknown) => {
        toast.error((store.lang === 'vi' ? 'Không thể lưu tin nhắn: ' : 'Could not save message: ') + getErrorMessage(error));
    }, [store.lang]);

    const finalizeRequest = useCallback((owner: AiChatRequestOwner, updates: Partial<AiMessage>) => {
        if (!ownsRequest(owner) || owner.terminal || !owner.aiMessageId) return false;
        owner.terminal = true;
        if (owner.timer !== null) clearTimeout(owner.timer);
        owner.timer = null;
        owner.pendingUpdate = null;
        const existing = findAiMessage(useAppStore.getState().aiChats.find(chat => chat.id === owner.chatId), owner.aiMessageClientId || owner.aiMessageId);
        if (!existing) return false;
        const finalMessage: AiMessage = {
            ...existing,
            role: 'ai',
            content: '',
            timestamp: Date.now(),
            ...updates,
            id: existing.id,
            clientId: existing.clientId || existing.id,
        };
        owner.aiMessageId = finalMessage.id;
        updateAiMessage(owner.chatId, owner.aiMessageId, finalMessage);
        owner.persistence = (async () => {
            try {
                const saved = await store.syncAiMessage(owner.chatId, finalMessage);
                if (!hasRequestContext(owner) || !saved) return;
                owner.aiMessageId = saved.id;
                if (updates.delivery === 'interrupted') {
                    updateAiMessage(owner.chatId, saved.id, { delivery: 'interrupted', deliveryError: updates.deliveryError });
                }
            } catch (error) {
                if (hasRequestContext(owner)) reportPersistenceFailure(error);
            }
        })();
        return true;
    }, [hasRequestContext, ownsRequest, reportPersistenceFailure, store, updateAiMessage]);

    const flushRequestText = useCallback((owner: AiChatRequestOwner) => {
        if (owner.timer !== null) clearTimeout(owner.timer);
        owner.timer = null;
        if (!ownsRequest(owner) || owner.terminal || !owner.aiMessageId || !owner.pendingUpdate) return;
        const pending = owner.pendingUpdate;
        owner.pendingUpdate = null;
        owner.lastUpdate = Date.now();
        updateAiMessage(owner.chatId, owner.aiMessageId, { content: pending.message });
    }, [ownsRequest, updateAiMessage]);

    const removeAttachment = (index: number) => {
        const next = attachmentsRef.current.filter((_, i) => i !== index);
        attachmentsRef.current = next;
        setAttachments(next);
    };

    const processSseLine = useCallback((owner: AiChatRequestOwner, line: string) => {
        if (!ownsRequest(owner) || owner.terminal || !owner.aiMessageId || !line.startsWith('data: ')) return;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') return;

        const event = parseAiStreamEvent(data);
        if (!event) return;
        if (event.type === 'chunk' && event.text) {
            owner.rawText += event.text;
            owner.pendingUpdate = parsePartialAiResponse(owner.rawText);
            const now = Date.now();
            if (now - owner.lastUpdate > 40) {
                flushRequestText(owner);
            } else if (owner.timer === null) {
                owner.timer = setTimeout(() => flushRequestText(owner), 40 - (now - owner.lastUpdate));
            }
            return;
        }
        if (event.type === 'done') {
            const result = event.data || {};
            const modelInfo = result.providerLabel || result.provider || result.model || result.routingMode
                ? {
                    provider: result.providerLabel || result.provider,
                    model: result.model,
                    routingMode: result.routingMode,
                }
                : undefined;
            const finalMessage: AiMessage = {
                id: owner.aiMessageId,
                role: 'ai',
                content: result.message || owner.rawText,
                sql: result.sql || undefined,
                explanation: result.explanation || undefined,
                recommendations: result.recommendations || undefined,
                modelInfo,
                ...normalizeAiMessageProvenance(result),
                contractVersion: 1,
                timestamp: Date.now(),
            };
            if (!hasAiResponseContent(finalMessage)) {
                finalizeRequest(owner, {
                    content: text.aiChat.error(registerModelError('AI provider returned an empty response.')),
                    error: true,
                });
                return;
            }
            if (finalizeRequest(owner, finalMessage)) {
                setRuntimeModelStatuses((current) => {
                    if (!current[assistantSelection]) return current;
                    const next = { ...current };
                    delete next[assistantSelection];
                    return next;
                });
            }
            return;
        }
        if (event.type === 'error') {
            finalizeRequest(owner, {
                content: text.aiChat.error(registerModelError(event.text || 'Unknown error')),
                error: true,
            });
        }
    }, [assistantSelection, finalizeRequest, flushRequestText, ownsRequest, registerModelError, text]);

    const triggerGenerate = useCallback(async (chatId: string, prompt: string, customAttachments: Attachment[] = [], customImageData?: string, requestOwner?: AiChatRequestOwner) => {
        if (!isAiEnabled()) return;
        assertAiEnabled();
        assertAiAttachmentBounds(customAttachments);
        if (customImageData) assertAiBinaryDataUrl(customImageData, 'image');
        const owner = requestOwner || claimRequest(chatId);
        if (!owner || !ownsRequest(owner) || owner.aiMessageId) return;
        const aiMsgId = crypto.randomUUID();
        const signal = owner.controller.signal;
        try {
            const localMessage = await waitForAiChatRequest(addAiMessage(chatId, { id: aiMsgId, role: 'ai', content: '', timestamp: Date.now() }), signal);
            if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
            owner.aiMessageId = localMessage.id;
            owner.aiMessageClientId = localMessage.clientId || aiMsgId;
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
            const chat = useAppStore.getState().aiChats.find(c => c.id === chatId);
            const history = toRequestHistory(chat?.messages || [], owner.aiMessageId);

            assertAiEnabled();
            if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
            const pendingResponse = adapter.generateSqlStream({
                database: owner.database || undefined,
                prompt: prompt || text.aiChat.attachmentOnlyPrompt,
                image: imageData,
                context: contextParts.length > 0 ? contextParts.join('\n\n') : undefined,
                model: resolvedAssistant.model,
                document,
                mode: aiMode,
                routingMode: aiRoutingMode,
                providerOverride: resolvedAssistant.providerOverride,
                history: history.length > 0 ? history : undefined,
                disabledProviders: preferences.disabledProviders,
                fallbackProvider: preferences.fallbackProvider,
            }, { signal });
            // A signal-ignoring adapter may deliver headers after the owner is gone.
            void pendingResponse.then((response) => {
                if (!ownsRequest(owner)) {
                    try { void response.body?.cancel().catch(() => undefined); } catch { /* already closed */ }
                }
            }, () => undefined);
            const response = await waitForAiChatRequest(pendingResponse, signal);
            if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
            if (!response.ok) {
                const errorText = await waitForAiChatRequest(response.text(), signal);
                if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
                throw new Error(errorText || response.statusText);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No readable stream');
            owner.reader = reader;
            const decoder = new TextDecoder();
            let buffer = '';

            while (!owner.terminal) {
                if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
                const { value, done } = await waitForAiChatRequest(reader.read(), signal);
                // Guard even EOF: buffered events still belong to this snapshot.
                if (!ownsRequest(owner)) throw new DOMException('Aborted', 'AbortError');
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const line of lines) {
                    processSseLine(owner, line.trimEnd());
                    if (owner.terminal) break;
                }
            }

            if (!owner.terminal) {
                buffer += decoder.decode();
                if (buffer) {
                    for (const line of buffer.split(/\r?\n/)) {
                        processSseLine(owner, line.trimEnd());
                        if (owner.terminal) break;
                    }
                }
            }
            if (!owner.terminal && ownsRequest(owner)) {
                flushRequestText(owner);
                const completedMessage = findAiMessage(useAppStore.getState().aiChats
                    .find(chat => chat.id === owner.chatId), owner.aiMessageClientId || aiMsgId);
                if (!hasAiResponseContent(completedMessage)) {
                    throw new Error('AI provider returned an empty response.');
                }
                finalizeRequest(owner, completedMessage!);
            }
        } catch (error) {
            if (!ownsRequest(owner) || owner.terminal) return;
            const errorMessage = getErrorMessage(error);
            if ((error instanceof DOMException && error.name === 'AbortError') || errorMessage === 'Aborted') {
                finalizeRequest(owner, {
                    content: (owner.rawText ? parsePartialAiResponse(owner.rawText).message : '') + `\n\n[${text.aiChat.aborted}]`,
                });
            } else {
                if (!owner.aiMessageId) {
                    reportPersistenceFailure(error);
                    return;
                }
                finalizeRequest(owner, {
                    content: text.aiChat.error(registerModelError(errorMessage)),
                    error: true,
                });
            }
        } finally {
            if (owner.persistence) {
                // The terminal stream must release its reader before waiting for storage.
                const reader = owner.reader;
                owner.reader = null;
                if (reader) {
                    try { void reader.cancel().catch(() => undefined); } catch { /* already closed */ }
                    try { reader.releaseLock(); } catch { /* already released */ }
                }
                try { await waitForAiChatRequest(owner.persistence, signal); } catch { /* stop/context change already handled */ }
            }
            releaseRequest(owner);
        }
    }, [addAiMessage, claimRequest, ownsRequest, finalizeRequest, flushRequestText, processSseLine, releaseRequest, reportPersistenceFailure, aiMode, aiRoutingMode, activeConnection?.type, resolvedAssistant.model, resolvedAssistant.providerOverride, preferences.disabledProviders, preferences.fallbackProvider, registerModelError, store, text]);

    const handleStop = useCallback(() => {
        const owner = requestOwnerRef.current;
        if (!owner) return;
        finalizeRequest(owner, {
            content: (owner.rawText ? parsePartialAiResponse(owner.rawText).message : '') + `\n\n[${text.aiChat.aborted}]`,
            delivery: 'interrupted',
            deliveryError: { message: text.aiChat.aborted },
        });
        owner.controller.abort();
        releaseRequest(owner);
    }, [finalizeRequest, releaseRequest, text]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            const owner = requestOwnerRef.current;
            if (owner) {
                owner.controller.abort();
                releaseRequest(owner);
            }
        };
    }, [releaseRequest]);

    useEffect(() => {
        const owner = requestOwnerRef.current;
        if (owner && (preferences.enabled !== true || !ownsRequest(owner))) {
            owner.controller.abort();
            releaseRequest(owner);
        }
    }, [activeAiChatId, activeConnectionId, activeDatabase, actorKey, store.accessToken, store.isAuthenticated, preferences.enabled, ownsRequest, releaseRequest]);

    const handleSend = useCallback(async () => {
        if (!isAiEnabled() || (!input.trim() && attachments.length === 0) || requestOwnerRef.current || !activeAiChatId || !isSelectedProviderConfigured) return;
        assertAiEnabled();
        try {
            assertAiAttachmentBounds(attachments);
        } catch (error) {
            toast.error(getErrorMessage(error));
            return;
        }

        if (!activeConnection) {
            try {
                await addAiMessage(activeAiChatId, {
                    id: crypto.randomUUID(),
                    role: 'ai',
                    content: text.aiChat.noDatabaseMessage,
                    error: true,
                    timestamp: Date.now(),
                });
            } catch (error) {
                reportPersistenceFailure(error);
            }
            return;
        }
        const owner = claimRequest(activeAiChatId);
        if (!owner) return;
        try {
            const attachmentLabels = attachments.map(a => {
                if (a.type === 'image') return '';
                if (a.type === 'sql') return text.aiChat.attachedSql;
                if (a.type === 'table') return a.label;
                return a.label;
            });

            const displayContent = [input.trim(), ...attachmentLabels].filter(Boolean).join('\n');

            const previous = pendingUserMessageRef.current;
            const canRetry = previous?.chatId === activeAiChatId && previous.actorKey === owner.actorKey
                && previous.input === input.trim() && previous.attachments === JSON.stringify(attachments);
            const existing = canRetry ? findAiMessage(useAppStore.getState().aiChats.find(chat => chat.id === activeAiChatId), previous.message.clientId || previous.message.id) : undefined;
            const userMsg: AiMessage = existing || {
                id: crypto.randomUUID(),
                role: 'user',
                content: displayContent,
                timestamp: Date.now(),
                attachments: attachments.map(a => {
                    if (a.type === 'image') return { type: a.type, label: a.label, preview: a.preview };
                    const persisted = { type: a.type, label: a.label, preview: a.preview, data: a.data };
                    return a.rawData || a.mimeType === 'application/pdf' ? warnAiBinaryOmitted(persisted) : persisted;
                })
            };
            pendingUserMessageRef.current = { chatId: activeAiChatId, actorKey: owner.actorKey, message: userMsg, input: input.trim(), attachments: JSON.stringify(attachments) };
            const saved = await waitForAiChatRequest(existing
                ? store.syncAiMessage(activeAiChatId, userMsg)
                : addAiMessage(activeAiChatId, userMsg), owner.controller.signal);
            if (!ownsRequest(owner) || !saved) return;
            await waitForAiChatRequest(store.waitForAiMessagePersistence(activeAiChatId, saved.clientId || saved.id), owner.controller.signal);
            if (!ownsRequest(owner)) return;
            pendingUserMessageRef.current = null;

            const currentInput = input.trim();
            const currentAttachments = [...attachments];
            setInput('');
            attachmentsRef.current = [];
            setAttachments([]);
            await triggerGenerate(activeAiChatId, currentInput, currentAttachments, undefined, owner);
        } catch (error) {
            if (ownsRequest(owner)) reportPersistenceFailure(error);
        } finally {
            releaseRequest(owner);
        }
    }, [input, attachments, activeAiChatId, isSelectedProviderConfigured, activeConnection, addAiMessage, claimRequest, ownsRequest, releaseRequest, reportPersistenceFailure, store, text, triggerGenerate]);

    const handleRegenerate = useCallback(async (chatId: string, aiMessageId?: string): Promise<boolean> => {
        if (!isAiEnabled() || requestOwnerRef.current) return false;
        assertAiEnabled();
        const chat = useAppStore.getState().aiChats.find(c => c.id === chatId);
        if (!chat || isLoading) return false;
        const target = aiMessageId ? findAiMessage(chat, aiMessageId) : undefined;
        if (aiMessageId && !target) return false;
        const owner = claimRequest(chatId);
        if (!owner) return false;
        try {
            if (target?.delivery === 'failed') {
                const saved = await waitForAiChatRequest(store.syncAiMessage(chatId, target), owner.controller.signal);
                if (!ownsRequest(owner) || !saved) return false;
                await waitForAiChatRequest(store.waitForAiMessagePersistence(chatId, saved.clientId || saved.id), owner.controller.signal);
                return ownsRequest(owner);
            }
            if (target?.delivery === 'pending') {
                await waitForAiChatRequest(store.waitForAiMessagePersistence(chatId, target.clientId || target.id), owner.controller.signal);
                if (!ownsRequest(owner)) return false;
            }
            const currentChat = useAppStore.getState().aiChats.find(c => c.id === chatId);
            const canonicalTarget = target ? findAiMessage(currentChat, target.clientId || target.id) : undefined;
            const lastUserMsg = findReplaySourceUserMessage(currentChat?.messages || [], canonicalTarget?.id);
            if (!lastUserMsg) return false;
            const userKey = lastUserMsg.clientId || lastUserMsg.id;
            if (lastUserMsg.delivery === 'failed' || lastUserMsg.delivery === 'local' || lastUserMsg.delivery === 'interrupted') {
                await waitForAiChatRequest(store.syncAiMessage(chatId, lastUserMsg), owner.controller.signal);
                if (!ownsRequest(owner)) return false;
            }
            const persistedUser = await waitForAiChatRequest(store.waitForAiMessagePersistence(chatId, userKey), owner.controller.signal);
            if (!ownsRequest(owner)) return false;
            assertAiEnabled();
            await waitForAiChatRequest(store.editAiMessage(chatId, persistedUser.id, persistedUser.content), owner.controller.signal);
            if (!ownsRequest(owner)) return false;
            const editedUser = findAiMessage(useAppStore.getState().aiChats.find(c => c.id === chatId), userKey);
            if (!editedUser) return false;
            assertAiEnabled();
            await triggerGenerate(chatId, editedUser.content, toTriggerAttachments(editedUser.attachments), undefined, owner);
            return hasRequestContext(owner);
        } catch (error) {
            if (ownsRequest(owner)) reportPersistenceFailure(error);
            return false;
        } finally {
            releaseRequest(owner);
        }
    }, [store, isLoading, claimRequest, hasRequestContext, ownsRequest, releaseRequest, reportPersistenceFailure, triggerGenerate]);

    const handleEditSubmit = useCallback(async (chatId: string, messageId: string, newContent: string): Promise<boolean> => {
        if (!isAiEnabled() || isLoading || requestOwnerRef.current) return false;
        assertAiEnabled();
        const messageToReplay = findAiMessage(useAppStore.getState().aiChats.find(c => c.id === chatId), messageId);
        if (!messageToReplay || messageToReplay.role !== 'user') return false;
        const owner = claimRequest(chatId);
        if (!owner) return false;
        let edited = false;
        try {
            const userKey = messageToReplay.clientId || messageToReplay.id;
            if (messageToReplay.delivery === 'failed' || messageToReplay.delivery === 'local' || messageToReplay.delivery === 'interrupted') {
                await waitForAiChatRequest(store.syncAiMessage(chatId, messageToReplay), owner.controller.signal);
                if (!ownsRequest(owner)) return false;
            }
            const persisted = await waitForAiChatRequest(store.waitForAiMessagePersistence(chatId, userKey), owner.controller.signal);
            if (!ownsRequest(owner)) return false;
            assertAiEnabled();
            await waitForAiChatRequest(store.editAiMessage(chatId, persisted.id, newContent), owner.controller.signal);
            if (!ownsRequest(owner)) return false;
            edited = true;
            const editedUser = findAiMessage(useAppStore.getState().aiChats.find(c => c.id === chatId), userKey);
            if (!editedUser) return false;
            assertAiEnabled();
            await triggerGenerate(chatId, editedUser.content, toTriggerAttachments(editedUser.attachments), undefined, owner);
            return true;
        } catch (error) {
            if (ownsRequest(owner)) reportPersistenceFailure(error);
            return edited;
        } finally {
            releaseRequest(owner);
        }
    }, [isLoading, store, claimRequest, ownsRequest, releaseRequest, reportPersistenceFailure, triggerGenerate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend().catch(reportPersistenceFailure);
        }
    }, [handleSend, reportPersistenceFailure]);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const locale = store.lang === 'en' ? 'en-US' : 'vi-VN';
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    };

    return {
        input, setInput, isLoading, attachments, modelStatuses, messagesEndRef, fileInputRef,
        handleFileSelected, handlePasteQuery, handleMentionTable, removeAttachment, handleSend, handleKeyDown, formatTime,
        handleRegenerate, handleEditSubmit, handleStop
    };
}
