import { beforeEach, describe, expect, it } from "vitest";
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
      assistantModel: undefined,
      explainModel: INHERIT_ASSISTANT_MODEL,
      sqlModel: INHERIT_ASSISTANT_MODEL,
      nosqlModel: INHERIT_ASSISTANT_MODEL,
      autocompleteModel: INHERIT_ASSISTANT_MODEL,
      customProviders: [],
    });
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
  });
});
