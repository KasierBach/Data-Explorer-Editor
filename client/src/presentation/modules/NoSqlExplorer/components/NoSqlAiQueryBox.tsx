import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Wand2, Info, X, Database } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NoSqlAiQueryBoxProps {
    onGenerate: (mql: string) => void;
    currentConnectionId: string;
    currentDatabase?: string;
    collectionName?: string;
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
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeConnection = connections.find((connection) => connection.id === currentConnectionId);
    const isRedis = activeConnection?.type === 'redis';
    const commandLabel = isRedis ? 'Redis Command' : 'MQL';
    const generatorLabel = isRedis ? 'AI Redis Generator' : 'AI MQL Generator';
    const collapsedPrompt = isRedis
        ? (lang === 'vi'
            ? 'Gõ yêu cầu để sinh lệnh Redis...'
            : 'Type natural language to generate a Redis command...')
        : (lang === 'vi'
            ? 'Gõ yêu cầu để sinh MQL (vd: lọc các đơn hàng > 500k...)'
            : 'Type natural language to generate MQL...');
    const expandedPlaceholder = isRedis
        ? (lang === 'vi'
            ? 'Mô tả lệnh Redis bạn cần (vd: quét session:*, lấy key user:123)...'
            : 'Describe the Redis command you need...')
        : (lang === 'vi'
            ? 'Mô tả yêu cầu truy vấn MongoDB của bạn...'
            : 'Describe your MongoDB query request...');

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
                model: aiModel,
                mode: 'fast',
                routingMode: aiRoutingMode,
            });

            const generatedCommand = result.sql?.trim() || '';
            const mutationAction = getMutationAction(generatedCommand);
            const explicitMutationIntent = /\b(insert|update|delete|remove|drop|truncate|set|unset|inc|push|pull|expire|persist|rename|flush)\b/i.test(query);
            const isMutatingCommand = !!mutationAction && MUTATING_MONGO_ACTIONS.has(mutationAction);
            const isTooLong = generatedCommand.length > 1200 || generatedCommand.split('\n').length > 20;

            if (generatedCommand && !isRedis && !explicitMutationIntent && (isMutatingCommand || isTooLong)) {
                setExplanation(result.explanation || (lang === 'vi'
                    ? 'Kết quả AI có thay đổi dữ liệu hoặc quá dài nên chưa được chèn tự động.'
                    : 'The AI result mutates data or is too large, so it was not inserted automatically.'));
                toast.warning(lang === 'vi'
                    ? 'Lệnh NoSQL chưa được chèn tự động vì có thể ghi dữ liệu hoặc quá dài'
                    : 'NoSQL command was not inserted automatically because it may write data or is too large');
            } else if (generatedCommand) {
                onGenerate(generatedCommand);
                setExplanation(result.explanation);
                toast.success(lang === 'vi'
                    ? `Đã sinh ${commandLabel} thành công!`
                    : `${commandLabel} generated successfully!`);
            } else {
                setExplanation(result.explanation);
                toast.error(lang === 'vi'
                    ? `Không thể sinh ${commandLabel} cho yêu cầu này.`
                    : `Could not generate ${commandLabel} for this request.`);
            }
        } catch (err) {
            console.error('NLP to NoSQL command error:', err);
            toast.error(lang === 'vi' ? 'Lỗi khi gọi AI.' : 'AI request failed.');
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
                                NOSQL AI
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
                                    {lang === 'vi'
                                        ? (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'CMD + ENTER ĐỂ CHẠY' : 'CTRL + ENTER ĐỂ CHẠY')
                                        : (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'CMD + ENTER TO RUN' : 'CTRL + ENTER TO RUN')}
                                </span>
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
                                        {isRedis ? 'DB' : 'COLL'}: {collectionName || currentDatabase || (lang === 'vi' ? 'Mặc định' : 'Default')}
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
                                    {lang === 'vi' ? 'Đóng' : 'Cancel'}
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
                                    <span>{lang === 'vi' ? `Sinh ${commandLabel}` : `Generate ${commandLabel}`}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
