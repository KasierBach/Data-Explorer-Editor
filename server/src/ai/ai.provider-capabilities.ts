import type { ProviderPlan } from './ai.types';

const BEEKNOEE_VISION_PATTERNS = [/^minimax\//i, /^gemini-/i, /^claude-/i];
const GROQ_VISION_PATTERNS = [/^qwen\/qwen3\.6-27b$/i];

const OPENROUTER_VISION_PATTERNS = [
  /gemma-4/i,
  /gpt-4o/i,
  /gemini/i,
  /claude-3/i,
  /claude-sonnet-4/i,
  /claude-opus-4/i,
  /vision/i,
  /multimodal/i,
  /llama-3\.2-(11b|90b)-vision/i,
  /llama-4/i,
  /owl-alpha/i,
];

function matchesAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function supportsVision(
  plan: Pick<ProviderPlan, 'provider' | 'model'>,
): boolean {
  switch (plan.provider) {
    case 'gemini':
      return true;
    case 'beeknoee':
      return matchesAnyPattern(plan.model, BEEKNOEE_VISION_PATTERNS);
    case 'groq':
      return matchesAnyPattern(plan.model, GROQ_VISION_PATTERNS);
    case 'openrouter':
      return matchesAnyPattern(plan.model, OPENROUTER_VISION_PATTERNS);
    default:
      return false;
  }
}

export function supportsDocument(
  plan: Pick<ProviderPlan, 'provider' | 'model'>,
): boolean {
  return plan.provider === 'gemini' || plan.provider === 'openrouter';
}

export function supportsLiveWebSearch(
  plan: Pick<ProviderPlan, 'provider' | 'model'>,
): boolean {
  if (plan.provider === 'gemini' || plan.provider === 'openrouter') {
    return true;
  }

  return (
    plan.provider === 'groq' && /^groq\/compound(?:-mini)?$/i.test(plan.model)
  );
}
