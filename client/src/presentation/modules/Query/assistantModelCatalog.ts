import type { CustomAiProvider } from "@/core/services/aiPreferences";
import {
  CUSTOM_PROVIDER_MODEL_PREFIX,
  getCustomProviderModelId,
} from "@/core/services/aiPreferences";

export type AssistantModelCapability = "web" | "vision" | "pdf";

const ALL_CAPABILITIES = ["web", "vision", "pdf"] as const;
const VISION = ["vision"] as const;
const WEB = ["web"] as const;
const WEB_AND_PDF = ["web", "pdf"] as const;

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
  | "gemini"
  | "openrouter"
  | "groq"
  | "beeknoee";

const BUILT_IN_MODEL_GROUPS: AssistantModelGroup[] = [
  {
    group: "Google (Gemini)",
    items: [
      {
        id: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash (Latest)",
        isNew: true,
      },
      {
        id: "gemini-3.6-flash",
        label: "Gemini 3.6 Flash (Fast)",
        isNew: true,
      },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash (High)", isNew: true },
      {
        id: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash Lite",
        isNew: true,
      },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro (Reasoning)",
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
      { id: "beeknoee:bee/gemini-3.8-flash", label: "Gemini 3.8 Flash (Bee)", isNew: true, },
      { id: "beeknoee:bee/gemini-3.6-flash", label: "Gemini 3.6 Flash (Bee)", isNew: true, },
      { id: "beeknoee:bee-tok/gemini-3.6-flash", label: "Gemini 3.6 Flash (Bee Token)", isNew: true, },
      { id: "beeknoee:gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Reasoning)" },

      { id: "beeknoee:claude-opus-4-6-thinking", label: "Claude Opus 4.6 Thinking" },
      { id: "beeknoee:claude-sonnet-4-6", label: "Claude Sonnet 4.6" },

      { id: "beeknoee:minimax/minimax-m2.7", label: "MiniMax M2.7" },
      { id: "beeknoee:glm-4.7-flash", label: "GLM 4.7 Flash" },    
    ],
  },
  {
    group: "Groq (Fast & Free)",
    items: [
      { id: "groq:groq/compound", label: "Groq Compound (Web)" },
      { id: "groq:openai/gpt-oss-120b", label: "GPT OSS 120B" },
      {
        id: "groq:qwen/qwen3.6-27b",
        label: "Qwen 3.6 27B (Vision)",
      },
      { id: "groq:groq/compound-mini", label: "Groq Compound Mini (Web)" },
      {
        id: "groq:openai/gpt-oss-20b",
        label: "GPT OSS 20B (Fast)",
      },
    ],
  },
  {
    group: "OpenRouter (Free)",
    items: [
      {
        id: "nvidia/nemotron-3-ultra-550b-a55b:free",
        label: "NVIDIA Nemotron 3 Ultra 550B",
        isNew: true,
      },
      {
        id: "minimax/minimax-m3:free",
        label: "MiniMax M3",
        isNew: true,
      },
      {
        id: "z-ai/glm-5.2:free",
        label: "GLM 5.2",
        isNew: true,
      },
      {
        id: "minimax/minimax-m2.7:free",
        label: "MiniMax M2.7",
        isNew: true,
      },
      {
        id: "nvidia/nemotron-3-super-120b-a12b:free",
        label: "NVIDIA Nemotron 120B",
      },
      {
        id: "nvidia/nemotron-3.5-lightning:free",
        label: "NVIDIA Nemotron 3.5 Lightning",
      },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
      { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B" },
      {
        id: "inclusionai/ling-3.0-flash-fin:free",
        label: "Ling 3.0 Flash Fin",
      },
      {
        id: "poolside/laguna-s-2.1:free",
        label: "Poolside Laguna S 2.1",
      },
      {
        id: "thinkingmachines/inkling:free",
        label: "ThinkingMachines Inkling",
      },
      {
        id: "poolside/laguna-xs-2.1:free",
        label: "Poolside Laguna XS 2.1",
      },
      {
        id: "cohere/north-mini-code:free",
        label: "Cohere North Mini Code",
      },
    ],
  },
];

function getBuiltInCapabilities(modelId: string) {
  if (modelId.startsWith("gemini-")) return ALL_CAPABILITIES;
  if (modelId.startsWith("beeknoee:")) {
    return /^beeknoee:(?:minimax\/|gemini-|bee(?:-tok)?\/gemini-|claude-)/i.test(modelId)
      ? VISION
      : undefined;
  }
  if (/^groq:groq\/compound(?:-mini)?$/i.test(modelId)) return WEB;
  if (modelId === "groq:qwen/qwen3.6-27b") return VISION;
  if (/gemma-4/i.test(modelId)) return ALL_CAPABILITIES;
  if (modelId === "minimax/minimax-m3:free") {
    return ["web", "vision", "pdf"] as const;
  }
  if (modelId.includes("/") && modelId.endsWith(":free")) return WEB_AND_PDF;
  return undefined;
}

export interface BuiltInProviderConfig {
  id: AssistantBuiltInProvider;
  name: string;
  groupName: string;
  description: string;
}

export const BUILT_IN_PROVIDERS: BuiltInProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    groupName: "Google (Gemini)",
    description: "Gemini 3.8 Flash, 3.6 Flash, 3.5 Flash, 3.1 Pro reasoning & Flash Lite",
  },
  {
    id: "beeknoee",
    name: "Beeknoee",
    groupName: "Beeknoee",
    description: "Gemini 3.8/3.6 Flash Bee, GLM 4.7, MiniMax M2.7 & Claude 4.6",
  },
  {
    id: "groq",
    name: "Groq (Fast & Free)",
    groupName: "Groq (Fast & Free)",
    description: "GPT OSS 120B/20B, Qwen 3.6 27B Vision & Groq Compound Web",
  },
  {
    id: "openrouter",
    name: "OpenRouter (Free)",
    groupName: "OpenRouter (Free)",
    description: "Laguna 2.1, Nemotron 3/3.5, North Mini Code, MiniMax M3 & Gemma 4",
  },
];

export function getAssistantModelCatalog(
  customProviders: CustomAiProvider[] = [],
  disabledProviders: string[] = [],
): AssistantModelGroup[] {
  const builtInGroups = BUILT_IN_MODEL_GROUPS
    .filter((group) => {
      if (group.group === "Google (Gemini)" && disabledProviders.includes("gemini")) return false;
      if (group.group === "Beeknoee" && disabledProviders.includes("beeknoee")) return false;
      if (group.group === "Groq (Fast & Free)" && disabledProviders.includes("groq")) return false;
      if (group.group === "OpenRouter (Free)" && disabledProviders.includes("openrouter")) return false;
      return true;
    })
    .map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        capabilities: getBuiltInCapabilities(item.id),
      })),
    }));
  const customProviderItems = customProviders
    .filter((provider) => provider.enabled !== false)
    .flatMap((provider) =>
      Array.from(new Set([provider.model, ...(provider.models || [])]))
        .filter(Boolean)
        .map((model) => ({
          id: getCustomProviderModelId(provider.id, model),
          label: `${provider.name} (${model})`,
          capabilities: [
            ...(provider.capabilities?.vision ? ["vision" as const] : []),
            ...(provider.capabilities?.document ? ["pdf" as const] : []),
          ],
        })),
    )
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
  if (modelId.startsWith("gemini-")) return "gemini";
  if (modelId.startsWith("beeknoee:")) return "beeknoee";
  if (modelId.startsWith("groq:")) return "groq";
  if (modelId.includes("/") || modelId.includes(":")) return "openrouter";
  return null;
}
