export type AiProvider = 'gemini' | 'cerebras' | 'openrouter';
export type AiRoutingMode = 'auto' | 'fast' | 'best' | 'gemini-only';

export interface ChatParams {
    model?: string;
    mode?: string;
    prompt: string;
    schemaContext?: string;
    databaseType?: string;
    image?: string;
    context?: string;
    routingMode?: string;
}

export interface ChatResult {
    message: string;
    sql?: string;
    explanation?: string;
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
