import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DocNavigationProps {
    prev?: { id: string; title: string };
    next?: { id: string; title: string };
    onNavigate: (id: string) => void;
}

export function DocNavigation({ prev, next, onNavigate }: DocNavigationProps) {
    return (
        <div className="grid grid-cols-2 gap-4 mt-16 pt-8 border-t border-border/50">
            {prev ? (
                <button
                    onClick={() => onNavigate(prev.id)}
                    className="flex flex-col items-start p-4 rounded-2xl border bg-card/50 hover:bg-muted/50 transition-all text-left group"
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                        <ChevronLeft className="w-3 h-3" /> Previous
                    </span>
                    <span className="text-sm font-bold group-hover:text-primary transition-colors">{prev.title}</span>
                </button>
            ) : <div />}

            {next ? (
                <button
                    onClick={() => onNavigate(next.id)}
                    className="flex flex-col items-end p-4 rounded-2xl border bg-card/50 hover:bg-muted/50 transition-all text-right group"
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                        Next <ChevronRight className="w-3 h-3" />
                    </span>
                    <span className="text-sm font-bold group-hover:text-primary transition-colors">{next.title}</span>
                </button>
            ) : <div />}
        </div>
    );
}
