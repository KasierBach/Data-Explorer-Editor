import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from './store';
import {
  AI_PREFERENCES_STORAGE_KEY,
  INHERIT_ASSISTANT_MODEL,
  getCustomProviderModelId,
  readAiPreferences,
  resolveAiSelection,
  writeAiPreferences,
} from "./aiPreferences";

describe("aiPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ isAuthenticated: false, isAuthBootstrapped: false, user: null });
  });

  it('does not treat a legacy local enabled flag as account consent', () => {
    localStorage.setItem(AI_PREFERENCES_STORAGE_KEY, JSON.stringify({ enabled: true }));
    useAppStore.setState({ isAuthenticated: true, isAuthBootstrapped: true, user: { id: 'user-a', email: 'a@example.com', aiEnabled: false } });
    expect(readAiPreferences().enabled).toBe(false);
  });

  it('uses the current authenticated account rather than the previous account enabled flag', () => {
    useAppStore.setState({ isAuthenticated: true, isAuthBootstrapped: true, user: { id: 'user-a', email: 'a@example.com', aiEnabled: true } });
    expect(readAiPreferences().enabled).toBe(true);
    useAppStore.setState({ user: { id: 'user-b', email: 'b@example.com', aiEnabled: false } });
    expect(readAiPreferences().enabled).toBe(false);
    useAppStore.setState({ isAuthenticated: false, user: null });
    expect(readAiPreferences().enabled).toBe(false);
  });

  it('fails closed before account policy hydration', () => {
    useAppStore.setState({ isAuthenticated: true, isAuthBootstrapped: false, user: { id: 'user-a', email: 'a@example.com', aiEnabled: true } });
    expect(readAiPreferences().enabled).toBe(false);
    useAppStore.setState({ isAuthBootstrapped: true, user: { id: 'user-a', email: 'a@example.com' } });
    expect(readAiPreferences().enabled).toBe(false);
  });

  it("drops legacy TokenRouter providers and resets related selections on read", () => {
    localStorage.setItem(
      AI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        assistantModel: "tokenrouter:MiniMax-M3",
        explainModel: "custom-provider:legacy-tokenrouter",
        sqlModel: "tokenrouter:MiniMax-M3",
        nosqlModel: INHERIT_ASSISTANT_MODEL,
        autocompleteModel: "custom-provider:legacy-tokenrouter",
        customProviders: [
          {
            id: "legacy-tokenrouter",
            name: "Legacy TokenRouter",
            type: "openai-compatible",
            baseUrl: "https://api.tokenrouter.com/v1",
            apiKey: "sk-test",
            model: "MiniMax-M3",
          },
        ],
      }),
    );

    expect(readAiPreferences()).toEqual({
      enabled: false,
      disabledProviders: [],
      fallbackProvider: "auto",
      assistantModel: undefined,
      explainModel: INHERIT_ASSISTANT_MODEL,
      sqlModel: INHERIT_ASSISTANT_MODEL,
      nosqlModel: INHERIT_ASSISTANT_MODEL,
      autocompleteModel: INHERIT_ASSISTANT_MODEL,
      customProviders: [],
    });
  });

  it("persists and sanitizes custom fallbackProvider setting", () => {
    writeAiPreferences({
      fallbackProvider: "groq",
    });
    expect(readAiPreferences().fallbackProvider).toBe("groq");

    writeAiPreferences({
      fallbackProvider: "none",
    });
    expect(readAiPreferences().fallbackProvider).toBe("none");
  });

  it("keeps non-TokenRouter custom providers and resolves them normally", () => {
    writeAiPreferences({
      assistantModel: getCustomProviderModelId("provider-1"),
      explainModel: INHERIT_ASSISTANT_MODEL,
      sqlModel: INHERIT_ASSISTANT_MODEL,
      nosqlModel: INHERIT_ASSISTANT_MODEL,
      autocompleteModel: INHERIT_ASSISTANT_MODEL,
      customProviders: [
        {
          id: "provider-1",
          name: "Custom Provider",
          type: "openai-compatible",
          baseUrl: "https://provider.example.com/v1",
          apiKey: "sk-test",
          model: "gpt-oss-120b",
        },
      ],
    });

    const preferences = readAiPreferences();
    const resolved = resolveAiSelection(
      preferences.assistantModel,
      "gemini-2.5-flash",
      preferences.customProviders,
    );

    expect(preferences.customProviders).toHaveLength(1);
    expect(resolved.providerOverride).toEqual({
      type: "openai-compatible",
      name: "Custom Provider",
      baseUrl: "https://provider.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-oss-120b",
    });

    const stored = JSON.parse(
      localStorage.getItem(AI_PREFERENCES_STORAGE_KEY) || "{}",
    );
    expect(stored.customProviders[0].apiKey).toBe("");
  });

  it("scrubs legacy persisted API keys while keeping them for the current tab", () => {
    localStorage.setItem(
      AI_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        customProviders: [
          {
            id: "provider-1",
            name: "Custom Provider",
            type: "openai-compatible",
            baseUrl: "https://provider.example.com/v1",
            apiKey: "sk-legacy-secret",
            model: "gpt-oss-120b",
          },
        ],
      }),
    );

    const preferences = readAiPreferences();
    const stored = JSON.parse(
      localStorage.getItem(AI_PREFERENCES_STORAGE_KEY) || "{}",
    );

    expect(preferences.customProviders[0].apiKey).toBe("sk-legacy-secret");
    expect(stored.customProviders[0].apiKey).toBe("");
  });

  it("routes a server-managed provider by id and selected model", () => {
    const provider = {
      id: "provider-1",
      name: "Custom Provider",
      type: "openai-compatible" as const,
      baseUrl: "https://provider.example.com/v1",
      apiKey: "",
      model: "default-model",
      models: ["default-model", "vision-model"],
      serverManaged: true,
      apiKeyConfigured: true,
    };

    const resolved = resolveAiSelection(
      getCustomProviderModelId(provider.id, "vision-model"),
      "gemini-2.5-flash",
      [provider],
    );

    expect(resolved.providerOverride).toEqual({
      type: "openai-compatible",
      providerId: "provider-1",
      name: "Custom Provider",
      model: "vision-model",
    });
  });
});
