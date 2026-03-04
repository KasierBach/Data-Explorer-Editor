import React from 'react';
import { Code } from 'lucide-react';

interface CodeBlockProps {
    title?: string;
    children: React.ReactNode;
}

export function CodeBlock({ title, children }: CodeBlockProps) {
    return (
        <div className="bg-slate-950 p-6 rounded-2xl border shadow-2xl font-mono text-sm text-slate-300 overflow-x-auto">
            {title && (
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-widest">{title}</span>
                    <Code className="w-4 h-4 text-slate-500" />
                </div>
            )}
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

export function CodeComment({ children }: { children: React.ReactNode }) {
    return <p className="text-emerald-500"># {children}</p>;
}

export function CodeLine({ children }: { children: React.ReactNode }) {
    return <p>{children}</p>;
}

export function CodeWarning({ children }: { children: React.ReactNode }) {
    return <p className="text-orange-400"># {children}</p>;
}
