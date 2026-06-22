import React from 'react';
import { BookOpenText, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { AiMarkdownContent } from './AiMarkdownContent';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface AiQueryExplanationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang: 'vi' | 'en';
    sql: string;
    explanation: string | null;
    isLoading: boolean;
    error: string | null;
}

export const AiQueryExplanationDialog: React.FC<AiQueryExplanationDialogProps> = ({
    open,
    onOpenChange,
    lang,
    sql,
    explanation,
    isLoading,
    error,
}) => {
    const lines = sql.split('\n');
    const text = getWorkspaceText(lang).aiQueryExplanation;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-8rem)] overflow-hidden p-0 sm:top-[calc(50%+0.75rem)] sm:max-w-5xl">
                <div className="flex max-h-[calc(100dvh-8rem)] flex-col">
                    <DialogHeader className="border-b border-border/60 px-6 py-5">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <BookOpenText className="h-5 w-5 text-blue-500" />
                            {text.title}
                        </DialogTitle>
                        <DialogDescription>{text.description}</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                        <section className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {text.query}
                            </p>
                            <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
                                <div className="max-h-[260px] overflow-auto">
                                    <div className="grid min-w-full grid-cols-[56px_minmax(0,1fr)] font-mono text-sm leading-7">
                                        {lines.map((line, index) => (
                                            <React.Fragment key={`${index + 1}-${line}`}>
                                                <div className="select-none border-r border-border/50 bg-muted/40 px-3 text-right text-xs text-muted-foreground">
                                                    {index + 1}
                                                </div>
                                                <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 text-foreground">
                                                    {line || '\u00A0'}
                                                </pre>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {text.explanation}
                            </p>
                            <div className="min-h-[280px] rounded-2xl border border-border/70 bg-background/80 p-5">
                                {isLoading ? (
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
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

                    <DialogFooter className="border-t border-border/60 px-6 py-4 sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {text.close}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};
