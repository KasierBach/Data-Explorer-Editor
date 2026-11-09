import { apiService } from './api.service';
import type { AiMessage, AiChat } from './store/slices/aiChatSlice';

interface AiChatResponse {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

interface AiMessageResponse {
  id: string;
  role: 'user' | 'ai' | 'model';
  content: string;
  sql?: string;
  explanation?: string;
  thought?: string;
  error?: boolean;
  attachments?: AiMessageStoragePayload;
  createdAt: string;
}

interface AiChatDetailResponse {
    messages?: AiMessageResponse[];
    updatedAt?: string;
}

export interface AiChatMessageSnapshot {
    messages: AiMessage[];
    serverUpdatedAt?: string;
}

export interface AiMessageWriteOptions {
    expectedUpdatedAt?: string;
}

export interface AiMessagePersistenceResult {
    id: string;
    updatedAt: string;
    chatUpdatedAt: string;
    persistence: { state: 'saved' | 'already_saved' };
    message?: AiMessage;
}

export interface AiMessageEditResult extends AiMessagePersistenceResult {
    message: AiMessage;
    deletedCount: number;
}

interface AiMessageWriteResponse extends Partial<AiMessageResponse> {
    id: string;
    chatUpdatedAt: string;
    persistence: AiMessagePersistenceResult['persistence'];
    deletedCount?: number;
}

type CreateChatResponse = AiChatResponse;

interface AiMessagePayloadItem {
    type: string;
    label: string;
    preview?: string;
    data?: string;
}

interface AiMessagePayloadEnvelope {
    items?: AiMessagePayloadItem[];
    modelInfo?: AiMessage['modelInfo'];
    recommendations?: AiMessage['recommendations'];
    sources?: AiMessage['sources'];
    usage?: AiMessage['usage'];
    usageCoverage?: AiMessage['usageCoverage'];
    attemptCount?: AiMessage['attemptCount'];
    measuredAttemptCount?: AiMessage['measuredAttemptCount'];
    costCoverage?: AiMessage['costCoverage'];
    observedUsage?: AiMessage['observedUsage'];
    warnings?: AiMessage['warnings'];
    generationId?: AiMessage['generationId'];
    contractVersion?: AiMessage['contractVersion'];
}

type AiMessageStoragePayload = AiMessagePayloadItem[] | AiMessagePayloadEnvelope;

function isAiMessagePayloadItem(value: unknown): value is AiMessagePayloadItem {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { type?: unknown; label?: unknown };
    return typeof candidate.type === 'string' && typeof candidate.label === 'string';
}

function getPayloadRecord(payload: unknown) {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : null;
}

type AiMessageProvenance = Pick<AiMessage,
    'sources' | 'usage' | 'usageCoverage' | 'attemptCount' | 'measuredAttemptCount' |
    'costCoverage' | 'observedUsage' | 'warnings' | 'generationId' | 'contractVersion'>;

function normalizeAiMessageUsage(value: unknown): AiMessage['usage'] | undefined {
    if (value === null) return null;
    const usageRecord = getPayloadRecord(value);
    if (!usageRecord) return undefined;
    const usage: Exclude<AiMessage['usage'], null | undefined> = {};
    for (const key of ['promptTokens', 'completionTokens', 'totalTokens'] as const) {
        const counter = usageRecord[key];
        if (counter === null || (typeof counter === 'number' && Number.isSafeInteger(counter) && counter >= 0)) {
            usage[key] = counter;
        }
    }
    return Object.keys(usage).length ? usage : undefined;
}

function normalizeAiMessageAttemptCount(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8
        ? value
        : undefined;
}

export function normalizeAiMessageProvenance(payload: unknown): AiMessageProvenance {
    const payloadRecord = getPayloadRecord(payload);
    if (!payloadRecord) return {};

    const provenance: AiMessageProvenance = {};
    if (Array.isArray(payloadRecord.sources)) {
        const sources = new Set<string>();
        for (const entry of payloadRecord.sources) {
            if (typeof entry !== 'string' || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(entry)) continue;
            let hasControl = false;
            for (let index = 0; index < entry.length; index++) {
                const code = entry.charCodeAt(index);
                if (code < 32 || (code >= 127 && code <= 159)) { hasControl = true; break; }
            }
            if (hasControl) continue;
            try {
                const url = new URL(entry.trim());
                if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) continue;
                sources.add(url.toString());
                if (sources.size === 6) break;
            } catch { /* Ignore invalid source URLs. */ }
        }
        if (sources.size) provenance.sources = [...sources];
    }

