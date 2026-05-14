import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AI_CONSTANTS } from './ai.constants';
import type { AiRoutingMode, ChatParams, ChatResult, ProviderPlan, StreamEvent } from './ai.types';

@Injectable()
export class AiProviderRunnerService {
    private readonly genAI: GoogleGenerativeAI | null;
    private readonly logger = new Logger(AiProviderRunnerService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly promptBuilder: AiPromptBuilderService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not set - Gemini lane disabled');
            this.genAI = null;
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    isGeminiAvailable(): boolean {
        return !!this.genAI;
    }

    private getProviderTimeoutMs(): number {
        const raw = Number(this.configService.get<string>('AI_PROVIDER_TIMEOUT_MS') || AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS);
        return Number.isFinite(raw) && raw > 0 ? raw : AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS;
    }

    private getStreamIdleTimeoutMs(): number {
        const raw = Number(this.configService.get<string>('AI_STREAM_IDLE_TIMEOUT_MS') || this.getProviderTimeoutMs());
        return Number.isFinite(raw) && raw > 0 ? raw : this.getProviderTimeoutMs();
    }

    private async withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = this.getProviderTimeoutMs()): Promise<T> {
        let timer: NodeJS.Timeout | null = null;
        try {
            return await Promise.race<T>([
                promise,
                new Promise<T>((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    private createAbortController(label: string, timeoutMs = this.getProviderTimeoutMs()) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        return {
            signal: controller.signal,
            clear: () => clearTimeout(timer),
        };
    }

    private async readWithTimeout<T>(
        reader: ReadableStreamDefaultReader<T>,
        label: string,
        timeoutMs = this.getStreamIdleTimeoutMs(),
    ): Promise<ReadableStreamReadResult<T>> {
        let timer: NodeJS.Timeout | null = null;
        try {
            return await Promise.race<ReadableStreamReadResult<T>>([
                reader.read(),
                new Promise<ReadableStreamReadResult<T>>((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`${label} stalled after ${timeoutMs}ms`)), timeoutMs);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async completeGeminiText(params: {
        model: string;
        prompt: string;
        temperature?: number;
        maxOutputTokens?: number;
        timeoutMs?: number;
    }): Promise<string> {
        if (!this.genAI) throw new Error('Gemini provider is not configured');
        
        const tryCompletion = async (mId: string) => {
            const model = this.genAI!.getGenerativeModel({
                model: mId,
                generationConfig: {
                    temperature: params.temperature ?? AI_CONSTANTS.TEMPERATURE_PRECISE,
                    maxOutputTokens: params.maxOutputTokens ?? AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
                },
            });
            const timeout = params.timeoutMs ?? this.getProviderTimeoutMs();
            const result = await this.withTimeout(model.generateContent(params.prompt), `Gemini completion (${mId})`, timeout);
            return result.response.text().trim();
        };

        try {
            return await tryCompletion(params.model);
        } catch (error: any) {
            // If the requested model (like 3.1) doesn't exist, fallback to 1.5-flash-latest for stability
            if (error?.message?.includes('404') || error?.message?.includes('not found')) {
                this.logger.warn(`Model ${params.model} not found. Falling back to gemini-1.5-flash-latest...`);
                return await tryCompletion('gemini-1.5-flash-latest');
            }
            throw error;
        }
    }

    async completeOpenAiCompatibleText(
        plan: ProviderPlan,
        params: {
            systemPrompt: string;
            prompt: string;
            context?: string;
            temperature?: number;
            maxOutputTokens?: number;
            history?: any[];
            timeoutMs?: number;
        },
    ): Promise<string> {
        if (!plan.apiKey || !plan.baseUrl) throw new Error(`${plan.provider} provider is not configured`);

        const requestTimeout = this.createAbortController(`${plan.provider} completion`, params.timeoutMs ?? this.getProviderTimeoutMs());

        try {
            const response = await fetch(`${plan.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getOpenAiCompatibleHeaders(plan),
                body: JSON.stringify({
                    model: plan.model,
                    messages: this.promptBuilder.buildOpenAiMessages(params.prompt, params.systemPrompt, params.context, params.history),
                    temperature: params.temperature ?? AI_CONSTANTS.TEMPERATURE_PRECISE,
                    max_tokens: params.maxOutputTokens ?? AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
                }),
                signal: requestTimeout.signal,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`${plan.provider} completion error (${response.status}): ${error.error?.message || response.statusText}`);
            }

            const result = await response.json();
            const content = result.choices?.[0]?.message?.content;
            if (typeof content !== 'string') {
                return '';
            }

            return content.trim();
        } finally {
            requestTimeout.clear();
        }
    }

    async runGemini(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): Promise<ChatResult> {
        if (!this.genAI) throw new Error('Gemini provider is not configured');
        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });
        const parts = this.promptBuilder.prepareGeminiParts(params.prompt, params.context, params.image);
        const model = this.genAI.getGenerativeModel({
            model: plan.model,
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} } as Record<string, unknown>],
        });
        const result = await this.withTimeout(
            model.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                    maxOutputTokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
                },
            }),
            `Gemini request (${plan.model})`,
        );
        const responseText = result.response.text();
        const parsed = this.promptBuilder.parseAiResponse(responseText);
        const sourcesSuffix = this.promptBuilder.extractSources(result.response);
        return { ...parsed, message: parsed.message + sourcesSuffix, provider: 'gemini', model: plan.model, routingMode };
    }

    async runOpenAiCompatible(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): Promise<ChatResult> {
        if (!plan.apiKey || !plan.baseUrl) throw new Error(`${plan.provider} provider is not configured`);
        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });

        const needsSearch = /\b(search|news|latest|current|today|hôm nay|mới nhất|tin tức)\b/i.test(params.prompt);
        let modelToUse = plan.model;
        if (needsSearch && plan.provider === 'openrouter' && !modelToUse.endsWith(':online')) {
            modelToUse = `${modelToUse}:online`;
        }

        const finalPrompt = needsSearch ? `[SEARCH ONLINE] ${params.prompt}` : params.prompt;
        const requestTimeout = this.createAbortController(`${plan.provider} request (${modelToUse})`);
        
        try {
            let response = await fetch(`${plan.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getOpenAiCompatibleHeaders(plan),
                body: JSON.stringify({
                    model: modelToUse,
                    messages: this.promptBuilder.buildOpenAiMessages(finalPrompt, systemPrompt, params.context, params.history),
                    temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                    max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
                }),
                signal: requestTimeout.signal,
            });

            if (!response.ok && modelToUse.endsWith(':online') && (response.status === 402 || response.status === 400 || response.status === 404)) {
                this.logger.warn(`Model ${modelToUse} failed. Retrying without search...`);
                modelToUse = modelToUse.replace(':online', '');
                response = await fetch(`${plan.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: this.getOpenAiCompatibleHeaders(plan),
                    body: JSON.stringify({
                        model: modelToUse,
                        messages: this.promptBuilder.buildOpenAiMessages(params.prompt, systemPrompt, params.context, params.history),
                        temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                        max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
                    }),
                    signal: requestTimeout.signal,
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`${plan.provider} error (${response.status}): ${error.error?.message || response.statusText}`);
            }

            const result = await response.json();
            const responseText = result.choices?.[0]?.message?.content || '';
            const parsed = this.promptBuilder.parseAiResponse(responseText);
            return { ...parsed, provider: plan.provider, model: modelToUse, routingMode };
        } finally {
            requestTimeout.clear();
        }
    }

    async * streamGemini(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): AsyncGenerator<StreamEvent> {
        if (!this.genAI) throw new Error('Gemini provider is not configured');
        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });

        const model = this.genAI.getGenerativeModel({
            model: plan.model,
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} } as Record<string, unknown>],
        });

        const result = await this.withTimeout(
            model.generateContentStream({
                contents: this.promptBuilder.buildGeminiContents(params.prompt, params.context, params.history, params.image),
                generationConfig: { temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE, maxOutputTokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS },
            }),
            `Gemini stream bootstrap (${plan.model})`,
        );

        let fullText = '';
        const iterator = result.stream[Symbol.asyncIterator]();
        while (true) {
            const nextChunk = await this.withTimeout(iterator.next(), `Gemini stream (${plan.model})`, this.getStreamIdleTimeoutMs());
            if (nextChunk.done) break;
            const chunkText = nextChunk.value.text();
            if (chunkText) {
                fullText += chunkText;
                yield { type: 'chunk', text: chunkText };
            }
        }

        const aggregatedResponse = await this.withTimeout(result.response, `Gemini stream finalize (${plan.model})`);
        const parsed = this.promptBuilder.parseAiResponse(fullText);
        const sourcesSuffix = this.promptBuilder.extractSources(aggregatedResponse);
        yield { type: 'done', data: { ...parsed, message: parsed.message + sourcesSuffix, provider: 'gemini', model: plan.model, routingMode } };
    }

    async * streamOpenAiCompatible(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): AsyncGenerator<StreamEvent> {
        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });

        const needsSearch = /\b(search|news|latest|current|today|hôm nay|mới nhất|tin tức)\b/i.test(params.prompt);
        let modelToUse = plan.model;
        if (needsSearch && plan.provider === 'openrouter' && !modelToUse.endsWith(':online')) {
            modelToUse = `${modelToUse}:online`;
        }

        const finalPrompt = needsSearch ? `[SEARCH ONLINE] ${params.prompt}` : params.prompt;
        const requestTimeout = this.createAbortController(`${plan.provider} stream request (${modelToUse})`);

        try {
            let response = await fetch(`${plan.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getOpenAiCompatibleHeaders(plan),
                body: JSON.stringify({
                    model: modelToUse,
                    messages: this.promptBuilder.buildOpenAiMessages(finalPrompt, systemPrompt, params.context, params.history),
                    temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                    max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
                    stream: true,
                }),
                signal: requestTimeout.signal,
            });

            if (!response.ok && modelToUse.endsWith(':online') && (response.status === 402 || response.status === 400 || response.status === 404)) {
                this.logger.warn(`Model ${modelToUse} failed. Retrying without search...`);
                modelToUse = modelToUse.replace(':online', '');
                response = await fetch(`${plan.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: this.getOpenAiCompatibleHeaders(plan),
                    body: JSON.stringify({
                        model: modelToUse,
                        messages: this.promptBuilder.buildOpenAiMessages(params.prompt, systemPrompt, params.context, params.history),
                        temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                        max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
                        stream: true,
                    }),
                    signal: requestTimeout.signal,
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`${plan.provider} Stream API error [${response.status}]: ${JSON.stringify(error)}`);
            }

            yield* this.streamFetch(response, requestTimeout, modelToUse, plan.provider, routingMode);
        } finally {
            requestTimeout.clear();
        }
    }

    private async * streamFetch(response: Response, abortController: { clear: () => void; signal: AbortSignal }, model: string, provider: string, routingMode: AiRoutingMode): AsyncGenerator<StreamEvent> {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');
        const decoder = new TextDecoder();
        let fullText = '';
        try {
            while (true) {
                const { done, value } = await this.readWithTimeout(reader, `${provider} stream chunk`);
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed.choices?.[0]?.delta?.content || '';
                            if (text) {
                                fullText += text;
                                yield { type: 'chunk', text };
                            }
                        } catch { /* skip invalid JSON */ }
                    }
                }
            }
            const parsed = this.promptBuilder.parseAiResponse(fullText);
            yield { type: 'done', data: { ...parsed, provider, model, routingMode } };
        } finally {
            reader.releaseLock();
        }
    }

    private getOpenAiCompatibleHeaders(plan: ProviderPlan): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        // Some local providers (e.g. Ollama) don't require an Authorization header
        if (plan.apiKey && plan.apiKey !== 'no-key') {
            headers['Authorization'] = `Bearer ${plan.apiKey}`;
        }
        if (plan.provider === 'openrouter') {
            headers['HTTP-Referer'] = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
            headers['X-Title'] = 'Data Explorer';
        }
        return headers;
    }
}
