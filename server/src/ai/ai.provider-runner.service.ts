import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import type { AiRoutingMode, ChatParams, ChatResult, ProviderPlan, StreamEvent } from './ai.types';

@Injectable()
export class AiProviderRunnerService {
    private readonly genAI: GoogleGenerativeAI | null;

    constructor(
        private readonly configService: ConfigService,
        private readonly promptBuilder: AiPromptBuilderService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            console.warn('[AiProviderRunnerService] GEMINI_API_KEY not set - Gemini lane disabled');
            this.genAI = null;
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
        }
    }

    isGeminiAvailable(): boolean {
        return !!this.genAI;
    }

    async completeGeminiText(params: {
        model: string;
        prompt: string;
        temperature?: number;
        maxOutputTokens?: number;
    }): Promise<string> {
        if (!this.genAI) {
            throw new Error('Gemini provider is not configured');
        }

        const model = this.genAI.getGenerativeModel({
            model: params.model,
            generationConfig: {
                temperature: params.temperature ?? 0.1,
                maxOutputTokens: params.maxOutputTokens ?? 32,
            },
        });

        const result = await model.generateContent(params.prompt);
        return result.response.text().trim();
    }

    async runGemini(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): Promise<ChatResult> {
        if (!this.genAI) {
            throw new Error('Gemini provider is not configured');
        }

        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });
        const parts = this.promptBuilder.prepareGeminiParts(params.prompt, systemPrompt, params.context, params.image);

        const model = this.genAI.getGenerativeModel({
            model: plan.model,
            tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        });

        const responseText = result.response.text();
        const parsed = this.promptBuilder.parseAiResponse(responseText);
        this.promptBuilder.assertUsableStructuredResponse(parsed, responseText, `Gemini (${plan.model})`);
        const sourcesSuffix = this.promptBuilder.extractSources(result.response);

        return {
            ...parsed,
            message: parsed.message + sourcesSuffix,
            provider: 'gemini',
            model: plan.model,
            routingMode,
        };
    }

    async runOpenAiCompatible(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): Promise<ChatResult> {
        if (!plan.apiKey || !plan.baseUrl) {
            throw new Error(`${plan.provider} provider is not configured`);
        }

        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });

        const response = await fetch(`${plan.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.getOpenAiCompatibleHeaders(plan),
            body: JSON.stringify({
                model: plan.model,
                messages: this.promptBuilder.buildOpenAiMessages(params.prompt, systemPrompt, params.context),
                temperature: 0.7,
                max_tokens: 8192,
            }),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        const text = Array.isArray(content)
            ? content.map((item: any) => item?.text || '').join('')
            : (content || '');
        const parsed = this.promptBuilder.parseAiResponse(text);
        this.promptBuilder.assertUsableStructuredResponse(parsed, text, `${plan.provider} (${plan.model})`);

        return {
            ...parsed,
            provider: plan.provider,
            model: plan.model,
            routingMode,
        };
    }

    async * streamGemini(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): AsyncGenerator<StreamEvent> {
        if (!this.genAI) {
            throw new Error('Gemini provider is not configured');
        }

        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });
        const parts = this.promptBuilder.prepareGeminiParts(params.prompt, systemPrompt, params.context, params.image);

        const model = this.genAI.getGenerativeModel({
            model: plan.model,
            tools: [{ googleSearch: {} } as any],
        });

        const result = await model.generateContentStream({
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        });

        let fullText = '';
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                fullText += chunkText;
                yield { type: 'chunk', text: chunkText };
            }
        }

        const aggregatedResponse = await result.response;
        const parsed = this.promptBuilder.parseAiResponse(fullText);
        this.promptBuilder.assertUsableStructuredResponse(parsed, fullText, `Gemini (${plan.model})`);
        const sourcesSuffix = this.promptBuilder.extractSources(aggregatedResponse);

        yield {
            type: 'done',
            data: {
                ...parsed,
                message: parsed.message + sourcesSuffix,
                provider: 'gemini',
                model: plan.model,
                routingMode,
            },
        };
    }

    async * streamOpenAiCompatible(plan: ProviderPlan, params: ChatParams, routingMode: AiRoutingMode): AsyncGenerator<StreamEvent> {
        if (!plan.apiKey || !plan.baseUrl) {
            throw new Error(`${plan.provider} provider is not configured`);
        }

        const systemPrompt = this.promptBuilder.buildSystemPrompt({
            prompt: params.prompt,
            context: params.context,
            mode: params.mode,
            schemaContext: params.schemaContext,
            databaseType: params.databaseType,
        });

        const response = await fetch(`${plan.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.getOpenAiCompatibleHeaders(plan),
            body: JSON.stringify({
                model: plan.model,
                messages: this.promptBuilder.buildOpenAiMessages(params.prompt, systemPrompt, params.context),
                temperature: 0.7,
                max_tokens: 8192,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error(`${plan.provider} did not return a readable stream`);
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';

            for (const event of events) {
                const line = event
                    .split('\n')
                    .find((entry) => entry.startsWith('data: '));

                if (!line) continue;

                const data = line.slice(6).trim();
                if (!data || data === '[DONE]') continue;

                const payload = JSON.parse(data);
                const deltaText = this.promptBuilder.extractOpenAiStreamText(payload);
                if (deltaText) {
                    fullText += deltaText;
                    yield { type: 'chunk', text: deltaText };
                }
            }
        }

        const parsed = this.promptBuilder.parseAiResponse(fullText);
        this.promptBuilder.assertUsableStructuredResponse(parsed, fullText, `${plan.provider} (${plan.model})`);
        yield {
            type: 'done',
            data: {
                ...parsed,
                provider: plan.provider,
                model: plan.model,
                routingMode,
            },
        };
    }

    private getOpenAiCompatibleHeaders(plan: ProviderPlan): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${plan.apiKey}`,
        };

        if (plan.provider === 'openrouter') {
            headers['HTTP-Referer'] = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
            headers['X-Title'] = 'Data Explorer';
        }

        return headers;
    }
}