    const usage = normalizeAiMessageUsage(payloadRecord.usage);
    if (usage !== undefined) provenance.usage = usage;
    const observedUsage = normalizeAiMessageUsage(payloadRecord.observedUsage);
    if (observedUsage !== undefined) provenance.observedUsage = observedUsage;

    if (typeof payloadRecord.usageCoverage === 'string' &&
        ['complete', 'partial', 'unavailable'].includes(payloadRecord.usageCoverage)) {
        provenance.usageCoverage = payloadRecord.usageCoverage as NonNullable<AiMessage['usageCoverage']>;
    }
    const attemptCount = normalizeAiMessageAttemptCount(payloadRecord.attemptCount);
    if (attemptCount !== undefined) provenance.attemptCount = attemptCount;
    const measuredAttemptCount = normalizeAiMessageAttemptCount(payloadRecord.measuredAttemptCount);
    if (measuredAttemptCount !== undefined && (attemptCount === undefined || measuredAttemptCount <= attemptCount)) {
        provenance.measuredAttemptCount = measuredAttemptCount;
    }
    if (payloadRecord.costCoverage === 'unavailable') provenance.costCoverage = 'unavailable';

    if (Array.isArray(payloadRecord.warnings)) {
        const warnings = payloadRecord.warnings.filter((warning): warning is string => (
            typeof warning === 'string' && warning.trim().length > 0
        ));
        if (warnings.length) provenance.warnings = warnings;
    }
    if (typeof payloadRecord.generationId === 'string' && payloadRecord.generationId.trim()) {
        provenance.generationId = payloadRecord.generationId;
    }
    if (payloadRecord.contractVersion === 1) provenance.contractVersion = 1;
    return provenance;
}

function normalizeAiMessageStoragePayload(payload: unknown): {
    attachments?: { type: string; label: string; preview?: string }[];
    modelInfo?: AiMessage['modelInfo'];
    recommendations?: AiMessage['recommendations'];
} & AiMessageProvenance {
    if (Array.isArray(payload)) {
        return { attachments: payload.filter(isAiMessagePayloadItem) };
    }

    const payloadRecord = getPayloadRecord(payload);
    if (payloadRecord) {
        const items = payloadRecord.items;
        return {
            attachments: Array.isArray(items) ? items.filter(isAiMessagePayloadItem) : undefined,
            modelInfo: getPayloadRecord(payloadRecord.modelInfo) as AiMessage['modelInfo'] | undefined,
            recommendations: Array.isArray(payloadRecord.recommendations)
                ? payloadRecord.recommendations as AiMessage['recommendations']
                : undefined,
            ...normalizeAiMessageProvenance(payloadRecord),
        };
    }

    return {};
}

function buildAiMessageStoragePayload(message: Partial<AiMessage>): AiMessageStoragePayload | undefined {
    const provenance = normalizeAiMessageProvenance(message);
    const hasMetadata = !!message.modelInfo || !!message.recommendations || Object.keys(provenance).length > 0;
    if (!hasMetadata) {
        return message.attachments;
    }

    return {
        items: message.attachments || [],
        modelInfo: message.modelInfo,
        recommendations: message.recommendations,
        ...provenance,
        contractVersion: 1,
    };
}

