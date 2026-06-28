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
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (High)", isNew: true },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro (Reasoning)",
        isNew: true,
      },
      {
        id: "gemini-3.1-flash-lite",
        label: "Gemini 3.1 Flash Lite (Fast)",
        isNew: true,
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
      { id: "beeknoee:glm-4.7-flash", label: "GLM 4.7 Flash", isNew: true },
      {
        id: "beeknoee:qwen-3-235b-a22b-instruct-2507",
        label: "Qwen 3 235B A22B Instruct 2507",
        isNew: true,
      },
      {
        id: "beeknoee:minimax/minimax-m2.7",
        label: "MiniMax M2.7",
        isNew: true,
      },
    ],
  },
  {
    group: "Groq (Fast & Free)",
    items: [
      { id: "groq:llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      {
        id: "groq:meta-llama/llama-4-scout-17b-16e-instruct",
        label: "Llama 4 Scout 17B",
        isNew: true,
      },
      { id: "groq:mixtral-8x7b-32768", label: "Mixtral 8x7B" },
      { id: "groq:gemma2-9b-it", label: "Gemma 2 9B" },
      { id: "groq:llama-3.1-8b-instant", label: "Llama 3.1 8B" },
    ],
  },
  {
    group: "OpenRouter (Free)",
    items: [
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
      { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
      {
        id: "deepseek/deepseek-v4-flash:free",
        label: "DeepSeek V4 Flash",
        isNew: true,
      },
      { id: "minimax/minimax-m2.5:free", label: "MiniMax 2.5" },
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        label: "NVIDIA Nemotron 120B",
      },
      { id: "openai/gpt-oss-120b:free", label: "GPT OSS 120B" },
      { id: "z-ai/glm-4.5-air:free", label: "GLM 4.5 Air" },
      {
        id: "openrouter/owl-alpha",
        label: "Owl Alpha (Reasoner)",
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
