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
  contractVersion?: 1;
  generationId?: string;
  sources?: string[];
  usage?: TokenUsage;
  warnings?: string[];
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
  providerId?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  capabilities?: {
    vision?: boolean;
    document?: boolean;
  };
}

export interface AiDocument {
  name: string;
  mimeType: 'application/pdf';
  data: string;
}

export interface AiProviderAttempt {
  attemptId: string;
  complete(result?: {
    provider?: string;
    model?: string;
    usage?: Partial<TokenUsage> | null;
  }): Promise<void>;
  fail(
    outcome?: 'failed' | 'cancelled' | 'timed_out',
    result?: {
      provider?: string;
      model?: string;
      usage?: Partial<TokenUsage> | null;
    },
  ): Promise<void>;
}

export interface AiRequestExecution {
  generationId: string;
  beforeAttempt(plan: {
    provider: string;
    model: string;
  }): Promise<AiProviderAttempt>;
}

export interface ChatParams {
  requestScopeKey?: string;
  execution?: AiRequestExecution;
  beforeProviderAttempt?: (plan: ProviderPlan) => Promise<void>;
  signal?: AbortSignal;
  deadlineAt?: number;
  beforeProviderRequest?: () => Promise<void>;
  model?: string;
  mode?: AiChatMode;
  prompt: string;
  schemaContext?: string;
  databaseType?: string;
  image?: string;
  document?: AiDocument;
  context?: string;
  routingMode?: AiRoutingMode;
  history?: ChatHistoryMessage[];
  providerOverride?: AiProviderOverride;
  disabledProviders?: string[];
  fallbackProvider?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  contractVersion?: 1;
  generationId?: string;
  warnings?: string[];
  message: string;
  sql?: string;
  explanation?: string;
  recommendations?: AiRecommendation[];
  sources?: string[];
  provider: AiProvider;
  providerLabel?: string;
  model: string;
  routingMode: AiRoutingMode;
  usage?: TokenUsage;
}

export interface ProviderPlan {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  displayName?: string;
  capabilities?: {
    vision?: boolean;
    document?: boolean;
  };
}

export interface RouteDecision {
  preferGemini: boolean;
  complexityScore: number;
  reasons: string[];
  needsLiveSearch: boolean;
  responseFormat: AiResponseFormat;
}

export interface StreamDoneData {
  contractVersion?: 1;
  generationId?: string;
  warnings?: string[];
  usage?: TokenUsage;
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
  | {
      type: 'error';
      text: string;
      reason?: 'AI_REQUEST_CANCELLED' | 'AI_REQUEST_TIMEOUT' | 'AI_DISABLED';
    };
