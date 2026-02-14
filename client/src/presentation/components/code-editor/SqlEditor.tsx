import React, { useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

interface SqlEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    height?: string | number;
    onMount?: (editor: any, monaco: any) => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, height = "300px", onMount }) => {
    // We need to know the current theme (light/dark)
    // For now, let's assume we can detect it from the html class or a context
    // If using shadcn/ui next-themes, we might use useTheme
    const [theme, setTheme] = React.useState<'vs-dark' | 'light'>('vs-dark');

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'vs-dark' : 'light');

        // Observer for theme changes if needed
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

    useEffect(() => {
        if (monaco) {
            // Configure SQL formatting or other options here
            // monaco.languages.registerCompletionItemProvider('sql', ...);
        }
    }, [monaco]);

    return (
        <Editor
            height={height}
            defaultLanguage="sql"
            value={value}
            onChange={onChange}
            theme={theme}
            options={{
                minimap: { enabled: false }, // Save space
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                wordWrap: 'on',
            }}
            onMount={onMount}
        />
    );
};
