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

export function toRequestHistory(
    messages: readonly AiMessage[],
    excludedMessageId: string,
) {
    return messages
        .filter((message) => message.id !== excludedMessageId && message.content.trim().length > 0)
        .map(({ role, content }) => ({ role, content }));
}

export function hasAiResponseContent(message: AiMessage | undefined) {
    return !!message && !!(
        message.content.trim() ||
        message.sql ||
        message.explanation ||
        message.recommendations?.length
    );
}
