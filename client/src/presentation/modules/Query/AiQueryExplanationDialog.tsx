import React, { useState } from 'react';
import {
    BookOpenText,
    Loader2,
    RotateCcw,
    Send,
    Copy,
    Check,
    Sparkles,
    Lightbulb,
    ShieldAlert,
    Zap,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Badge } from '@/presentation/components/ui/badge';
import { AiMarkdownContent } from './AiMarkdownContent';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { toast } from 'sonner';

interface AiQueryExplanationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    sql: string;
    explanation: string | null;
    isLoading: boolean;
    error: string | null;
    onRegenerate?: (customPrompt?: string) => Promise<void> | void;
}

export const AiQueryExplanationDialog: React.FC<AiQueryExplanationDialogProps> = ({
    open,
    onOpenChange,
    lang,
    sql,
    explanation,
    isLoading,
    error,
    onRegenerate,
}) => {
    const lines = sql.split('\n');
    const text = getWorkspaceText(lang).aiQueryExplanation;
    const [customPrompt, setCustomPrompt] = useState('');
    const [hasCopied, setHasCopied] = useState(false);

    const handleCopyExplanation = () => {
        if (!explanation) return;
        void navigator.clipboard.writeText(explanation);
        setHasCopied(true);
        toast.success(text.explanationCopied);
        setTimeout(() => setHasCopied(false), 2000);
    };

    const handleSendCustomPrompt = (promptToSend?: string) => {
        const queryPrompt = (promptToSend ?? customPrompt).trim();
        if (!queryPrompt && !promptToSend) return;
        if (onRegenerate) {
            void onRegenerate(queryPrompt);
        }
        setCustomPrompt('');
    };

    const quickChips = [
        { label: text.promptDetail, icon: Lightbulb, prompt: lang === 'vi' ? 'Hãy giải thích chi tiết hơn từng bước thực thi và logic của câu lệnh này.' : 'Explain the execution steps and logic in greater detail.' },
        { label: text.promptOptimize, icon: Zap, prompt: lang === 'vi' ? 'Hãy phân tích hiệu năng của câu lệnh này và đề xuất các chỉ mục (indexes) hoặc cách viết tối ưu hơn.' : 'Analyze performance and suggest indexes or optimization opportunities.' },
        { label: text.promptSecurity, icon: ShieldAlert, prompt: lang === 'vi' ? 'Hãy kiểm tra các rủi ro bảo mật, ảnh hưởng đến dữ liệu, hoặc các trường hợp biên nguy hiểm của câu lệnh này.' : 'Check for security risks, data impact, and dangerous edge cases.' },
        { label: text.promptBeginner, icon: Sparkles, prompt: lang === 'vi' ? 'Hãy giải thích thật đơn giản, dễ hiểu theo phong cách cho người mới bắt đầu học SQL.' : 'Explain simply and clearly for someone learning SQL.' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] max-w-[960px] top-[75px] sm:top-[75px] translate-y-0 max-h-[calc(100vh-100px)] h-[680px] overflow-hidden p-0 rounded-2xl shadow-2xl border border-border/80">
                <div className="flex h-full max-h-[calc(100vh-100px)] flex-col">
                    <DialogHeader className="border-b border-border/60 px-6 py-4 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-lg">
                                <BookOpenText className="h-5 w-5 text-blue-500" />
                                {text.title}
                            </DialogTitle>
                            <DialogDescription className="text-xs">{text.description}</DialogDescription>
                        </div>
                        {onRegenerate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void onRegenerate()}
                                disabled={isLoading}
                                className="h-8 px-3 text-xs gap-1.5 mr-6 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                                title={text.regenerate}
                            >
                                <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{text.regenerate}</span>
                            </Button>
                        )}
                    </DialogHeader>

                    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                        {/* SQL Query Section */}
                        <section className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {text.query}
                                </p>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                    {lines.length} lines
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                                <div className="max-h-[160px] overflow-auto">
                                    <div className="grid min-w-full grid-cols-[48px_minmax(0,1fr)] font-mono text-xs leading-6">
                                        {lines.map((line, index) => (
                                            <React.Fragment key={`${index + 1}-${line}`}>
                                                <div className="select-none border-r border-border/50 bg-muted/40 px-2.5 text-right text-[11px] text-muted-foreground">
                                                    {index + 1}
                                                </div>
                                                <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 text-foreground">
                                                    {line || '\u00A0'}
                                                </pre>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Follow-up / Custom Re-explain prompt input & Quick Chips */}
                        {onRegenerate && (
                            <section className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                    <span>{text.quickPrompts}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {quickChips.map((chip, idx) => {
                                        const Icon = chip.icon;
                                        return (
                                            <Badge
                                                key={idx}
                                                variant="outline"
                                                onClick={() => !isLoading && handleSendCustomPrompt(chip.prompt)}
                                                className="cursor-pointer hover:bg-accent hover:text-foreground text-[11px] py-1 px-2.5 gap-1.5 transition-colors border-border/70 bg-background/80"
                                            >
                                                <Icon className="w-3 h-3 text-purple-500" />
                                                {chip.label}
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSendCustomPrompt();
                                    }}
                                    className="flex items-center gap-2 mt-2"
                                >
                                    <Input
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder={text.customPromptPlaceholder}
                                        disabled={isLoading}
                                        className="h-8 text-xs bg-background flex-1"
                                    />
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={isLoading || !customPrompt.trim()}
                                        className="h-8 px-3 text-xs gap-1.5 shrink-0"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Send className="w-3.5 h-3.5" />
                                        )}
                                        <span>{text.sendCustomPrompt}</span>
                                    </Button>
                                </form>
                            </section>
                        )}

                        {/* Explanation Content */}
                        <section className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {text.explanation}
                                </p>
                                {explanation && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCopyExplanation}
                                        className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                        title={text.copyExplanation}
                                    >
                                        {hasCopied ? (
                                            <Check className="w-3 h-3 text-green-500" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                        <span className="text-[11px]">{text.copyExplanation}</span>
                                    </Button>
                                )}
                            </div>
                            <div className="min-h-[220px] rounded-xl border border-border/70 bg-background/80 p-4">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span>{text.loading}</span>
                                    </div>
                                ) : error ? (
                                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                        {error}
                                    </div>
                                ) : explanation ? (
                                    <AiMarkdownContent content={explanation} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">{text.fallback}</p>
                                )}
                            </div>
                        </section>
                    </div>

                    <DialogFooter className="border-t border-border/60 px-6 py-3 sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-8 text-xs">
                            {text.close}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

