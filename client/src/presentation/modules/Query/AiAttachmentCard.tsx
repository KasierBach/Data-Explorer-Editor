import React from 'react';
import { FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiAttachmentCardProps {
    attachment: { type: string; label: string; preview?: string };
    onRemove?: () => void;
}

export const AiAttachmentCard: React.FC<AiAttachmentCardProps> = React.memo(({
    attachment,
    onRemove,
}) => {
    const isImage = attachment.type === 'image' && attachment.preview;
    const isPdf = /^pdf:/i.test(attachment.label) || /^pdf\b/i.test(attachment.preview || '');
    const Icon = isPdf ? FileText : attachment.type === 'file' ? Paperclip : ImageIcon;
    const fileName = attachment.label.replace(/^(PDF|Excel|File|Unreadable):\s*/i, '');
    const detail = attachment.preview && attachment.type !== 'image'
        ? attachment.preview.replace(/\s+-\s+/, ' / ')
        : isPdf ? 'PDF document' : attachment.type === 'table' ? 'Table context' : attachment.type === 'sql' ? 'SQL query' : 'Attachment';

    return (
        <article className={cn(
            'group/attachment flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-slate-950/25 px-2.5 py-2',
            'transition-[transform,border-color,background-color] duration-200',
            onRemove ? 'w-full hover:-translate-y-px hover:border-violet-400/25 hover:bg-violet-500/[0.05] sm:w-[220px]' : 'w-full',
        )}>
            <div className='flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-violet-500/10 text-violet-300'>
                {isImage
                    ? <img src={attachment.preview} alt='' className='h-full w-full object-cover' />
                    : <Icon className='h-4 w-4' strokeWidth={1.8} />}
            </div>
            <div className='min-w-0 flex-1'>
                <div className='truncate text-[11px] font-semibold tracking-[-0.01em] text-foreground/90' title={fileName}>
                    {fileName}
                </div>
                <div className='mt-0.5 truncate text-[9px] font-medium text-muted-foreground/65'>
                    {detail}
                </div>
            </div>
            {onRemove && (
                <button
                    type='button'
                    onClick={onRemove}
                    className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 sm:opacity-0 sm:group-hover/attachment:opacity-100 sm:group-focus-within/attachment:opacity-100'
                    aria-label={'Remove ' + fileName}
                >
                    <X className='h-3.5 w-3.5' />
                </button>
            )}
        </article>
    );
});

AiAttachmentCard.displayName = 'AiAttachmentCard';
