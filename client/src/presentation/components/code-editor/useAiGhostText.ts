import { useEffect, useMemo } from 'react';
import { aiService } from '@/core/services/AiService';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { assertAiEnabled, isAiEnabled } from '@/core/services/aiAccountPolicy';
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

const activeModelRequests = new WeakMap<editor.ITextModel, AbortController>();

/**
 * Registers a Monaco inline-completions provider ("ghost text").
 * Tab accepts, Esc dismisses. Pass the editor's current model to scope ownership;
 * null defers registration until the editor mounts.
 */
export function useAiGhostText(
    monaco: Monaco | null,
    activeConnectionId: string | null,
    activeDatabase: string | undefined,
    language: string = 'sql',
    owningModel?: editor.ITextModel | null,
) {
    const activeAccountId = useAppStore((state) => state.user?.id);
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
        if (!monaco || !activeConnectionId || owningModel === null || preferences.enabled !== true || !isAiEnabled()) return;

        let disposed = false;
        const activeRequests = new Set<AbortController>();

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
                // Providers are language-global, not scoped to the registering editor.
                if (disposed || !isAiEnabled() || token.isCancellationRequested
                    || (owningModel !== undefined && model !== owningModel)
                    || useAppStore.getState().user?.id !== activeAccountId || model.isDisposed()) return;
                assertAiEnabled();
                activeModelRequests.get(model)?.abort();

                const editors = (monaco.editor.getEditors() as editor.IStandaloneCodeEditor[]).filter((candidate) => candidate.getModel() === model);
                const requestEditor = editors.find((candidate) => candidate.hasTextFocus()) || editors[0];
                if (!requestEditor) return;
                const cursor = { lineNumber: position.lineNumber, column: position.column };
                const editorPosition = requestEditor.getPosition();
                if (!editorPosition || editorPosition.lineNumber !== cursor.lineNumber || editorPosition.column !== cursor.column) return;

                const modelUri = model.uri.toString();
                const versionId = model.getVersionId();
                const controller = new AbortController();
                const { signal } = controller;
                activeRequests.add(controller);
                activeModelRequests.set(model, controller);

                let cancellationListener: ReturnType<CancellationToken['onCancellationRequested']> | undefined;
                const disposeCancellationListener = () => {
                    const listener = cancellationListener;
                    cancellationListener = undefined;
                    listener?.dispose();
                };
                const isCurrent = () => {
                    const currentPosition = requestEditor.getPosition();
                    return !disposed && !signal.aborted && !token.isCancellationRequested && isAiEnabled()
                        && useAppStore.getState().user?.id === activeAccountId && !model.isDisposed()
                        && model.uri.toString() === modelUri && model.getVersionId() === versionId
                        && requestEditor.getModel() === model && currentPosition?.lineNumber === cursor.lineNumber
                        && currentPosition.column === cursor.column;
                };

                try {
                    signal.addEventListener('abort', disposeCancellationListener, { once: true });
                    cancellationListener = token.onCancellationRequested(() => controller.abort());
                    if (token.isCancellationRequested) controller.abort();
                    if (signal.aborted) disposeCancellationListener();

                    // Canceling the debounce must settle it without ever capturing text.
                    const elapsed = await new Promise<boolean>((resolve) => {
                        if (signal.aborted) {
                            resolve(false);
                            return;
                        }
                        const onAbort = () => {
                            clearTimeout(timeout);
                            resolve(false);
                        };
                        const timeout = setTimeout(() => {
                            signal.removeEventListener('abort', onAbort);
                            resolve(true);
                        }, 350);
                        signal.addEventListener('abort', onAbort, { once: true });
                    });
                    if (!elapsed || !isCurrent()) return;
                    assertAiEnabled();

                    const lineContent = model.getLineContent(cursor.lineNumber);
                    const textBefore = lineContent.substring(0, cursor.column - 1);

                    // Don't trigger in the middle of a word.
                    const charAfter = lineContent[cursor.column - 1] || '';
                    if (charAfter && /[a-zA-Z0-9_]/.test(charAfter)) return;

                    // Avoid overlapping with the standard keyword popup.
                    const words = textBefore.trimEnd().split(/\s+/);
                    const lastWord = words[words.length - 1]?.toUpperCase() || '';
                    if (textBefore.endsWith(' ') && POPUP_KEYWORDS.has(lastWord)) return;

                    // Match the server's bounded context windows.
                    const beforeCursor = model.getValueInRange({
                        startLineNumber: Math.max(1, cursor.lineNumber - 50),
                        startColumn: 1,
                        endLineNumber: cursor.lineNumber,
                        endColumn: cursor.column,
                    }).slice(-1500);

                    const afterCursor = model.getValueInRange({
                        startLineNumber: cursor.lineNumber,
                        startColumn: cursor.column,
                        endLineNumber: Math.min(model.getLineCount(), cursor.lineNumber + 20),
                        endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), cursor.lineNumber + 20)),
                    }).slice(0, 300);

                    // Include NoSQL schema when available.
                    let contextStr = undefined;
                    const isNoSql = language === 'json';
                    if (isNoSql && nosqlActiveCollection && nosqlSchemaStats) {
                        contextStr = `[NOSQL SCHEMA] Collection: ${nosqlActiveCollection}\nFields: ${formatNoSqlSchemaFields(nosqlSchemaStats)}`;
                    }

                    if (!isCurrent()) return;
                    assertAiEnabled();
                    const completion = await aiService.getAutocomplete({
                        connectionId: activeConnectionId,
                        database: activeDatabase,
                        beforeCursor,
                        afterCursor,
                        context: contextStr,
                        model: resolvedAutocomplete.model,
                        providerOverride: resolvedAutocomplete.providerOverride,
                        disabledProviders: preferences.disabledProviders,
                        fallbackProvider: preferences.fallbackProvider,
                    }, signal);

                    if (!completion || !isCurrent()) return;

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
                                    startLineNumber: cursor.lineNumber,
                                    startColumn: cursor.column,
                                    endLineNumber: cursor.lineNumber,
                                    endColumn: cursor.column,
                                },
                                // Inline completions are handled by Monaco's ghost text renderer
                            },
                        ],
                    };
                } catch {
                    return;
                } finally {
                    signal.removeEventListener('abort', disposeCancellationListener);
                    disposeCancellationListener();
                    activeRequests.delete(controller);
                    if (activeModelRequests.get(model) === controller) activeModelRequests.delete(model);
                }
            },
            disposeInlineCompletions: () => undefined,
        };

        const disposable = monaco.languages.registerInlineCompletionsProvider(language, provider);

        return () => {
            disposed = true;
            for (const controller of activeRequests) controller.abort();
            activeRequests.clear();
            disposable.dispose();
        };
    }, [
        monaco,
        activeAccountId,
        activeConnectionId,
        activeDatabase,
        language,
        owningModel,
        nosqlActiveCollection,
        nosqlSchemaStats,
        preferences.enabled,
        preferences.disabledProviders,
        preferences.fallbackProvider,
        resolvedAutocomplete.model,
        resolvedAutocomplete.providerOverride,
    ]);
}
