import { describe, expect, it } from "vitest";
import { getAssistantModelCatalog } from "./assistantModelCatalog";

describe("assistantModelCatalog", () => {
  it("includes a dedicated Beeknoee provider group for AI Assistant", () => {
    const groups = getAssistantModelCatalog();
    const beeknoeeGroup = groups.find((group) => group.group === "Beeknoee");

    expect(beeknoeeGroup).toBeDefined();
    expect(beeknoeeGroup?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "beeknoee:glm-4.7-flash",
          label: "GLM 4.7 Flash",
        }),
        expect.objectContaining({
          id: "beeknoee:minimax/minimax-m2.7",
          label: "MiniMax M2.7",
        }),
        expect.objectContaining({
          id: "beeknoee:gemini-3.1-pro-preview",
          label: "Gemini 3.1 Pro (Reasoning)",
        }),
        expect.objectContaining({
          id: "beeknoee:claude-opus-4-6-thinking",
          label: "Claude Opus 4.6 Thinking",
        }),
        expect.objectContaining({
          id: "beeknoee:claude-sonnet-4-6",
          label: "Claude Sonnet 4.6",
        }),
      ]),
    );
  });

  it("does not expose the removed TokenRouter provider group", () => {
    const groups = getAssistantModelCatalog();

    expect(groups.some((group) => group.group === "TokenRouter")).toBe(false);
    expect(
      groups
        .flatMap((group) => group.items)
        .some((item) => item.id.startsWith("tokenrouter:")),
    ).toBe(false);
  });

  it("does not expose retired built-in models", () => {
    const ids = getAssistantModelCatalog().flatMap((group) =>
      group.items.map((item) => item.id),
    );

    expect(ids).toContain("gemini-3.6-flash");
    expect(ids).toContain("groq:openai/gpt-oss-120b");
    expect(ids).toContain("groq:qwen/qwen3.6-27b");
    expect(ids).toContain("groq:groq/compound");
    expect(ids).not.toContain("groq:meta-llama/llama-4-scout-17b-16e-instruct");
    expect(ids).not.toContain("groq:mixtral-8x7b-32768");
    expect(ids).not.toContain("groq:gemma2-9b-it");
    expect(ids).not.toContain("openai/gpt-oss-120b:free");
    expect(ids).not.toContain("openrouter/owl-alpha");
  });
  it('exposes only capabilities wired by the server', () => {
    const models = getAssistantModelCatalog().flatMap((group) => group.items);
    const capabilities = (id: string) =>
      models.find((item) => item.id === id)?.capabilities;

    expect(capabilities('groq:groq/compound')).toEqual(['web']);
    expect(capabilities('groq:qwen/qwen3.6-27b')).toEqual(['vision']);
    expect(capabilities('google/gemma-4-31b-it:free')).toEqual([
      'web',
      'vision',
      'pdf',
    ]);
    expect(capabilities('nvidia/nemotron-3-super-120b-a12b:free')).toEqual([
      'web',
      'pdf',
    ]);
    expect(capabilities('beeknoee:glm-4.7-flash')).toBeUndefined();
  });
});
