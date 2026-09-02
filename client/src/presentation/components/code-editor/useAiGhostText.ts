import { useEffect, useMemo } from 'react';
import { aiService } from '@/core/services/AiService';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { useAppStore } from '@/core/services/store';
import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages, Position } from 'monaco-editor';

interface NoSqlSchemaField {
    name: string;
    types: Record<string, unknown>;
}

function isNoSqlSchemaField(value: unknown): value is NoSqlSchemaField {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<NoSqlSchemaField>;
    return typeof candidate.name === 'string' && !!candidate.types && typeof candidate.types === 'object';
}

function formatNoSqlSchemaFields(stats: unknown) {
    if (!Array.isArray(stats)) return '';
    return stats
        .filter(isNoSqlSchemaField)
        .map((field) => `${field.name} (${Object.keys(field.types).join('/')})`)
        .join(', ');
}

/**
 * Registers a Monaco inline-completions provider ("ghost text").
 * Tab accepts, Esc dismisses.
 */
export function useAiGhostText(
    monaco: Monaco | null,
    activeConnectionId: string | null,
    activeDatabase: string | undefined,
    language: string = 'sql'
) {
    const aiModel = useAppStore((state) => state.aiModel);
    const nosqlActiveCollection = useAppStore((state) => state.nosqlActiveCollection);
    const nosqlSchemaStats = useAppStore((state) => state.nosqlSchemaStats);
    const preferences = useAiPreferences();
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedAutocomplete = useMemo(
        () => resolveAiSelection(
            preferences.autocompleteModel,
            assistantSelection,
            preferences.customProviders,
        ),
        [preferences.autocompleteModel, assistantSelection, preferences.customProviders],
    );

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

        const provider: languages.InlineCompletionsProvider = {
            provideInlineCompletions: async (
                model: editor.ITextModel,
                position: Position,
                _context: languages.InlineCompletionContext,
                token: CancellationToken,
            ) => {
                const lineContent = model.getLineContent(position.lineNumber);
                const textBefore = lineContent.substring(0, position.column - 1);

                // Don't trigger in the middle of a word.
                const charAfter = lineContent[position.column - 1] || '';
                if (charAfter && /[a-zA-Z0-9_]/.test(charAfter)) return;

                // 3. Debounce
                await new Promise(resolve => setTimeout(resolve, 350));
                if (token.isCancellationRequested) return;

                // Avoid overlapping with the standard keyword popup.
                const words = textBefore.trimEnd().split(/\s+/);
                const lastWord = words[words.length - 1]?.toUpperCase() || '';
                if (textBefore.endsWith(' ') && POPUP_KEYWORDS.has(lastWord)) return;

                // Gather context before the cursor.
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
                    // Include NoSQL schema when available.
                    let contextStr = undefined;
                    const isNoSql = language === 'json';
                    if (isNoSql && nosqlActiveCollection && nosqlSchemaStats) {
                        contextStr = `[NOSQL SCHEMA] Collection: ${nosqlActiveCollection}\nFields: ${formatNoSqlSchemaFields(nosqlSchemaStats)}`;
                    }

                    const completion = await aiService.getAutocomplete({
                        connectionId: activeConnectionId,
                        database: activeDatabase,
                        beforeCursor,
                        afterCursor,
                        context: contextStr,
                        model: resolvedAutocomplete.model,
                        providerOverride: resolvedAutocomplete.providerOverride,
                    });

                    if (!completion || token.isCancellationRequested) return;

                    let finalCompletion = completion;

                    // Auto-spacing.
                    const charBefore = textBefore.length > 0 ? textBefore[textBefore.length - 1] : '';
                    const firstCharOfCompletion = finalCompletion[0];

                    const isIdentifierPart = (ch: string) => /[a-zA-Z0-9_"`[]/.test(ch);

                    if (charBefore && firstCharOfCompletion) {
                        if (isIdentifierPart(charBefore) && isIdentifierPart(firstCharOfCompletion)) {
                            // If both are identifier-like and there's no space between them, add one
                            if (!/\s/.test(charBefore) && !/\s/.test(firstCharOfCompletion)) {
                                finalCompletion = ' ' + finalCompletion;
                            }
                        }
                    }

                    // Avoid redundant semicolons.
                    if (finalCompletion.trim().startsWith(';')) {
                        if (textBefore.trim().endsWith(';') || afterCursor.trim().startsWith(';')) {
                            // If user already has a semicolon, don't suggest another one at the start
                            finalCompletion = finalCompletion.trim().replace(/^;+/, '').trim();
                            if (!finalCompletion) return;
                        }
                    }

                    // Don't suggest what's already typed.
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
                } catch {
                    return;
                }
            },
            disposeInlineCompletions: () => undefined,
        };

        const disposable = monaco.languages.registerInlineCompletionsProvider(language, provider);

        return () => disposable.dispose();
    }, [
        monaco,
        activeConnectionId,
        activeDatabase,
        language,
        nosqlActiveCollection,
        nosqlSchemaStats,
        resolvedAutocomplete.model,
        resolvedAutocomplete.providerOverride,
    ]);
}
