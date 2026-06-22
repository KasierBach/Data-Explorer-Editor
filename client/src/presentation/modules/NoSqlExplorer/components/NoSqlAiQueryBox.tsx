import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Wand2, Info, X, Database } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NoSqlAiQueryBoxProps {
    onGenerate: (mql: string) => void;
    currentConnectionId: string;
    currentDatabase?: string;
    collectionName?: string;
}

interface QuickPrompt {
    label: string;
    prompt: string;
}

const MUTATING_MONGO_ACTIONS = new Set([
    'insertOne',
    'insertMany',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
]);

function getMutationAction(commandText: string): string | null {
    try {
        const parsed = JSON.parse(commandText) as { action?: unknown };
        return typeof parsed.action === 'string' ? parsed.action : null;
    } catch {
        return null;
    }
}

export const NoSqlAiQueryBox: React.FC<NoSqlAiQueryBoxProps> = ({
    onGenerate,
    currentConnectionId,
    currentDatabase,
    collectionName,
}) => {
    const { lang, aiModel, aiRoutingMode, connections } = useAppStore();
    const text = getWorkspaceText(lang);
    const preferences = useAiPreferences();
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedNoSql = resolveAiSelection(preferences.nosqlModel, assistantSelection, preferences.customProviders);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeConnection = connections.find((connection) => connection.id === currentConnectionId);
    const isRedis = activeConnection?.type === 'redis';
    const isReadOnly = !!activeConnection?.readOnly;
    const commandLabel = isRedis ? text.noSqlAi.redisCommandLabel : text.noSqlAi.mqlCommandLabel;
    const generatorLabel = isRedis ? text.noSqlAi.redisGeneratorTitle : text.noSqlAi.mqlGeneratorTitle;
    const collapsedPrompt = isRedis
        ? text.noSqlAi.collapsedPromptRedis
        : text.noSqlAi.collapsedPromptMongo;
    const expandedPlaceholder = isRedis
        ? text.noSqlAi.expandedPlaceholderRedis
        : text.noSqlAi.expandedPlaceholderMongo;
    const capabilityTags = isRedis
        ? ['scan', 'get', 'set', 'del']
        : isReadOnly
            ? ['find', 'aggregate']
            : ['find', 'aggregate', 'update', 'delete'];
    const capabilityNote = isRedis
        ? text.noSqlAi.capabilityNoteRedis
        : isReadOnly
            ? text.noSqlAi.capabilityNoteReadOnly
            : text.noSqlAi.capabilityNoteMutable;
    const runHotkeyLabel = navigator.platform.toUpperCase().indexOf('MAC') >= 0
        ? text.noSqlAi.runHotkey.replace('CTRL', 'CMD')
        : text.noSqlAi.runHotkey;
    const quickPrompts: QuickPrompt[] = isRedis
        ? [
            {
                label: text.noSqlAi.quickScanSessions,
                prompt: text.noSqlAi.quickScanSessionsPrompt,
            },
            {
                label: text.noSqlAi.quickInspectTtl,
                prompt: text.noSqlAi.quickInspectTtlPrompt,
            },
            {
                label: text.noSqlAi.quickDeleteOldKey,
                prompt: text.noSqlAi.quickDeleteOldKeyPrompt,
            },
        ]
        : isReadOnly
            ? [
                {
                    label: text.noSqlAi.quickTopCategories,
                    prompt: text.noSqlAi.quickTopCategoriesPrompt,
                },
                {
                    label: text.noSqlAi.quickLatestOrders,
                    prompt: text.noSqlAi.quickLatestOrdersPrompt,
                },
                {
                    label: text.noSqlAi.quickSamplePipeline,
                    prompt: text.noSqlAi.quickSamplePipelinePrompt,
                },
            ]
            : [
                {
                    label: text.noSqlAi.quickTopCategories,
                    prompt: text.noSqlAi.quickTopCategoriesPrompt,
                },
                {
                    label: text.noSqlAi.quickUpdateStatus,
                    prompt: text.noSqlAi.quickUpdateStatusPrompt,
                },
                {
                    label: text.noSqlAi.quickDeleteOldLogs,
                    prompt: text.noSqlAi.quickDeleteOldLogsPrompt,
                },
            ];

    const handleApplyQuickPrompt = (prompt: string) => {
        setQuery(prompt);
        textareaRef.current?.focus();
    };

    const handleGenerate = async () => {
        if (!query.trim() || !currentConnectionId) return;

        setIsLoading(true);
        setExplanation(null);
        try {
            const result = await apiService.post<{ sql: string, explanation: string }>('/ai/nlp-to-sql', {
                connectionId: currentConnectionId,
                database: currentDatabase,
                prompt: collectionName && !isRedis
                    ? `For collection "${collectionName}": ${query}`
                    : query,
                model: resolvedNoSql.model,
                mode: 'fast',
                routingMode: aiRoutingMode,
                providerOverride: resolvedNoSql.providerOverride,
            });

            const generatedCommand = result.sql?.trim() || '';
            const mutationAction = getMutationAction(generatedCommand);
            const explicitMutationIntent = /\b(insert|update|delete|remove|drop|truncate|set|unset|inc|push|pull|expire|persist|rename|flush)\b/i.test(query);
            const isMutatingCommand = !!mutationAction && MUTATING_MONGO_ACTIONS.has(mutationAction);
            const isTooLong = generatedCommand.length > 1200 || generatedCommand.split('\n').length > 20;

            if (generatedCommand && !isRedis && !explicitMutationIntent && (isMutatingCommand || isTooLong)) {
                const safeguardExplanation = text.noSqlAi.safeguardExplanation;
                setExplanation(result.explanation
                    ? `${result.explanation} ${safeguardExplanation}`
                    : safeguardExplanation);
                toast.warning(text.noSqlAi.safeguardWarning);
            } else if (generatedCommand) {
                onGenerate(generatedCommand);
                setExplanation(result.explanation);
                toast.success(text.noSqlAi.generatedSuccess(commandLabel));
            } else {
                setExplanation(result.explanation);
                toast.error(text.noSqlAi.generatedFailure(commandLabel));
            }
        } catch (err) {
            console.error('NLP to NoSQL command error:', err);
            toast.error(text.noSqlAi.requestFailed);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleGenerate();
        } else if (e.key === 'Escape') {
            setIsExpanded(false);
        }
    };

    return (
        <div className={cn(
            'relative group transition-all duration-300 ease-in-out border border-white/5 rounded-2xl overflow-hidden mb-0',
            isExpanded ? 'bg-background/80 shadow-2xl ring-1 ring-green-500/20' : 'bg-muted/30 hover:bg-muted/50',
        )}>
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-1">
                {!isExpanded ? (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground transition-all"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-green-400" />
                            </div>
                            <span className="font-medium opacity-70">
                                {collapsedPrompt}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="hidden sm:flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-bold opacity-50 uppercase tracking-tighter text-green-400">
                                {text.noSqlAi.badge}
                            </div>
                            <Wand2 className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity text-green-400" />
                        </div>
                    </button>
                ) : (
                    <div className="p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center space-x-2">
                                <Sparkles className="w-3.5 h-3.5 text-green-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                    {generatorLabel}
                                </h4>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="relative">
                            <Textarea
                                ref={textareaRef}
                                autoFocus
                                placeholder={expandedPlaceholder}
                                className="min-h-[100px] bg-muted/40 border-none ring-1 ring-white/5 focus-visible:ring-green-500/30 text-sm resize-none pr-10 rounded-xl leading-relaxed"
                                value={query}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="absolute right-3 bottom-3 flex flex-col items-end space-y-2">
                                <span className={cn(
                                    'text-[9px] font-bold py-0.5 px-1.5 rounded transition-all tracking-tighter',
                                    query.length > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'text-muted-foreground/20 italic',
                                )}>
                                    {runHotkeyLabel}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {capabilityTags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-green-500/20 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-green-300"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-green-100/75">
                                {capabilityNote}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">
                                    {text.noSqlAi.shortcutTitle}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">
                                    {text.noSqlAi.shortcutHint}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {quickPrompts.map((item) => (
                                    <button
                                        key={item.label}
                                        type="button"
                                        onClick={() => handleApplyQuickPrompt(item.prompt)}
                                        className="rounded-full border border-white/10 bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-green-500/30 hover:text-green-300"
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {explanation && (
                            <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 flex space-x-3 animate-in slide-in-from-top-2">
                                <div className="mt-0.5">
                                    <Info className="w-3.5 h-3.5 text-green-400" />
                                </div>
                                <p className="text-[11px] leading-relaxed text-green-200/70 italic">
                                    {explanation}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                                    <Database className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                                        {isRedis ? 'DB' : 'COLL'}: {collectionName || currentDatabase || text.noSqlAi.defaultCollection}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 rounded-lg text-xs"
                                    onClick={() => setIsExpanded(false)}
                                >
                                    {text.noSqlAi.cancel}
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 px-4 rounded-lg text-xs bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20 space-x-2 text-white"
                                    disabled={isLoading || !query.trim()}
                                    onClick={handleGenerate}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{text.noSqlAi.generateCommand(commandLabel)}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


