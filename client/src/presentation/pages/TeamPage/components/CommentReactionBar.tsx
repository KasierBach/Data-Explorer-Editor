import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import type { CollaborationReactionGroup } from '@/core/services/CollaborationService';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮', '🙏', '🔥', '✅'];

interface CommentReactionBarProps {
    reactions: CollaborationReactionGroup[];
    currentUserId: string;
    disabled?: boolean;
    onToggle: (emoji: string) => void;
}

export function CommentReactionBar({
    reactions,
    currentUserId,
    disabled,
    onToggle,
}: CommentReactionBarProps) {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="flex flex-wrap items-center gap-1">
            {reactions.map((group) => {
                const mine = group.userIds.includes(currentUserId);
                return (
                    <button
                        key={group.emoji}
                        type="button"
                        disabled={disabled}
                        onClick={() => onToggle(group.emoji)}
                        title={group.users.map((user) => user.email).join(', ')}
                        className={
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ' +
                            (mine
                                ? 'border-violet-500/50 bg-violet-500/15 text-violet-600 dark:text-violet-300'
                                : 'border-border/60 bg-background/60 text-muted-foreground hover:bg-accent')
                        }
                    >
                        <span>{group.emoji}</span>
                        <span className="tabular-nums">{group.count}</span>
                    </button>
                );
            })}

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:bg-accent"
                        aria-label="Add reaction"
                    >
                        <SmilePlus className="h-3.5 w-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                    <div className="flex gap-1">
                        {QUICK_EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                    onToggle(emoji);
                                    setPickerOpen(false);
                                }}
                                className="rounded-md p-1 text-lg transition-transform hover:scale-125 hover:bg-accent"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
