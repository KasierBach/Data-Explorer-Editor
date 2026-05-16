import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Type Definitions ───

interface JsonTreeViewProps {
    data: unknown;
    initialExpanded?: boolean;
    className?: string;
}

interface JsonNodeProps {
    label: string;
    value: unknown;
    depth: number;
    isLast: boolean;
    defaultExpanded?: boolean;
}

// ─── Helper: Determine Value Display ───

const getValueColor = (value: unknown): string => {
    if (value === null || value === undefined) return 'text-red-400';
    if (typeof value === 'string') return 'text-amber-500 dark:text-amber-400';
    if (typeof value === 'number') return 'text-blue-500 dark:text-blue-400';
    if (typeof value === 'boolean') return 'text-purple-500 dark:text-purple-400';
    return 'text-foreground';
};

const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
};

const isExpandable = (value: unknown): boolean => {
    return value !== null && typeof value === 'object';
};

const getObjectEntries = (value: unknown): [string, unknown][] => (
    isExpandable(value) ? Object.entries(value as Record<string, unknown>) : []
);

// ─── JsonNode (Recursive) ───

const JsonNode: React.FC<JsonNodeProps> = React.memo(({ label, value, depth, isLast, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || depth < 1);
    const [copied, setCopied] = useState(false);

    const expandable = isExpandable(value);
    const isArray = Array.isArray(value);
    const entries = expandable ? getObjectEntries(value) : [];
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';
    const childCount = entries.length;

    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(value, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [value]);

    if (!expandable) {
        return (
            <div className="flex items-center gap-1 group/node hover:bg-muted/40 rounded px-1 -mx-1 transition-colors" style={{ paddingLeft: `${depth * 20}px` }}>
                <span className="w-4" />
                <span className="text-green-600 dark:text-green-400 font-medium">{label}</span>
                <span className="text-muted-foreground">:</span>
                <span className={cn("ml-1", getValueColor(value))}>{formatValue(value)}</span>
                {!isLast && <span className="text-muted-foreground">,</span>}
                <button 
                    onClick={handleCopy}
                    className="ml-auto opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    title="Copy value"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
            </div>
        );
    }

    return (
        <div>
            <div 
                className="flex items-center gap-1 cursor-pointer group/node hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
                style={{ paddingLeft: `${depth * 20}px` }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded 
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> 
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                }
                <span className="text-green-600 dark:text-green-400 font-medium">{label}</span>
                <span className="text-muted-foreground">:</span>
                <span className="text-muted-foreground ml-1">{bracketOpen}</span>
                {!isExpanded && (
                    <span className="text-muted-foreground/60 text-xs ml-1">
                        {childCount} {isArray ? (childCount === 1 ? 'item' : 'items') : (childCount === 1 ? 'key' : 'keys')}
                        <span className="ml-1">{bracketClose}</span>
                        {!isLast && ','}
                    </span>
                )}
                <button 
                    onClick={handleCopy}
                    className="ml-auto opacity-0 group-hover/node:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    title="Copy object"
                >
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                </button>
            </div>
            {isExpanded && (
                <div>
                    {entries.map(([key, val], idx) => (
                        <JsonNode 
                            key={key} 
                            label={isArray ? String(idx) : key} 
                            value={val} 
                            depth={depth + 1}
                            isLast={idx === entries.length - 1}
                        />
                    ))}
                    <div style={{ paddingLeft: `${depth * 20}px` }} className="text-muted-foreground pl-5">
                        {bracketClose}{!isLast && ','}
                    </div>
                </div>
            )}
        </div>
    );
});

JsonNode.displayName = 'JsonNode';

// ─── JsonTreeView (Public Component) ───

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({ data, initialExpanded = true, className }) => {
    const isArray = Array.isArray(data);
    const entries = getObjectEntries(data);

    return (
        <div className={cn("font-mono text-[13px] leading-[1.8] select-text", className)}>
            <span className="text-muted-foreground">{isArray ? '[' : '{'}</span>
            {entries.map(([key, val], idx) => (
                <JsonNode 
                    key={key} 
                    label={isArray ? String(idx) : key}
                    value={val} 
                    depth={1}
                    isLast={idx === entries.length - 1}
                    defaultExpanded={initialExpanded}
                />
            ))}
            <span className="text-muted-foreground">{isArray ? ']' : '}'}</span>
        </div>
    );
};
