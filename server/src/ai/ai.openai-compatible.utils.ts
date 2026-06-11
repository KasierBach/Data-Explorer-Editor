import { AI_CONSTANTS } from './ai.constants';
import type { ProviderPlan } from './ai.types';

export function isTransientOpenAiStatus(status: number): boolean {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

export function isRetryableTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket hang up')
  );
}

export function getRetryDelayMs(attempt: number): number {
  return (
    AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readProviderErrorPayload(
  response: Response,
): Promise<unknown> {
  const candidate = response as Response & {
    clone?: () => Response;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };
  const jsonSource =
    typeof candidate.clone === 'function' ? candidate.clone() : candidate;
  const jsonPayload =
    typeof jsonSource.json === 'function'
      ? await jsonSource.json().catch(() => undefined)
      : undefined;
  if (jsonPayload !== undefined) {
    return jsonPayload;
  }

  const textSource =
    typeof candidate.clone === 'function' ? candidate.clone() : candidate;
  const textPayload =
    typeof textSource.text === 'function'
      ? await textSource.text().catch(() => '')
      : '';
  return textPayload ? { error: { message: textPayload } } : {};
}

export function extractProviderErrorMessage(errorPayload: unknown): string {
  if (typeof errorPayload === 'string') {
    return errorPayload;
  }
  if (typeof errorPayload !== 'object' || errorPayload === null) {
    return '';
  }

  const candidate = errorPayload as {
    error?: { message?: string };
    message?: string;
  };
  if (typeof candidate.error?.message === 'string') {
    return candidate.error.message;
  }
  if (typeof candidate.message === 'string') {
    return candidate.message;
  }
  return '';
}

export function shouldRetryWithoutStructuredOutput(
  response: Response,
  errorPayload: unknown,
): boolean {
  if (![400, 404, 415, 422].includes(response.status)) {
    return false;
  }

  const message = extractProviderErrorMessage(errorPayload).toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('structured output') ||
    message.includes('response schema') ||
    message.includes('responseschema') ||
    message.includes('response mime') ||
    message.includes('responsemimetype') ||
    message.includes('application/json')
  );
}

export function isGeminiStructuredOutputUnsupportedError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('responseschema') ||
    message.includes('response schema') ||
    message.includes('responsemimetype') ||
    message.includes('response mime') ||
    message.includes('application/json') ||
    message.includes('structured output')
  );
}

export function buildOpenAiCompatibleHeaders(
  plan: ProviderPlan,
  frontendUrl?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (plan.apiKey && plan.apiKey !== 'no-key') {
    headers['Authorization'] = `Bearer ${plan.apiKey}`;
  }
  if (plan.provider === 'openrouter') {
    headers['HTTP-Referer'] = frontendUrl || 'http://localhost:5173';
    headers['X-Title'] = 'Data Explorer';
  }
  return headers;
}
