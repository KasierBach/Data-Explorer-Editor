import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDocsText, getLocalizedDocTitle } from './docsI18n';

interface DocNavigationProps {
  prev?: { id: string; title: string; titleEn?: string };
  next?: { id: string; title: string; titleEn?: string };
  onNavigate: (id: string) => void;
  lang: 'vi' | 'en';
}

export function DocNavigation({ prev, next, onNavigate, lang }: DocNavigationProps) {
  const text = getDocsText(lang);

  return (
    <div className="mt-16 grid grid-cols-2 gap-4 border-t border-border/50 pt-8">
      {prev ? (
        <button
          onClick={() => onNavigate(prev.id)}
          className="group flex flex-col items-start rounded-2xl border bg-card/50 p-4 text-left transition-all hover:bg-muted/50"
        >
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <ChevronLeft className="h-3 w-3" /> {text.previous}
          </span>
          <span className="text-sm font-bold transition-colors group-hover:text-primary">
            {getLocalizedDocTitle(lang, prev)}
          </span>
        </button>
      ) : (
        <div />
      )}

      {next ? (
        <button
          onClick={() => onNavigate(next.id)}
          className="group flex flex-col items-end rounded-2xl border bg-card/50 p-4 text-right transition-all hover:bg-muted/50"
        >
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {text.next} <ChevronRight className="h-3 w-3" />
          </span>
          <span className="text-sm font-bold transition-colors group-hover:text-primary">
            {getLocalizedDocTitle(lang, next)}
          </span>
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}
