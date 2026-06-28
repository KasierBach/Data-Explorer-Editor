export type AiProvider =
  | 'gemini'
  | 'cerebras'
  | 'openrouter'
  | 'beeknoee'
  | 'zhipu'
  | 'groq'
  | 'custom';
export type AiChatRole = 'user' | 'ai';
export type AiChatMode = 'planning' | 'fast';
export type AiRoutingMode = 'auto' | 'fast' | 'best' | 'gemini-only';
export type AiResponseFormat = 'chat' | 'structured';
export type AiRecommendationType =
  | 'query_fix'
  | 'index_suggestion'
  | 'schema_suggestion'
  | 'chart_suggestion';

export interface AiRecommendation {
  type: AiRecommendationType;
  title: string;
  summary: string;
  sql?: string;
  chartType?: string;
  fields?: string[];
}

export interface ChatHistoryMessage {
  role: AiChatRole;
  content: string;
}

export interface AiMessageModelInfo {
  provider?: AiProvider;
  providerLabel?: string;
  model?: string;
  routingMode?: AiRoutingMode;
}

export interface AiMessageAttachment {
  type: string;
  label: string;
  preview?: string;
  data?: string;
}

export interface AiMessagePayloadEnvelope {
  items?: AiMessageAttachment[];
  modelInfo?: AiMessageModelInfo;
  recommendations?: AiRecommendation[];
}

export interface AiPromptCapabilities {
  liveWebSearch?: boolean;
  citations?: boolean;
  visionInput?: boolean;
}

export type PersistedAiMessagePayload =
  | AiMessageAttachment[]
  | AiMessagePayloadEnvelope;

export interface AiProviderOverride {
  type: 'openai-compatible';
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface ChatParams {
  model?: string;
  mode?: AiChatMode;
  prompt: string;
  schemaContext?: string;
  databaseType?: string;
  image?: string;
  context?: string;
  routingMode?: AiRoutingMode;
  history?: ChatHistoryMessage[];
  providerOverride?: AiProviderOverride;
}

export interface ChatResult {
  message: string;
  sql?: string;
  explanation?: string;
  recommendations?: AiRecommendation[];
  sources?: string[];
  provider: AiProvider;
  providerLabel?: string;
  model: string;
  routingMode: AiRoutingMode;
}

export interface ProviderPlan {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  displayName?: string;
}

export interface RouteDecision {
  preferGemini: boolean;
  complexityScore: number;
  reasons: string[];
  needsLiveSearch: boolean;
  responseFormat: AiResponseFormat;
}

export interface StreamDoneData {
  message: string;
  sql?: string;
  explanation?: string;
  recommendations?: AiRecommendation[];
  sources?: string[];
  provider: AiProvider;
  providerLabel?: string;
  model: string;
  routingMode: AiRoutingMode;
}

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; data: StreamDoneData }
  | { type: 'error'; text: string };
