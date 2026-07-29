import {
  supportsDocument,
  supportsLiveWebSearch,
  supportsVision,
} from './ai.provider-capabilities';
import type { AiProvider } from './ai.types';

type CapabilityCase = [AiProvider, string, boolean];

describe('AI provider capability contract', () => {
  it.each<CapabilityCase>([
    ['gemini', 'gemini-2.5-flash', true],
    ['beeknoee', 'minimax/minimax-m2.7', true],
    ['beeknoee', 'gemini-3.1-pro-preview', true],
    ['beeknoee', 'claude-sonnet-4-6', true],
    ['beeknoee', 'glm-4.7-flash', false],
    ['groq', 'qwen/qwen3.6-27b', true],
    ['groq', 'groq/compound', false],
    ['openrouter', 'openai/gpt-4o-mini', true],
    ['openrouter', 'google/gemma-4-31b-it:free', true],
    ['openrouter', 'openai/gpt-oss-120b', false],
    ['cerebras', 'gpt-oss-120b', false],
    ['custom', 'custom-model', false],
  ])('%s/%s vision support is %s', (provider, model, expected) => {
    expect(supportsVision({ provider, model })).toBe(expected);
  });

  it.each<CapabilityCase>([
    ['gemini', 'gemini-2.5-flash', true],
    ['openrouter', 'openai/gpt-oss-120b', true],
    ['groq', 'groq/compound', true],
    ['groq', 'groq/compound-mini', true],
    ['groq', 'openai/gpt-oss-120b', false],
    ['beeknoee', 'gemini-3.1-pro-preview', false],
    ['cerebras', 'gpt-oss-120b', false],
    ['custom', 'custom-model', false],
  ])('%s/%s live search support is %s', (provider, model, expected) => {
    expect(supportsLiveWebSearch({ provider, model })).toBe(expected);
  });

  it.each<CapabilityCase>([
    ['gemini', 'gemini-2.5-flash', true],
    ['openrouter', 'openai/gpt-oss-120b', true],
    ['groq', 'groq/compound', false],
    ['beeknoee', 'minimax/minimax-m2.7', false],
    ['cerebras', 'gpt-oss-120b', false],
    ['custom', 'custom-model', false],
  ])('%s/%s PDF support is %s', (provider, model, expected) => {
    expect(supportsDocument({ provider, model })).toBe(expected);
  });
});
