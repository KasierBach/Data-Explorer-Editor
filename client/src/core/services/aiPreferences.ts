import { useSyncExternalStore } from "react";

export const AI_PREFERENCES_STORAGE_KEY = "data-explorer-ai-preferences-v1";
export const INHERIT_ASSISTANT_MODEL = "__assistant__";
export const CUSTOM_PROVIDER_MODEL_PREFIX = "custom-provider:";
const CUSTOM_PROVIDER_MODEL_SEPARATOR = "::";
export const AI_PREFERENCES_EVENT = "data-explorer-ai-preferences-changed";

const LEGACY_TOKENROUTER_MODEL_PREFIX = "tokenrouter:";
const TOKENROUTER_BASE_URL_PATTERN = /tokenrouter\.com/i;

export type CustomAiProviderType = "openai-compatible";

export interface CustomAiProvider {
  id: string;
  name: string;
  type: CustomAiProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
  serverManaged?: boolean;
  apiKeyConfigured?: boolean;
  capabilities?: {
    vision?: boolean;
    document?: boolean;
  };
  lastTestedAt?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
  lastLatencyMs?: number | null;
}

export interface ClientAiProviderOverride {
  type: CustomAiProviderType;
  providerId?: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  capabilities?: CustomAiProvider["capabilities"];
}

export interface AiPreferences {
  assistantModel?: string;
  explainModel: string;
  sqlModel: string;
  nosqlModel: string;
  autocompleteModel: string;
  customProviders: CustomAiProvider[];
}

const DEFAULT_AI_PREFERENCES: AiPreferences = {
  assistantModel: undefined,
  explainModel: INHERIT_ASSISTANT_MODEL,
  sqlModel: INHERIT_ASSISTANT_MODEL,
  nosqlModel: INHERIT_ASSISTANT_MODEL,
  autocompleteModel: INHERIT_ASSISTANT_MODEL,
  customProviders: [],
};

let cachedPreferencesRaw: string | null | undefined;
let cachedPreferencesSnapshot: AiPreferences = DEFAULT_AI_PREFERENCES;

function isCustomProvider(value: unknown): value is CustomAiProvider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<CustomAiProvider>;
  return (
    typeof provider.id === "string" &&
    typeof provider.name === "string" &&
    typeof provider.baseUrl === "string" &&
    typeof provider.apiKey === "string" &&
    typeof provider.model === "string"
  );
}

function isLegacyTokenRouterSelection(value: string) {
  return value.startsWith(LEGACY_TOKENROUTER_MODEL_PREFIX);
}

function isTokenRouterProvider(provider: Pick<CustomAiProvider, "baseUrl">) {
  return TOKENROUTER_BASE_URL_PATTERN.test(provider.baseUrl);
}

function sanitizeModelSelection(
  value: unknown,
  fallback: string | undefined,
  validProviderIds: Set<string>,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed || isLegacyTokenRouterSelection(trimmed)) {
    return fallback;
  }

  const providerId = parseCustomProviderModelId(trimmed);
  if (providerId && !validProviderIds.has(providerId)) {
    return fallback;
  }

  return trimmed;
}

function sanitizePreferences(value: unknown): AiPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_AI_PREFERENCES;
  }

  const input = value as Partial<AiPreferences>;
  const customProviders = Array.isArray(input.customProviders)
    ? input.customProviders
        .filter(isCustomProvider)
        .map((provider) => ({
          ...provider,
          type: "openai-compatible" as const,
          name: provider.name.trim(),
          baseUrl: provider.baseUrl.trim(),
          apiKey: provider.apiKey.trim(),
          model: provider.model.trim(),
          models: Array.isArray(provider.models)
            ? provider.models.filter((model) => typeof model === "string")
            : undefined,
        }))
        .filter(
          (provider) =>
            provider.name &&
            provider.baseUrl &&
            provider.model &&
            !isTokenRouterProvider(provider),
        )
    : [];

  const validProviderIds = new Set(
    customProviders.map((provider) => provider.id),
  );

  return {
    assistantModel: sanitizeModelSelection(
      input.assistantModel,
      undefined,
      validProviderIds,
    ),
    explainModel:
      sanitizeModelSelection(
        input.explainModel,
        INHERIT_ASSISTANT_MODEL,
        validProviderIds,
      ) ?? INHERIT_ASSISTANT_MODEL,
    sqlModel:
      sanitizeModelSelection(
        input.sqlModel,
        INHERIT_ASSISTANT_MODEL,
        validProviderIds,
      ) ?? INHERIT_ASSISTANT_MODEL,
    nosqlModel:
      sanitizeModelSelection(
        input.nosqlModel,
        INHERIT_ASSISTANT_MODEL,
        validProviderIds,
      ) ?? INHERIT_ASSISTANT_MODEL,
    autocompleteModel:
      sanitizeModelSelection(
        input.autocompleteModel,
        INHERIT_ASSISTANT_MODEL,
        validProviderIds,
      ) ?? INHERIT_ASSISTANT_MODEL,
    customProviders,
  };
}

