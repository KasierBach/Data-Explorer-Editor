import type { CustomAiProvider } from "@/core/services/aiPreferences";
import { getCustomProviderModelId } from "@/core/services/aiPreferences";

export interface AssistantModelOption {
  id: string;
  label: string;
  isNew?: boolean;
  warning?: boolean;
}

export interface AssistantModelGroup {
  group: string;
  items: AssistantModelOption[];
}

const BUILT_IN_MODEL_GROUPS: AssistantModelGroup[] = [
  {
    group: "Google (Gemini)",
    items: [
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash (Latest)", isNew: true },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", isNew: true },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (High)", isNew: true },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro (Reasoning)",
        isNew: true,
      },
      {
        id: "gemini-3.1-flash-lite",
        label: "Gemini 3.1 Flash Lite (Fast)",
      },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Fast)" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Balanced)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanced)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Fast)" },
    ],
  },
  {
    group: "Beeknoee",
    items: [
      { id: "beeknoee:glm-4.7-flash", label: "GLM 4.7 Flash"},
      {
        id: "beeknoee:minimax/minimax-m2.7",
        label: "MiniMax M2.7",  
      },
      {
        id: "beeknoee:gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro (Reasoning)",
        isNew: true,
      },
      {
        id: "beeknoee:claude-opus-4-6-thinking",
        label: "Claude Opus 4.6 Thinking",
        isNew: true,
      },
      {
        id: "beeknoee:claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        isNew: true,
      },
    ],
  },
  {
    group: "Groq (Fast & Free)",
    items: [
      { id: "groq:openai/gpt-oss-120b", label: "GPT OSS 120B" },
      {
        id: "groq:openai/gpt-oss-20b",
        label: "GPT OSS 20B (Fast)",
      },
      { id: "groq:qwen/qwen3.6-27b", label: "Qwen 3.6 27B (Vision)", isNew: true },
      { id: "groq:groq/compound", label: "Groq Compound (Web)", isNew: true },
      { id: "groq:groq/compound-mini", label: "Groq Compound Mini (Web)" },
    ],
  },
  {
    group: "OpenRouter (Free)",
    items: [
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
      { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        label: "NVIDIA Nemotron 120B",
      },
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b:free",
        label: "NVIDIA Nemotron 3 Ultra 550B",
        isNew: true,
      },
    ],
  },
];

export function getAssistantModelCatalog(
  customProviders: CustomAiProvider[] = [],
): AssistantModelGroup[] {
  const customProviderItems = customProviders
    .map((provider) => ({
      id: getCustomProviderModelId(provider.id),
      label: `${provider.name} (${provider.model})`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return customProviderItems.length > 0
    ? [
        {
          group: "Custom Providers",
          items: customProviderItems,
        },
        ...BUILT_IN_MODEL_GROUPS,
      ]
    : BUILT_IN_MODEL_GROUPS;
}

export function findAssistantModelLabel(
  modelId: string,
  customProviders: CustomAiProvider[] = [],
) {
  const groups = getAssistantModelCatalog(customProviders);
  return (
    groups.flatMap((group) => group.items).find((item) => item.id === modelId)
      ?.label ?? modelId
  );
}
