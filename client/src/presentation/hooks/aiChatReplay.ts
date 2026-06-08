import type { AiMessage } from '@/core/services/store';

export function findReplaySourceUserMessage(
    messages: readonly AiMessage[],
    targetAiMessageId?: string,
): AiMessage | undefined {
    if (!messages.length) return undefined;

    if (!targetAiMessageId) {
        return [...messages].reverse().find((message) => message.role === 'user');
    }

    const targetIndex = messages.findIndex((message) => message.id === targetAiMessageId);
    if (targetIndex === -1) {
        return [...messages].reverse().find((message) => message.role === 'user');
    }

    for (let index = targetIndex - 1; index >= 0; index -= 1) {
        if (messages[index].role === 'user') {
            return messages[index];
        }
    }

    return undefined;
}