function serializePreferences(preferences: AiPreferences) {
  return JSON.stringify({
    ...preferences,
    customProviders: preferences.customProviders.map((provider) => ({
      ...provider,
      apiKey: "",
    })),
  });
}

function emitPreferencesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_PREFERENCES_EVENT));
}

export function getCustomProviderModelId(providerId: string, model?: string) {
  return model
    ? `${CUSTOM_PROVIDER_MODEL_PREFIX}${providerId}${CUSTOM_PROVIDER_MODEL_SEPARATOR}${encodeURIComponent(model)}`
    : `${CUSTOM_PROVIDER_MODEL_PREFIX}${providerId}`;
}

function parseCustomProviderSelection(value?: string | null) {
  if (!value || !value.startsWith(CUSTOM_PROVIDER_MODEL_PREFIX)) {
    return null;
  }
  const raw = value.slice(CUSTOM_PROVIDER_MODEL_PREFIX.length);
  const separatorIndex = raw.indexOf(CUSTOM_PROVIDER_MODEL_SEPARATOR);
  if (separatorIndex < 0) {
    return raw ? { providerId: raw, model: undefined } : null;
  }
  const providerId = raw.slice(0, separatorIndex);
  const encodedModel = raw.slice(
    separatorIndex + CUSTOM_PROVIDER_MODEL_SEPARATOR.length,
  );
  if (!providerId) return null;
  try {
    return {
      providerId,
      model: encodedModel ? decodeURIComponent(encodedModel) : undefined,
    };
  } catch {
    return { providerId, model: undefined };
  }
}

export function parseCustomProviderModelId(value?: string | null) {
  return parseCustomProviderSelection(value)?.providerId || null;
}

export function readAiPreferences(): AiPreferences {
  if (typeof window === "undefined") {
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
    const persistedRaw = serializePreferences(snapshot);
    if (raw !== persistedRaw) {
      window.localStorage.setItem(AI_PREFERENCES_STORAGE_KEY, persistedRaw);
    }

    cachedPreferencesRaw = persistedRaw;
    cachedPreferencesSnapshot = snapshot;
    return snapshot;
  } catch {
    window.localStorage.removeItem(AI_PREFERENCES_STORAGE_KEY);
    cachedPreferencesRaw = null;
    cachedPreferencesSnapshot = DEFAULT_AI_PREFERENCES;
    return DEFAULT_AI_PREFERENCES;
  }
}

export function writeAiPreferences(next: AiPreferences) {
  if (typeof window === "undefined") return;

  const sanitized = sanitizePreferences(next);
  const raw = serializePreferences(sanitized);
  cachedPreferencesRaw = raw;
  cachedPreferencesSnapshot = sanitized;
  window.localStorage.setItem(AI_PREFERENCES_STORAGE_KEY, raw);
  emitPreferencesChanged();
}

export function updateAiPreferences(
  updater: (current: AiPreferences) => AiPreferences,
) {
  const current = readAiPreferences();
  writeAiPreferences(updater(current));
}

export function subscribeAiPreferences(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onChange = () => listener();
  window.addEventListener(AI_PREFERENCES_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(AI_PREFERENCES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
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
  const effectiveSelection =
    !selection || selection === INHERIT_ASSISTANT_MODEL
      ? assistantFallbackModel
      : selection;
  const customSelection = parseCustomProviderSelection(effectiveSelection);
  const providerId = customSelection?.providerId;

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
    model: customSelection?.model || provider.model,
    providerOverride: {
      type: "openai-compatible" as const,
      ...(provider.serverManaged
        ? { providerId: provider.id }
        : {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            capabilities: provider.capabilities,
          }),
      name: provider.name,
      model: customSelection?.model || provider.model,
    },
  };
}
