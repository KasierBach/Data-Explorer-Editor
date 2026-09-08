import { useMemo, useRef, useState } from 'react';
import { Paperclip, Smile, X, FileText } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/presentation/components/ui/popover';
import { useAppStore } from '@/core/services/store';

export interface ComposerMember {
    userId: string;
    email: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
}

/** Best short handle for @-mentions: username, then first name, then email. */
export function mentionHandle(member: ComposerMember): string {
    return member.username || member.firstName || member.email;
}

const QUICK_EMOJIS = [
    '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉',
    '🔥', '✅', '❌', '🙏', '😮', '😢', '🚀', '💡',
];

const ALLOWED_ATTACHMENT_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
];

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_TOTAL = 2_000_000;

interface CommentComposerProps {
    value: string;
    onChange: (value: string) => void;
    members: ComposerMember[];
    attachments: string[];
    onAttachmentsChange: (attachments: string[]) => void;
    placeholder: string;
    minRows?: number;
    disabled?: boolean;
    submitLabel: string;
    cancelLabel?: string;
    onSubmit: () => void;
    onCancel?: () => void;
}

export function CommentComposer({
    value,
    onChange,
    members,
    attachments,
    onAttachmentsChange,
    placeholder,
    minRows = 3,
    disabled,
    submitLabel,
    cancelLabel,
    onSubmit,
    onCancel,
}: CommentComposerProps) {
    const { lang } = useAppStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionStart, setMentionStart] = useState(0);
    const [emojiOpen, setEmojiOpen] = useState(false);

    const isVi = lang === 'vi';

    const mentionMatches = useMemo(() => {
        if (mentionQuery === null) return [];
        const query = mentionQuery.toLowerCase();
        return members
            .filter((member) => {
                const label = member.email.toLowerCase();
                const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim().toLowerCase();
                return label.includes(query) || (name && name.includes(query));
            })
            .slice(0, 6);
    }, [mentionQuery, members]);

    const handleTextChange = (next: string, cursorPos?: number) => {
        onChange(next);
        const caret = cursorPos ?? next.length;

        // Detect an active @mention token ending at the caret.
        const uptoCaret = next.slice(0, caret);
        const match = /@([\w.@-]*)$/.exec(uptoCaret);
        if (match) {
            setMentionQuery(match[1]);
            setMentionStart(caret - match[0].length);
        } else {
            setMentionQuery(null);
        }
    };

    const applyMention = (member: ComposerMember) => {
        if (mentionQuery === null || !textareaRef.current) return;
        const caret = textareaRef.current.selectionStart ?? value.length;
        const before = value.slice(0, mentionStart);
        const after = value.slice(caret);
        const handle = mentionHandle(member);
        const next = `${before}@${handle} ${after}`;
        setMentionQuery(null);
        onChange(next);
        requestAnimationFrame(() => {
            const pos = before.length + handle.length + 2;
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(pos, pos);
        });
    };

    const insertEmoji = (emoji: string) => {
        if (!textareaRef.current) {
            onChange(value + emoji);
            return;
        }
        const caret = textareaRef.current.selectionStart ?? value.length;
        const next = value.slice(0, caret) + emoji + value.slice(caret);
        handleTextChange(next, caret + emoji.length);
        textareaRef.current.focus();
    };

    const pickAttachments = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const next: string[] = [];
        let total = attachments.reduce((sum, item) => sum + item.length, 0);

        for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS - attachments.length)) {
            if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
                continue;
            }
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            total += dataUrl.length;
            if (total > MAX_ATTACHMENT_TOTAL) break;
            next.push(dataUrl);
        }

        if (next.length > 0) {
            onAttachmentsChange([...attachments, ...next].slice(0, MAX_ATTACHMENTS));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="relative space-y-2">
            <textarea
                ref={textareaRef}
                className="min-h w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                style={{ minHeight: `${minRows * 1.5}rem` }}
                placeholder={placeholder}
                value={value}
                disabled={disabled}
                onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
                onKeyDown={(e) => {
                    if (mentionMatches.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                        e.preventDefault();
                        applyMention(mentionMatches[0]);
                    }
                }}
            />

            {mentionQuery !== null && mentionMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-md border bg-popover shadow-lg">
                    {mentionMatches.map((member) => (
                        <button
                            key={member.userId}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                applyMention(member);
                            }}
                        >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                                {(member.firstName || member.email)[0]?.toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                                {member.firstName || member.lastName
                                    ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
                                    : member.email}
                                <span className="block text-[10px] text-muted-foreground">{member.email}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((item, index) => (
                        <div key={index} className="relative">
                            {/^data:image\//.test(item) ? (
                                <img src={item} alt="preview" className="h-14 w-14 rounded-md border object-cover" />
                            ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-background">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => onAttachmentsChange(attachments.filter((_, i) => i !== index))}
                                className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                                aria-label="Remove attachment"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                aria-label="Insert emoji"
                            >
                                <Smile className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                            <div className="grid grid-cols-8 gap-1">
                                {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => insertEmoji(emoji)}
                                        className="rounded-md p-1 text-lg transition-transform hover:scale-125 hover:bg-accent"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
                        className="hidden"
                        onChange={(e) => void pickAttachments(e.target.files)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-label="Attach file"
                        disabled={attachments.length >= MAX_ATTACHMENTS}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {onCancel && (
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                            {cancelLabel ?? (isVi ? 'Hủy' : 'Cancel')}
                        </Button>
                    )}
                    <Button type="button" size="sm" disabled={disabled || !value.trim()} onClick={onSubmit}>
                        {submitLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
