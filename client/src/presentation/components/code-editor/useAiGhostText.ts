import { useEffect, useRef, useCallback } from 'react';
import { aiService } from '@/core/services/AiService';

/**
 * Custom hook that renders AI-predicted SQL as ghost text (greyed-out)
 * directly inside the Monaco editor using Decorations + Widget API.
 * 
 * User presses Tab to accept, Escape to dismiss.
 */
export function useAiGhostText(
    editorRef: React.MutableRefObject<any>,
    monacoRef: React.MutableRefObject<any>,
    activeConnectionId: string | null,
    activeDatabase: string | undefined,
) {
    const decorationsRef = useRef<any>(null);
    const ghostTextRef = useRef<string>('');
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentRequestIdRef = useRef(0);

    // SQL keywords after which we should NOT trigger ghost text (let popup handle it)
    const POPUP_KEYWORDS = new Set([
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'UPDATE', 'INSERT', 'INTO',
        'SET', 'DELETE', 'ORDER', 'GROUP', 'AND', 'OR', 'ON', 'BY',
        'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'HAVING', 'AS',
        'TABLE', 'IN', 'VALUES', 'LIKE', 'BETWEEN', 'NOT', 'IS',
    ]);

    const clearGhostText = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;

        if (decorationsRef.current) {
            editor.removeContentWidget(decorationsRef.current);
            decorationsRef.current = null;
        }
        ghostTextRef.current = '';
    }, [editorRef]);

    const showGhostText = useCallback((text: string, lineNumber: number, column: number) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco || !text) return;

        // Clear previous ghost text
        clearGhostText();

        ghostTextRef.current = text;

        // Create a content widget to show ghost text
        const widget = {
            getId: () => 'ai-ghost-text-widget',
            getDomNode: () => {
                const node = document.createElement('span');
                node.textContent = text;
                // Make it look exactly like VS Code / Copilot ghost text
                node.style.color = '#6b7280'; // Tailwind gray-500
                node.style.fontStyle = 'italic';
                node.style.opacity = '0.7';
                node.style.pointerEvents = 'none';
                node.style.whiteSpace = 'pre';
                
                // Get exact font settings from editor to ensure perfect vertical and horizontal alignment
                try {
                    const fontInfo = editor.getOption(monaco.editor.EditorOption.fontInfo);
                    if (fontInfo) {
                        node.style.fontFamily = fontInfo.fontFamily;
                        node.style.fontSize = fontInfo.fontSize + 'px';
                        node.style.lineHeight = fontInfo.lineHeight + 'px';
                        node.style.fontWeight = fontInfo.fontWeight;
                        node.style.letterSpacing = fontInfo.letterSpacing + 'px';
                    } else {
                        throw new Error('Fallback');
                    }
                } catch(e) {
                    node.style.fontFamily = 'inherit';
                    node.style.fontSize = 'inherit';
                    node.style.lineHeight = 'inherit';
                }
                
                // Important to prevent it from inheriting awkward editor backgrounds
                node.style.backgroundColor = 'transparent';
                node.style.userSelect = 'none';
                return node;
            },
            getPosition: () => ({
                position: { lineNumber, column },
                preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
            }),
        };

        decorationsRef.current = widget;
        editor.addContentWidget(widget);
    }, [editorRef, monacoRef, clearGhostText]);

    const acceptGhostText = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || !ghostTextRef.current) return false;

        const position = editor.getPosition();
        if (!position) return false;

        // Insert the ghost text at cursor position
        editor.executeEdits('ai-ghost-text', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            },
            text: ghostTextRef.current,
        }]);

        // Move cursor to end of inserted text
        const lines = ghostTextRef.current.split('\n');
        const lastLine = lines[lines.length - 1];
        const newLineNumber = position.lineNumber + lines.length - 1;
        const newColumn = lines.length === 1
            ? position.column + lastLine.length
            : lastLine.length + 1;

        editor.setPosition({ lineNumber: newLineNumber, column: newColumn });

        clearGhostText();
        return true;
    }, [editorRef, clearGhostText]);

    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco || !activeConnectionId) return;

        // Function to trigger ghost text request
        const triggerGhostText = () => {
            clearGhostText();

            // Debounce
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            currentRequestIdRef.current++;
            const requestId = currentRequestIdRef.current;

            debounceTimerRef.current = setTimeout(async () => {
                if (requestId !== currentRequestIdRef.current) return;

                const position = editor.getPosition();
                if (!position) return;

                const model = editor.getModel();
                if (!model) return;

                const lineContent = model.getLineContent(position.lineNumber);
                if (lineContent.trim().length < 3) return;

                // Check if cursor is right after a keyword + space → let popup handle it
                const textBefore = lineContent.substring(0, position.column - 1);
                if (textBefore.endsWith(' ')) {
                    const lastWord = textBefore.trimEnd().split(/\s+/).pop()?.toUpperCase() || '';
                    if (POPUP_KEYWORDS.has(lastWord)) return;
                }

                const beforeCursor = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                });

                const afterCursor = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: model.getLineCount(),
                    endColumn: model.getLineMaxColumn(model.getLineCount()),
                });

                try {
                    const completion = await aiService.getAutocomplete({
                        connectionId: activeConnectionId,
                        database: activeDatabase,
                        beforeCursor,
                        afterCursor,
                    });

                    // Check if still the latest request and cursor hasn't moved
                    if (requestId !== currentRequestIdRef.current) return;
                    const currentPos = editor.getPosition();
                    if (!currentPos || currentPos.lineNumber !== position.lineNumber || currentPos.column !== position.column) return;

                    if (completion) {
                        let finalCompletion = completion;
                        const textBeforeContext = lineContent.substring(0, position.column - 1);

                        // Smart Space Prepending: Prevent words from sticking together when accepted
                        // (e.g. "public.products" + "where" -> "public.products where")
                        if (
                            textBeforeContext.length > 0 && 
                            !/\s$/.test(textBeforeContext) && 
                            finalCompletion.length > 0 && 
                            !/^[\s,.;:!?)\]\}]/.test(finalCompletion)
                        ) {
                            const startWordMatch = finalCompletion.match(/^[a-zA-Z]+/);
                            const startWord = startWordMatch ? startWordMatch[0].toUpperCase() : '';
                            const sqlKeywords = new Set([
                                'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AND', 'OR', 'ORDER', 'GROUP', 
                                'BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'AS', 'INNER', 'LEFT', 
                                'RIGHT', 'OUTER', 'CROSS', 'SET', 'VALUES', 'INTO', 'UPDATE', 'DELETE', 'INSERT', 'RETURNING'
                            ]);

                            const endsWithBoundary = /[\`\"\'\]\)]$/.test(textBeforeContext);
                            const textEndsWithWord = /[a-zA-Z0-9_]$/.test(textBeforeContext);

                            // Case 1: Completion starts with a major SQL keyword
                            // Case 2: Completion starts with '*' and text before ends with a word (e.g "select" + "*")
                            // Case 3: Text before ended with a quote/bracket
                            if (
                                sqlKeywords.has(startWord) || 
                                (finalCompletion.startsWith('*') && textEndsWithWord) ||
                                endsWithBoundary
                            ) {
                                finalCompletion = ' ' + finalCompletion;
                            }
                        }

                        showGhostText(finalCompletion, position.lineNumber, position.column);
                    }
                } catch (err) {
                    // Silently ignore errors
                }
            }, 600);
        };

        // Trigger when user types or deletes
        const contentDisposable = editor.onDidChangeModelContent(() => {
            triggerGhostText();
        });

        // Handle Tab key to accept ghost text
        editor.addCommand(
            monaco.KeyCode.Tab,
            () => {
                if (!acceptGhostText()) {
                    // If no ghost text to accept, perform default Tab action (indent)
                    editor.trigger('keyboard', 'tab', null);
                }
            },
            // Only override Tab when ghost text is visible
            'editorTextFocus && !suggestWidgetVisible'
        );

        // Handle Escape to dismiss ghost text
        editor.addCommand(
            monaco.KeyCode.Escape,
            () => {
                clearGhostText();
            },
            'editorTextFocus'
        );

        // Clear ghost text and re-trigger on cursor move (e.g. user clicks elsewhere or F5)
        const cursorDisposable = editor.onDidChangeCursorPosition(() => {
            // Give a tiny delay to see if this cursor move is caused by our own Tab completion
            setTimeout(() => {
                if (ghostTextRef.current) {
                    clearGhostText();
                }
                
                // Only trigger if it's a simple cursor move (no text selected)
                const selection = editor.getSelection();
                if (selection && selection.isEmpty()) {
                    triggerGhostText();
                }
            }, 50);
        });

        return () => {
            contentDisposable.dispose();
            cursorDisposable.dispose();
            clearGhostText();
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [editorRef.current, monacoRef.current, activeConnectionId, activeDatabase]);
}
