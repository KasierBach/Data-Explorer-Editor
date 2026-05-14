export type AiProvider = 'gemini' | 'cerebras' | 'openrouter' | 'zhipu' | 'groq';
export type AiRoutingMode = 'auto' | 'fast' | 'best' | 'gemini-only';
export type AiRecommendationType = 'query_fix' | 'index_suggestion' | 'schema_suggestion' | 'chart_suggestion';

export interface AiRecommendation {
    type: AiRecommendationType;
    title: string;
    summary: string;
    sql?: string;
    chartType?: string;
    fields?: string[];
}

export interface ChatParams {
    model?: string;
    mode?: string;
    prompt: string;
    schemaContext?: string;
    databaseType?: string;
    image?: string;
    context?: string;
    routingMode?: string;
    history?: any[];
}

export interface ChatResult {
    message: string;
    sql?: string;
    explanation?: string;
    thought?: string;
    recommendations?: AiRecommendation[];
    provider: AiProvider;
    model: string;
    routingMode: AiRoutingMode;
}

export interface ProviderPlan {
    provider: AiProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
}

export interface RouteDecision {
    preferGemini: boolean;
    complexityScore: number;
    reasons: string[];
}

export interface StreamEvent {
    type: 'chunk' | 'done' | 'error';
    text?: string;
    data?: any;
}
