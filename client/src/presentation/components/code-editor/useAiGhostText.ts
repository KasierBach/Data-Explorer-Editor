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


    const abortControllerRef = useRef<AbortController | null>(null);

    const triggerGhostText = useCallback((delay = 450) => {
        const editor = editorRef.current;
        if (!editor || !activeConnectionId) return;

        clearGhostText();

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
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

            // Check keywords
            const textBefore = lineContent.substring(0, position.column - 1);
            if (textBefore.endsWith(' ')) {
                const lastWord = textBefore.trimEnd().split(/\s+/).pop()?.toUpperCase() || '';
                if (POPUP_KEYWORDS.has(lastWord)) return;
            }

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
                // Setup abort controller
                abortControllerRef.current = new AbortController();

                // Note: We need to update AiService.ts to support signal if we want true cancellation, 
                // but for now we just catch the error and check requestId.
                const completion = await aiService.getAutocomplete({
                    connectionId: activeConnectionId,
                    database: activeDatabase,
                    beforeCursor,
                    afterCursor,
                }, abortControllerRef.current.signal);

                if (requestId !== currentRequestIdRef.current) return;
                const currentPos = editor.getPosition();
                if (!currentPos || currentPos.lineNumber !== position.lineNumber || currentPos.column !== position.column) return;

                if (completion) {
                    let finalCompletion = completion;
                    
                    // Filter out suggestions that already exist in the AFTER CURSOR context
                    if (afterCursor.startsWith(finalCompletion)) return;
                    
                    // If the suggestion is just a semicolon and one already exists soon in afterCursor, skip it
                    if (finalCompletion.trim() === ';' && afterCursor.trim().startsWith(';')) return;

                    const textBeforeContext = lineContent.substring(0, position.column - 1);
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
                        if (sqlKeywords.has(startWord) || (finalCompletion.startsWith('*') && /[a-zA-Z0-9_]$/.test(textBeforeContext)) || /[\`\"\'\]\)]$/.test(textBeforeContext)) {
                            finalCompletion = ' ' + finalCompletion;
                        }
                    }
                    showGhostText(finalCompletion, position.lineNumber, position.column);
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.warn('[AiGhostText] Failed to fetch completion:', err.message);
            }
        }, delay);
    }, [activeConnectionId, activeDatabase, clearGhostText, editorRef, showGhostText]);

    const isAcceptingRef = useRef(false);

    const acceptGhostText = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || !ghostTextRef.current) return false;

        const position = editor.getPosition();
        if (!position) return false;

        isAcceptingRef.current = true;
        
        editor.executeEdits('ai-ghost-text', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
            },
            text: ghostTextRef.current,
        }]);

        const lines = ghostTextRef.current.split('\n');
        const lastLine = lines[lines.length - 1];
        const newLineNumber = position.lineNumber + lines.length - 1;
        const newColumn = lines.length === 1
            ? position.column + lastLine.length
            : lastLine.length + 1;

        editor.setPosition({ lineNumber: newLineNumber, column: newColumn });
        clearGhostText();

        // Chain trigger: Get next suggestion immediately after accepting current one
        triggerGhostText(50); 
        
        // Reset flag after a short delay so the cursor move event is ignored
        setTimeout(() => { isAcceptingRef.current = false; }, 100);
        
        return true;
    }, [editorRef, clearGhostText, triggerGhostText]);

    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco || !activeConnectionId) return;

        // Trigger when user types or deletes
        const contentDisposable = editor.onDidChangeModelContent(() => {
            // If the change was caused by our own ghost text insertion, skip
            if (isAcceptingRef.current) return;
            triggerGhostText();
        });

        // Handle Tab key
        editor.addCommand(
            monaco.KeyCode.Tab,
            () => {
                if (!acceptGhostText()) {
                    editor.trigger('keyboard', 'tab', null);
                }
            },
            'editorTextFocus && !suggestWidgetVisible'
        );

        // Handle Escape
        editor.addCommand(
            monaco.KeyCode.Escape,
            () => {
                clearGhostText();
            },
            'editorTextFocus'
        );

        // Clear ghost text and re-trigger on cursor move
        const cursorDisposable = editor.onDidChangeCursorPosition(() => {
            // Ignore if this move came from acceptGhostText
            if (isAcceptingRef.current) return;

            if (ghostTextRef.current) {
                clearGhostText();
            }
            const selection = editor.getSelection();
            if (selection && selection.isEmpty()) {
                triggerGhostText();
            }
        });

        return () => {
            contentDisposable.dispose();
            cursorDisposable.dispose();
            clearGhostText();
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [editorRef.current, monacoRef.current, activeConnectionId, triggerGhostText, acceptGhostText, clearGhostText]);
}
