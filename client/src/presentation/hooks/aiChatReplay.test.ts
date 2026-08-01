import { describe, expect, it } from 'vitest';
import type { AiMessage } from '@/core/services/store';
import {
  findReplaySourceUserMessage,
  hasAiResponseContent,
  toRequestHistory,
} from './aiChatReplay';

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

  it('omits the current placeholder and empty messages from request history', () => {
    expect(toRequestHistory([
      ...messages,
      { id: 'empty-ai', role: 'ai', content: '', timestamp: 6 },
      { id: 'current-ai', role: 'ai', content: '', timestamp: 7 },
    ], 'current-ai')).toEqual(messages.map(({ role, content }) => ({ role, content })));
  });

  it('distinguishes an empty stream placeholder from a usable response', () => {
    expect(hasAiResponseContent(undefined)).toBe(false);
    expect(hasAiResponseContent({ id: 'empty', role: 'ai', content: '', timestamp: 6 })).toBe(false);
    expect(hasAiResponseContent({
      id: 'sql-only',
      role: 'ai',
      content: '',
      sql: 'SELECT 1;',
      timestamp: 7,
    })).toBe(true);
  });
});
