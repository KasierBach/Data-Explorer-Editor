import type { CustomAiProvider } from "@/core/services/aiPreferences";
import {
  CUSTOM_PROVIDER_MODEL_PREFIX,
  getCustomProviderModelId,
} from "@/core/services/aiPreferences";

export type AssistantModelCapability = 'web' | 'vision' | 'pdf';

const ALL_CAPABILITIES = ['web', 'vision', 'pdf'] as const;
const VISION = ['vision'] as const;
const WEB = ['web'] as const;
const WEB_AND_PDF = ['web', 'pdf'] as const;

export interface AssistantModelOption {
  id: string;
  label: string;
  isNew?: boolean;
  warning?: boolean;
  capabilities?: readonly AssistantModelCapability[];
}

export interface AssistantModelGroup {
  group: string;
  items: AssistantModelOption[];
}

export type AssistantBuiltInProvider =
  | 'gemini'
  | 'openrouter'
  | 'groq'
  | 'beeknoee';

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

function getBuiltInCapabilities(modelId: string) {
  if (modelId.startsWith('gemini-')) return ALL_CAPABILITIES;
  if (modelId.startsWith('beeknoee:')) {
    return /^beeknoee:(?:minimax\/|gemini-|claude-)/i.test(modelId)
      ? VISION
      : undefined;
  }
  if (/^groq:groq\/compound(?:-mini)?$/i.test(modelId)) return WEB;
  if (modelId === 'groq:qwen/qwen3.6-27b') return VISION;
  if (/gemma-4/i.test(modelId)) return ALL_CAPABILITIES;
  if (modelId.includes('/') && modelId.endsWith(':free')) return WEB_AND_PDF;
  return undefined;
}

export function getAssistantModelCatalog(
  customProviders: CustomAiProvider[] = [],
): AssistantModelGroup[] {
  const builtInGroups = BUILT_IN_MODEL_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      capabilities: getBuiltInCapabilities(item.id),
    })),
  }));
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
        ...builtInGroups,
      ]
    : builtInGroups;
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

export function getAssistantModelProvider(
  modelId: string,
): AssistantBuiltInProvider | null {
  if (modelId.startsWith(CUSTOM_PROVIDER_MODEL_PREFIX)) return null;
  if (modelId.startsWith('gemini-')) return 'gemini';
  if (modelId.startsWith('beeknoee:')) return 'beeknoee';
  if (modelId.startsWith('groq:')) return 'groq';
  if (modelId.includes('/') || modelId.includes(':')) return 'openrouter';
  return null;
}
