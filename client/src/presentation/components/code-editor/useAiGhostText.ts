import { useEffect } from 'react';
import { aiService } from '@/core/services/AiService';

/**
 * Custom hook that registers an AI-powered Inline Completions Provider for Monaco.
 * This provides "Ghost Text" functionality similar to GitHub Copilot or VS Code.
 * 
 * It automatically handles Tab to accept and Esc to dismiss.
 */
export function useAiGhostText(
    monaco: any,
    activeConnectionId: string | null,
    activeDatabase: string | undefined,
) {
    useEffect(() => {
        if (!monaco || !activeConnectionId) return;

        // SQL keywords that typically trigger Monaco's standard completion popup.
        // We might want to be less aggressive when these are typed.
        const POPUP_KEYWORDS = new Set([
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'UPDATE', 'INSERT', 'INTO',
            'SET', 'DELETE', 'ORDER', 'GROUP', 'AND', 'OR', 'ON', 'BY',
            'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'HAVING', 'AS',
            'VALUES', 'LIMIT'
        ]);

        const provider = {
            provideInlineCompletions: async (model: any, position: any, _context: any, token: any) => {
                // 1. Basic Validation
                const lineContent = model.getLineContent(position.lineNumber);
                const textBefore = lineContent.substring(0, position.column - 1);
                
                // Don't trigger if user just started typing a new line or it's just whitespace
                if (lineContent.trim().length < 2) return;

                // 2. Intelligence: Don't trigger if we're in the middle of a word unless at the end
                const charAfter = lineContent[position.column - 1] || '';
                if (charAfter && /[a-zA-Z0-9_]/.test(charAfter)) return;

                // 3. Debounce: Wait a bit before making the request
                // We use 350ms for a balance between responsiveness and server load
                await new Promise(resolve => setTimeout(resolve, 350));
                if (token.isCancellationRequested) return;

                // 4. Check for keywords to avoid overlapping with standard popup
                const words = textBefore.trimEnd().split(/\s+/);
                const lastWord = words[words.length - 1]?.toUpperCase() || '';
                if (textBefore.endsWith(' ') && POPUP_KEYWORDS.has(lastWord)) return;

                // 5. Gather Context
                const beforeCursor = model.getValueInRange({
                    startLineNumber: Math.max(1, position.lineNumber - 50),
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                });

                const afterCursor = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 20),
                    endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 20)),
                });

                try {
                    // Pass the Monaco CancellationToken converted to AbortSignal if needed,
                    // but AiService just needs it to check during processing.
                    const completion = await aiService.getAutocomplete({
                        connectionId: activeConnectionId,
                        database: activeDatabase,
                        beforeCursor,
                        afterCursor,
                    });

                    if (!completion || token.isCancellationRequested) return;

                    let finalCompletion = completion;

                    // 6. Handle Auto-Spacing (Aggressive)
                    const charBefore = textBefore.length > 0 ? textBefore[textBefore.length - 1] : '';
                    const firstCharOfCompletion = finalCompletion[0];

                    const isIdentifierPart = (ch: string) => /[a-zA-Z0-9_"\`\[]/.test(ch);

                    if (charBefore && firstCharOfCompletion) {
                        if (isIdentifierPart(charBefore) && isIdentifierPart(firstCharOfCompletion)) {
                            // If both are identifier-like and there's no space between them, add one
                            if (!/\s/.test(charBefore) && !/\s/.test(firstCharOfCompletion)) {
                                finalCompletion = ' ' + finalCompletion;
                            }
                        }
                    }

                    // 7. Semicolon protection: Avoid redundant semicolons
                    if (finalCompletion.trim().startsWith(';')) {
                        if (textBefore.trim().endsWith(';') || afterCursor.trim().startsWith(';')) {
                            // If user already has a semicolon, don't suggest another one at the start
                            finalCompletion = finalCompletion.trim().replace(/^;+/, '').trim();
                            if (!finalCompletion) return;
                        }
                    }

                    // 8. Deduplication: Don't suggest what's already there
                    const normalizedAfter = afterCursor.trim().toLowerCase();
                    const normalizedCompletion = finalCompletion.trim().toLowerCase();
                    if (normalizedAfter.startsWith(normalizedCompletion) || (normalizedAfter.length > 3 && normalizedCompletion.startsWith(normalizedAfter))) return;

                    return {
                        items: [
                            {
                                insertText: finalCompletion,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: position.column,
                                    endLineNumber: position.lineNumber,
                                    endColumn: position.column,
                                },
                                // Inline completions are handled by Monaco's ghost text renderer
                            },
                        ],
                    };
                } catch (err) {
                    return;
                }
            },
            freeInlineCompletions: () => {},
        };

        const disposable = monaco.languages.registerInlineCompletionsProvider('sql', provider);

        return () => disposable.dispose();
    }, [monaco, activeConnectionId, activeDatabase]);
}
