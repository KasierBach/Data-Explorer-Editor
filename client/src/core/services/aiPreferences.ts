import { useSyncExternalStore } from 'react';

export const AI_PREFERENCES_STORAGE_KEY = 'data-explorer-ai-preferences-v1';
export const INHERIT_ASSISTANT_MODEL = '__assistant__';
export const CUSTOM_PROVIDER_MODEL_PREFIX = 'custom-provider:';
export const AI_PREFERENCES_EVENT = 'data-explorer-ai-preferences-changed';

export type CustomAiProviderType = 'openai-compatible';

export interface CustomAiProvider {
    id: string;
    name: string;
    type: CustomAiProviderType;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface ClientAiProviderOverride {
    type: CustomAiProviderType;
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface AiPreferences {
    assistantModel?: string;
    explainModel: string;
    sqlModel: string;
    nosqlModel: string;
    customProviders: CustomAiProvider[];
}

const DEFAULT_AI_PREFERENCES: AiPreferences = {
    assistantModel: undefined,
    explainModel: INHERIT_ASSISTANT_MODEL,
    sqlModel: INHERIT_ASSISTANT_MODEL,
    nosqlModel: INHERIT_ASSISTANT_MODEL,
    customProviders: [],
};

let cachedPreferencesRaw: string | null | undefined;
let cachedPreferencesSnapshot: AiPreferences = DEFAULT_AI_PREFERENCES;

function isCustomProvider(value: unknown): value is CustomAiProvider {
    if (!value || typeof value !== 'object') return false;
    const provider = value as Partial<CustomAiProvider>;
    return typeof provider.id === 'string'
        && typeof provider.name === 'string'
        && typeof provider.baseUrl === 'string'
        && typeof provider.apiKey === 'string'
        && typeof provider.model === 'string';
}

function sanitizePreferences(value: unknown): AiPreferences {
    if (!value || typeof value !== 'object') {
        return DEFAULT_AI_PREFERENCES;
    }

    const input = value as Partial<AiPreferences>;
    const customProviders = Array.isArray(input.customProviders)
        ? input.customProviders.filter(isCustomProvider).map((provider) => ({
            ...provider,
            type: 'openai-compatible' as const,
            name: provider.name.trim(),
            baseUrl: provider.baseUrl.trim(),
            apiKey: provider.apiKey.trim(),
            model: provider.model.trim(),
        })).filter((provider) => provider.name && provider.baseUrl && provider.model)
        : [];

    return {
        assistantModel: typeof input.assistantModel === 'string' && input.assistantModel.trim()
            ? input.assistantModel
            : undefined,
        explainModel: typeof input.explainModel === 'string' && input.explainModel.trim()
            ? input.explainModel
            : INHERIT_ASSISTANT_MODEL,
        sqlModel: typeof input.sqlModel === 'string' && input.sqlModel.trim()
            ? input.sqlModel
            : INHERIT_ASSISTANT_MODEL,
        nosqlModel: typeof input.nosqlModel === 'string' && input.nosqlModel.trim()
            ? input.nosqlModel
            : INHERIT_ASSISTANT_MODEL,
        customProviders,
    };
}

function emitPreferencesChanged() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(AI_PREFERENCES_EVENT));
}

export function getCustomProviderModelId(providerId: string) {
    return `${CUSTOM_PROVIDER_MODEL_PREFIX}${providerId}`;
}

export function parseCustomProviderModelId(value?: string | null) {
    if (!value || !value.startsWith(CUSTOM_PROVIDER_MODEL_PREFIX)) {
        return null;
    }

    return value.slice(CUSTOM_PROVIDER_MODEL_PREFIX.length) || null;
}

export function readAiPreferences(): AiPreferences {
    if (typeof window === 'undefined') {
        return DEFAULT_AI_PREFERENCES;
    }

    let raw: string | null = null;

    try {
        raw = window.localStorage.getItem(AI_PREFERENCES_STORAGE_KEY);
        if (raw === cachedPreferencesRaw) {
            return cachedPreferencesSnapshot;
        }

        const snapshot = raw
            ? sanitizePreferences(JSON.parse(raw))
            : DEFAULT_AI_PREFERENCES;

        cachedPreferencesRaw = raw;
        cachedPreferencesSnapshot = snapshot;
        return snapshot;
    } catch {
        cachedPreferencesRaw = raw;
        cachedPreferencesSnapshot = DEFAULT_AI_PREFERENCES;
        return DEFAULT_AI_PREFERENCES;
    }
}

export function writeAiPreferences(next: AiPreferences) {
    if (typeof window === 'undefined') return;

    const sanitized = sanitizePreferences(next);
    const raw = JSON.stringify(sanitized);
    cachedPreferencesRaw = raw;
    cachedPreferencesSnapshot = sanitized;
    window.localStorage.setItem(AI_PREFERENCES_STORAGE_KEY, raw);
    emitPreferencesChanged();
}

export function updateAiPreferences(updater: (current: AiPreferences) => AiPreferences) {
    const current = readAiPreferences();
    writeAiPreferences(updater(current));
}

export function subscribeAiPreferences(listener: () => void) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    const onChange = () => listener();
    window.addEventListener(AI_PREFERENCES_EVENT, onChange);
    window.addEventListener('storage', onChange);

    return () => {
        window.removeEventListener(AI_PREFERENCES_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

export function useAiPreferences() {
    return useSyncExternalStore(
        subscribeAiPreferences,
        readAiPreferences,
        () => DEFAULT_AI_PREFERENCES,
    );
}

export function resolveAiSelection(
    selection: string | undefined,
    assistantFallbackModel: string,
    customProviders: CustomAiProvider[],
) {
    const effectiveSelection = !selection || selection === INHERIT_ASSISTANT_MODEL
        ? assistantFallbackModel
        : selection;
    const providerId = parseCustomProviderModelId(effectiveSelection);

    if (!providerId) {
        return {
            selection: effectiveSelection,
            model: effectiveSelection,
            providerOverride: undefined,
        };
    }

    const provider = customProviders.find((item) => item.id === providerId);
    if (!provider) {
        return {
            selection: assistantFallbackModel,
            model: assistantFallbackModel,
            providerOverride: undefined,
        };
    }

    return {
        selection: effectiveSelection,
        model: provider.model,
        providerOverride: {
            type: 'openai-compatible' as const,
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: provider.model,
        },
    };
}
