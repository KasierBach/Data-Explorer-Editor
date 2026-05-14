import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Wand2, Calculator, Info, X } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AiQueryBoxProps {
    onGenerate: (sql: string) => void;
    currentConnectionId: string;
    currentDatabase?: string;
}

export const AiQueryBox: React.FC<AiQueryBoxProps> = ({ onGenerate, currentConnectionId, currentDatabase }) => {
    const { lang } = useAppStore();
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleGenerate = async () => {
        if (!query.trim() || !currentConnectionId) return;

        setIsLoading(true);
        setExplanation(null);
        try {
            const result = await apiService.post<{ sql: string, explanation: string }>('/ai/nlp-to-sql', {
                connectionId: currentConnectionId,
                database: currentDatabase,
                prompt: query
            });

            const generatedSql = result.sql?.trim() || '';
            const explicitSchemaIntent = /\b(create|alter|drop|truncate|migrate|migration|schema|table|column|ddl)\b/i.test(query);
            const isSchemaChangingSql = /^\s*(create|alter|drop|truncate|insert|update|delete|replace|rename)\s+/i.test(generatedSql);
            const isTooLong = generatedSql.length > 500 || generatedSql.split('\n').length > 6;

            if (generatedSql && !explicitSchemaIntent && (isSchemaChangingSql || isTooLong)) {
                setExplanation(result.explanation || (lang === 'vi'
                    ? 'Kết quả AI quá dài hoặc có thay đổi schema nên chưa được chèn tự động.'
                    : 'The AI result is too long or schema-changing, so it was not inserted automatically.'));
                toast.warning(lang === 'vi'
                    ? 'Kết quả AI bị từ chối chèn tự động do thao tác ghi/cấu trúc hoặc quá dài'
                    : 'AI result was not inserted due to DML/schema modifications or excessive length');
            } else if (generatedSql) {
                onGenerate(generatedSql);
                setExplanation(result.explanation);
                toast.success(lang === 'vi' ? 'Đã sinh mã SQL thành công!' : 'SQL generated successfully!');
                // Don't close immediately so user can see explanation
            } else {
                setExplanation(result.explanation);
                toast.error(lang === 'vi' ? 'Không thể sinh SQL cho yêu cầu này.' : 'Could not generate SQL for this request.');
            }
        } catch (err) {
            console.error('NLP to SQL error:', err);
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
                                {lang === 'vi' ? "Gõ tiếng Việt để sinh SQL (vd: 10 khách hàng mới nhất...)" : "Type natural language to generate SQL..."}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                             <div className="hidden sm:flex items-center px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-bold opacity-50 uppercase tracking-tighter">
                                AI POWERED
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
                                    AI SQL Generator
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
                                placeholder={lang === 'vi' ? "Mô tả yêu cầu của bạn bằng tiếng Việt hoặc tiếng Anh..." : "Describe what you want to query in natural language..."}
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
                                    CTRL + ENTER TO RUN
                                </span>
                            </div>
                        </div>

                        {explanation && (
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex space-x-3 animate-in slide-in-from-top-2">
                                <div className="mt-0.5">
                                    <Info className="w-3.5 h-3.5 text-blue-400" />
                                </div>
                                <p className="text-[11px] leading-relaxed text-blue-200/70 italic">
                                    {explanation}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                                    <Calculator className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none">RAG Context: ON</span>
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
                                    className="h-8 px-4 rounded-lg text-xs bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20 space-x-2"
                                    disabled={isLoading || !query.trim()}
                                    onClick={handleGenerate}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>{lang === 'vi' ? 'Sinh SQL' : 'Generate SQL'}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
