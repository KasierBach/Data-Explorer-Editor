import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Wand2, Calculator, Info, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AiQueryBoxProps {
    onGenerate: (sql: string) => void;
    currentConnectionId: string;
    currentDatabase?: string;
}

export const AiQueryBox: React.FC<AiQueryBoxProps> = ({ onGenerate, currentConnectionId, currentDatabase }) => {
    const { lang, aiModel, aiRoutingMode } = useAppStore();
    const text = getWorkspaceText(lang);
    const preferences = useAiPreferences();
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedSql = resolveAiSelection(preferences.sqlModel, assistantSelection, preferences.customProviders);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [pendingSql, setPendingSql] = useState<string | null>(null);
    const [generationId, setGenerationId] = useState<string | null>(null);
    const [feedbackRating, setFeedbackRating] = useState<'up' | 'down' | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleGenerate = async () => {
        if (!query.trim() || !currentConnectionId) return;

        setIsLoading(true);
        setExplanation(null);
        setPendingSql(null);
        setGenerationId(null);
        setFeedbackRating(null);
        try {
            const result = await apiService.post<{ sql: string, explanation: string, generationId?: string }>('/ai/nlp-to-sql', {
                connectionId: currentConnectionId,
                database: currentDatabase,
                prompt: query,
                model: resolvedSql.model,
                mode: 'fast',
                routingMode: aiRoutingMode,
                providerOverride: resolvedSql.providerOverride,
            });

            const generatedSql = result.sql?.trim() || '';
            setGenerationId(result.generationId || null);
            const explicitSchemaIntent = /\b(create|alter|drop|truncate|migrate|migration|schema|table|column|ddl)\b/i.test(query);
            const isSchemaChangingSql = /^\s*(create|alter|drop|truncate|insert|update|delete|replace|rename)\s+/i.test(generatedSql);
            const isTooLong = generatedSql.length > 500 || generatedSql.split('\n').length > 6;

            if (generatedSql && !explicitSchemaIntent && (isSchemaChangingSql || isTooLong)) {
                setPendingSql(generatedSql);
                setExplanation(result.explanation || text.aiQuery.autoInsertSkipped);
                toast.warning(text.aiQuery.autoInsertWarning);
            } else if (generatedSql) {
                onGenerate(generatedSql);
                setExplanation(result.explanation);
                toast.success(text.aiQuery.generatedSuccess);
                // Don't close immediately so user can see explanation
            } else {
                setExplanation(result.explanation);
                toast.error(text.aiQuery.generatedFailure);
            }
        } catch (err) {
            console.error('NLP to SQL error:', err);
            toast.error(text.aiQuery.requestFailed);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeedback = async (rating: 'up' | 'down') => {
        if (!generationId || feedbackRating) return;

        try {
            await apiService.post('/ai/sql-feedback', { generationId, rating });
            setFeedbackRating(rating);
            toast.success(text.aiQuery.feedbackThanks);
        } catch {
            toast.error(text.aiQuery.feedbackFailed);
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
            "relative group transition-all duration-300 ease-in-out border border-white/5 rounded-2xl overflow-hidden mb-4",
            isExpanded ? "bg-background/80 shadow-2xl ring-1 ring-blue-500/20" : "bg-muted/30 hover:bg-muted/50"
        )}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative p-1">
                {!isExpanded ? (
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground transition-all"
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="font-medium opacity-70">
                                {text.aiQuery.collapsedPrompt}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                             <div className="hidden sm:flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-bold opacity-50 uppercase tracking-tighter">
                                {text.aiQuery.badge}
                             </div>
                             <Wand2 className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </button>
                ) : (
                    <div className="p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center space-x-2">
                                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                    {text.aiQuery.title}
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
                                placeholder={text.aiQuery.expandedPlaceholder}
                                className="min-h-[100px] bg-muted/40 border-none ring-1 ring-white/5 focus-visible:ring-blue-500/30 text-sm resize-none pr-10 rounded-xl leading-relaxed"
                                value={query}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="absolute right-3 bottom-3 flex flex-col items-end space-y-2">
                                <span className={cn(
                                    "text-[9px] font-bold py-0.5 px-1.5 rounded transition-all tracking-tighter",
                                    query.length > 0 ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" : "text-muted-foreground/20 italic"
                                )}>
                                    {text.aiQuery.hotkey}
                                </span>
                            </div>
                        </div>

                        {explanation && (
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex space-x-3">
                                <div className="mt-0.5">
                                    <Info className="w-3.5 h-3.5 text-blue-400" />
                                </div>
                                <p className="text-[11px] leading-relaxed text-blue-200/70 italic">
                                    {explanation}
                                </p>
                                </div>
                                {generationId && (
                                    <div className="flex items-center justify-between border-t border-blue-500/10 pt-2">
                                        <span className="text-[10px] text-muted-foreground">{text.aiQuery.feedbackQuestion}</span>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={Boolean(feedbackRating)} aria-label={text.aiQuery.feedbackUp} onClick={() => handleFeedback('up')}>
                                                <ThumbsUp className={cn('h-3.5 w-3.5', feedbackRating === 'up' && 'text-emerald-400')} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={Boolean(feedbackRating)} aria-label={text.aiQuery.feedbackDown} onClick={() => handleFeedback('down')}>
                                                <ThumbsDown className={cn('h-3.5 w-3.5', feedbackRating === 'down' && 'text-red-400')} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {pendingSql && (
                            <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                <div>
                                    <p className="text-xs font-semibold text-amber-300">{text.aiQuery.previewTitle}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{text.aiQuery.previewHint}</p>
                                </div>
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-xs text-foreground">{pendingSql}</pre>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setPendingSql(null)}>
                                        {text.aiQuery.discardPreview}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            onGenerate(pendingSql);
                                            setPendingSql(null);
                                            toast.success(text.aiQuery.generatedSuccess);
                                        }}
                                    >
                                        {text.aiQuery.applyPreview}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                                    <Calculator className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{text.aiQuery.contextOn}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-3 rounded-lg text-xs"
                                    onClick={() => setIsExpanded(false)}
                                >
                                    {text.aiQuery.cancel}
                                </Button>
                                <Button 
                                    size="sm" 
                                    className="h-8 px-4 rounded-lg text-xs bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 space-x-2"
                                    disabled={isLoading || !query.trim()}
                                    onClick={handleGenerate}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{text.aiQuery.generate}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


