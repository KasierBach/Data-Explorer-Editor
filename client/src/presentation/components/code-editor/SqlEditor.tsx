import React, { useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { createSqlCompletionProvider, type SchemaInfo } from './sqlAutocomplete';

interface SqlEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    height?: string | number;
    onMount?: (editor: any, monaco: any) => void;
    schemaInfo?: SchemaInfo;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, height = "300px", onMount, schemaInfo }) => {
    const [theme, setTheme] = React.useState<'vs-dark' | 'light'>('vs-dark');
    const disposableRef = useRef<any>(null);

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'vs-dark' : 'light');

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isDark = document.documentElement.classList.contains('dark');
                    setTheme(isDark ? 'vs-dark' : 'light');
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const monaco = useMonaco();

    // Register/update completion provider when schema info changes
    useEffect(() => {
        if (!monaco) return;

        // Dispose previous provider if any
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
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordBasedSuggestions: 'off',
                suggest: {
                    showKeywords: false, // We provide our own
                    preview: true,
                    showIcons: true,
                },
            }}
            onMount={onMount}
        />
    );
};