export function isAiMessageUuid(id: unknown): id is string {
    return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function hydrateAiMessage(message: AiMessageResponse): AiMessage {
    return {
        id: message.id,
        clientId: message.id,
        role: message.role === 'model' ? 'ai' : message.role,
        content: message.content,
        sql: message.sql,
        explanation: message.explanation,
        thought: message.thought,
        error: message.error,
        ...normalizeAiMessageStoragePayload(message.attachments),
        timestamp: new Date(message.createdAt).getTime(),
        delivery: 'saved',
    };
}

function normalizePersistenceResult(response: AiMessageWriteResponse): AiMessagePersistenceResult {
    if (!response || typeof response.id !== 'string' || !response.id ||
        typeof response.chatUpdatedAt !== 'string' || !Number.isFinite(Date.parse(response.chatUpdatedAt)) ||
        !['saved', 'already_saved'].includes(response.persistence?.state)) {
        throw new Error('Invalid message persistence response');
    }
    return {
        id: response.id,
        updatedAt: response.chatUpdatedAt,
        chatUpdatedAt: response.chatUpdatedAt,
        persistence: response.persistence,
        message: typeof response.role === 'string' && typeof response.content === 'string' && typeof response.createdAt === 'string'
            ? hydrateAiMessage(response as AiMessageResponse)
            : undefined,
    };
}

export class AiChatService {
    static async fetchChats(): Promise<AiChat[]> {
        const data = await apiService.get<AiChatResponse[]>('/ai/chats');
        return data.map(chat => ({
            id: chat.id,
            title: chat.title,
            createdAt: new Date(chat.createdAt).getTime(),
            updatedAt: new Date(chat.updatedAt).getTime(),
            serverUpdatedAt: chat.updatedAt,
            messages: [] // Loaded lazily
        }));
    }

    static async loadMessages(chatId: string): Promise<AiMessage[]>;
    static async loadMessages(chatId: string, withVersion: true): Promise<AiChatMessageSnapshot>;
    static async loadMessages(chatId: string, withVersion?: true): Promise<AiMessage[] | AiChatMessageSnapshot> {
        const data = await apiService.get<AiChatDetailResponse>(`/ai/chats/${chatId}`);
        const messages = (data.messages || []).map(hydrateAiMessage);
        return withVersion ? { messages, serverUpdatedAt: data.updatedAt } : messages;
    }

    static async createChat(title: string = 'Cuộc trò chuyện mới'): Promise<CreateChatResponse> {
        return await apiService.post<CreateChatResponse>('/ai/chats', { title });
    }

    static async deleteChat(id: string): Promise<void> {
        await apiService.delete(`/ai/chats/${id}`);
    }

    static async saveMessage(chatId: string, message: Partial<AiMessage>, options: AiMessageWriteOptions = {}): Promise<AiMessagePersistenceResult> {
        const messagePayload = buildAiMessageStoragePayload(message);
        const response = await apiService.post<AiMessageWriteResponse>(`/ai/chats/${chatId}/messages`, {
            role: message.role,
            content: message.content,
            sql: message.sql,
            explanation: message.explanation,
            thought: message.thought,
            error: message.error || false,
            attachments: messagePayload,
            ...(isAiMessageUuid(message.id) ? { clientMessageId: message.id } : {}),
            ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
        });
        return normalizePersistenceResult(response);
    }

    static async updateMessage(chatId: string, messageId: string, message: Partial<AiMessage>, options: AiMessageWriteOptions = {}): Promise<AiMessagePersistenceResult> {
        const messagePayload = buildAiMessageStoragePayload(message);
        const response = await apiService.patch<AiMessageWriteResponse>(`/ai/chats/${chatId}/messages/${messageId}`, {
            role: message.role,
            content: message.content,
            sql: message.sql,
            explanation: message.explanation,
            thought: message.thought,
            error: message.error || false,
            attachments: messagePayload,
            ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
        });
        return normalizePersistenceResult(response);
    }

    static async editMessageAndTruncate(chatId: string, messageId: string, message: Partial<AiMessage>, options: AiMessageWriteOptions = {}): Promise<AiMessageEditResult> {
        const response = await apiService.patch<AiMessageWriteResponse>(`/ai/chats/${chatId}/messages/${messageId}/edit-and-truncate`, {
            role: message.role,
            content: message.content,
            sql: message.sql,
            explanation: message.explanation,
            thought: message.thought,
            error: message.error || false,
            attachments: buildAiMessageStoragePayload(message),
            ...(options.expectedUpdatedAt ? { expectedUpdatedAt: options.expectedUpdatedAt } : {}),
        });
        const result = normalizePersistenceResult(response);
        if (!result.message || response.persistence.state !== 'saved' ||
            !Number.isSafeInteger(response.deletedCount) || (response.deletedCount as number) < 0) {
            throw new Error('Invalid atomic edit response');
        }
        return { ...result, message: result.message, deletedCount: response.deletedCount as number };
    }

    static async updateChat(chatId: string, updates: { title?: string }): Promise<AiChatResponse> {
        return await apiService.patch<AiChatResponse>(`/ai/chats/${chatId}`, updates);
    }

    static async deleteMessage(chatId: string, messageId: string): Promise<{ success: boolean; chatUpdatedAt?: string }> {
        return await apiService.delete<{ success: boolean; chatUpdatedAt?: string }>(`/ai/chats/${chatId}/messages/${messageId}`);
    }

    static async deleteMessagesAfter(chatId: string, messageId: string): Promise<void> {
        await apiService.delete(`/ai/chats/${chatId}/messages/after/${messageId}`);
    }
}
