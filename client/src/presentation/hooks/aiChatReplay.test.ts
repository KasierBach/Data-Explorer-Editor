import { describe, expect, it } from 'vitest';
import type { AiMessage } from '@/core/services/store';
import { findReplaySourceUserMessage } from './aiChatReplay';

describe('findReplaySourceUserMessage', () => {
  const messages: readonly AiMessage[] = [
    { id: 'welcome', role: 'ai', content: 'hello', timestamp: 1 },
    { id: 'user-1', role: 'user', content: 'first prompt', timestamp: 2 },
    { id: 'ai-1', role: 'ai', content: 'first answer', timestamp: 3 },
    { id: 'user-2', role: 'user', content: 'second prompt', timestamp: 4 },
    { id: 'ai-2', role: 'ai', content: 'second answer', timestamp: 5 },
  ];

  it('finds the user message paired with the targeted AI response', () => {
    expect(findReplaySourceUserMessage(messages, 'ai-1')?.id).toBe('user-1');
    expect(findReplaySourceUserMessage(messages, 'ai-2')?.id).toBe('user-2');
  });

  it('falls back to the latest user message when no AI target is provided', () => {
    expect(findReplaySourceUserMessage(messages)?.id).toBe('user-2');
  });
});
