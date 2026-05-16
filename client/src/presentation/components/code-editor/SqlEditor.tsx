import React, { useEffect, useRef } from 'react';
import Editor, { useMonaco, type Monaco, type OnMount } from '@monaco-editor/react';
import { createSqlCompletionProvider, type SchemaInfo } from './sqlAutocomplete';
import { useAppStore } from '@/core/services/store';
import { useAiGhostText } from './useAiGhostText';

interface SqlEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    height?: string | number;
    onMount?: OnMount;
    schemaInfo?: SchemaInfo;
}

type EditorTheme = 'vs-dark' | 'light';
type Disposable = { dispose: () => void };

function getEditorTheme(): EditorTheme {
    if (typeof document === 'undefined') return 'vs-dark';
    return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light';
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, height = "300px", onMount, schemaInfo }) => {
    const [theme, setTheme] = React.useState<EditorTheme>(() => getEditorTheme());
    const { activeConnectionId, activeDatabase } = useAppStore();
    const disposableRef = useRef<Disposable | null>(null);

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setTheme(getEditorTheme());
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const monaco = useMonaco();

    // Register standard SQL completion provider
    useEffect(() => {
        if (!monaco) return;

        if (disposableRef.current) {
            disposableRef.current.dispose();
            disposableRef.current = null;
        }

        const info: SchemaInfo = schemaInfo || { tables: [] };
        const provider = createSqlCompletionProvider(info, monaco);
        disposableRef.current = monaco.languages.registerCompletionItemProvider('sql', provider);

        return () => {
            if (disposableRef.current) {
                disposableRef.current.dispose();
                disposableRef.current = null;
            }
        };
    }, [monaco, schemaInfo]);

    // AI Ghost Text (uses Monaco's InlineCompletionsProvider)
    useAiGhostText(monaco, activeConnectionId, activeDatabase || undefined);

    const handleEditorMount: OnMount = (editor, monacoInstance: Monaco) => {
        onMount?.(editor, monacoInstance);
    };

    return (
        <Editor
            height={height}
            defaultLanguage="sql"
            value={value}
            onChange={onChange}
            theme={theme}
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                wordWrap: 'on',
                contextmenu: true,
                copyWithSyntaxHighlighting: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordBasedSuggestions: 'off',
                suggest: {
                    showKeywords: false,
                    preview: true,
                    showIcons: true,
                },
                inlineSuggest: {
                    enabled: true,
                    showToolbar: 'never',
                },
                fixedOverflowWidgets: true,
            }}
            onMount={handleEditorMount}
        />
    );
};
