import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/presentation/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { PresenceEntry } from '@/core/services/PresenceService';

function getInitials(entry: PresenceEntry) {
    const fullName = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
    const source = fullName || entry.username || entry.email || '?';
    return source
        .split(/\s+/)
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function PresenceBadge({
    entries,
    isLoading = false,
    emptyLabel = 'No one active',
    label = 'Active now',
    className,
}: {
    entries: PresenceEntry[];
    isLoading?: boolean;
    emptyLabel?: string;
    label?: string;
    className?: string;
}) {
    const visibleEntries = entries.slice(0, 3);

    return (
        <div className={cn(
            'inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1 shadow-sm backdrop-blur',
            className,
        )}>
            <div className="flex items-center">
                {isLoading ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    </div>
                ) : visibleEntries.length > 0 ? (
                    <div className="flex -space-x-1.5">
                        {visibleEntries.map((entry) => (
                            <Avatar key={entry.id} className="h-6 w-6 border border-background">
                                {entry.avatarUrl && <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />}
                                <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                                    {getInitials(entry)}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                        0
                    </div>
                )}
            </div>

            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="truncate text-[11px] font-medium text-foreground/90">
                    {isLoading
                        ? 'Syncing...'
                        : entries.length > 0
                            ? `${entries.slice(0, 2).map((entry) => entry.displayName).join(', ')}${entries.length > 2 ? ` +${entries.length - 2}` : ''}`
                            : emptyLabel}
                </div>
            </div>
        </div>
    );
}
