import React, { useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useAppStore } from '@/core/services/store';
import { Loader2 } from 'lucide-react';
import { useAiGhostText } from '@/presentation/components/code-editor/useAiGhostText';

interface MqlEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    onRun?: () => void;
    height?: string | number;
}

/**
 * Monaco-based JSON editor for MQL queries.
 * Supports Ctrl+Enter to execute, Shift+Alt+F to format, and AI Ghost Text.
 */
export const MqlEditor: React.FC<MqlEditorProps> = ({ value, onChange, onRun, height = '100%' }) => {
    const [theme, setTheme] = React.useState<'vs-dark' | 'light'>('vs-dark');
    const editorRef = useRef<any>(null);
    const { activeConnectionId, activeDatabase } = useAppStore();
    
    const monaco = useMonaco();
    useAiGhostText(monaco, activeConnectionId, activeDatabase || undefined, 'json');

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'vs-dark' : 'light');

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    setTheme(document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light');
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const handleEditorMount = (editor: any, monaco: any) => {
        editorRef.current = editor;

        // Ctrl+Enter → Run query
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            onRun?.();
        });

        // Shift+Alt+F → Format JSON
        editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
            editor.getAction('editor.action.formatDocument')?.run();
        });
    };

    return (
        <Editor
            key={`mql-editor-${activeConnectionId}`}
            height={height}
            defaultLanguage="json"
            value={value}
            onChange={onChange}
            theme={theme}
            loading={
                <div className="flex flex-col items-center justify-center h-full w-full bg-background/50 gap-3 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                    <p className="text-xs font-medium uppercase tracking-widest text-green-600/80">Loading Editor...</p>
                </div>
            }
            options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                wordWrap: 'on',
                contextmenu: true,
                tabSize: 2,
                formatOnPaste: true,
                renderLineHighlight: 'gutter',
                scrollbar: { verticalScrollbarSize: 6 },
                fixedOverflowWidgets: true,
            }}
            onMount={handleEditorMount}
        />
    );
};
