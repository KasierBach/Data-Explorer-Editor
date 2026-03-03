import { ChevronRight, Home } from 'lucide-react';

interface DocBreadcrumbsProps {
    sectionTitle: string;
    itemTitle: string;
    onHomeClick: () => void;
    lang: 'vi' | 'en';
}

export function DocBreadcrumbs({ sectionTitle, itemTitle, onHomeClick, lang }: DocBreadcrumbsProps) {
    return (
        <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-6 overflow-x-auto whitespace-nowrap py-1">
            <button
                onClick={onHomeClick}
                className="hover:text-foreground transition-colors flex items-center gap-1"
            >
                <Home className="w-3 h-3" />
                {lang === 'vi' ? 'Tài liệu' : 'Docs'}
            </button>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="font-medium text-muted-foreground/60">{sectionTitle}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="font-bold text-foreground">{itemTitle}</span>
        </nav>
    );
}
