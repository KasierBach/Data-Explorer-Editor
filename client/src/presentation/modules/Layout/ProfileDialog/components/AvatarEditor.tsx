import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Loader2, Move, RotateCcw, X, ZoomIn } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

const PREVIEW_SIZE = 240;
const OUTPUT_SIZE = 512;

interface AvatarLayoutInput {
    width: number;
    height: number;
    viewportSize: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
}

// eslint-disable-next-line react-refresh/only-export-components -- Pure crop geometry is exported for its focused regression test.
export function getAvatarLayout({
    width,
    height,
    viewportSize,
    zoom,
    offsetX,
    offsetY,
}: AvatarLayoutInput) {
    const safeWidth = Math.max(width, 1);
    const safeHeight = Math.max(height, 1);
    const safeZoom = Math.min(Math.max(zoom, 1), 3);
    const scale = Math.max(viewportSize / safeWidth, viewportSize / safeHeight) * safeZoom;
    const renderedWidth = safeWidth * scale;
    const renderedHeight = safeHeight * scale;
    const maxPanX = Math.max(0, (renderedWidth - viewportSize) / 2);
    const maxPanY = Math.max(0, (renderedHeight - viewportSize) / 2);

    return {
        width: renderedWidth,
        height: renderedHeight,
        left: (viewportSize - renderedWidth) / 2 + Math.min(Math.max(offsetX, -1), 1) * maxPanX,
        top: (viewportSize - renderedHeight) / 2 + Math.min(Math.max(offsetY, -1), 1) * maxPanY,
    };
}

function loadImage(source: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to decode image'));
        image.src = source;
    });
}

async function cropAvatarImage(source: string, zoom: number, offsetX: number, offsetY: number) {
    const image = await loadImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');

    const layout = getAvatarLayout({
        width: image.naturalWidth,
        height: image.naturalHeight,
        viewportSize: OUTPUT_SIZE,
        zoom,
        offsetX,
        offsetY,
    });

    context.fillStyle = '#111827';
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, layout.left, layout.top, layout.width, layout.height);
    return canvas.toDataURL('image/jpeg', 0.88);
}

interface AvatarEditorProps {
    source: string;
    isSaving: boolean;
    t: (key: string) => string;
    onClose: () => void;
    onApply: (base64: string) => Promise<boolean>;
}

export const AvatarEditor: React.FC<AvatarEditorProps> = ({
    source,
    isSaving,
    t,
    onClose,
    onApply,
}) => {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
    const [zoom, setZoom] = useState(1);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const busy = isSaving || isProcessing;
    const layout = useMemo(() => getAvatarLayout({
        ...dimensions,
        viewportSize: PREVIEW_SIZE,
        zoom,
        offsetX,
        offsetY,
    }), [dimensions, offsetX, offsetY, zoom]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) dialog.showModal();
        return () => {
            if (dialog?.open) dialog.close();
        };
    }, []);

    const reset = () => {
        setZoom(1);
        setOffsetX(0);
        setOffsetY(0);
    };

    const handleApply = async () => {
        setError('');
        setIsProcessing(true);
        try {
            const croppedImage = await cropAvatarImage(source, zoom, offsetX, offsetY);
            const saved = await onApply(croppedImage);
            if (saved) onClose();
        } catch {
            setError(t('avatar_processing_error'));
        } finally {
            setIsProcessing(false);
        }
    };

    if (typeof document === 'undefined' || !document.body) return null;

    return ReactDOM.createPortal(
        <dialog
            ref={dialogRef}
            aria-labelledby='avatar-editor-title'
            onCancel={(event) => {
                event.preventDefault();
                if (!busy) onClose();
            }}
            className='fixed inset-0 m-auto w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-2xl border border-white/10 bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm'
        >
            <div className='flex items-start justify-between border-b border-border/60 px-5 py-4'>
                <div>
                    <h3 id='avatar-editor-title' className='text-base font-semibold tracking-tight'>
                        {t('edit_avatar_title')}
                    </h3>
                    <p className='mt-1 text-xs text-muted-foreground'>{t('edit_avatar_description')}</p>
                </div>
                <button
                    type='button'
                    onClick={onClose}
                    disabled={busy}
                    className='rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40'
                    aria-label={t('cancel')}
                >
                    <X className='h-4 w-4' />
                </button>
            </div>

            <div className='space-y-5 px-5 py-5'>
                <div className='mx-auto h-60 w-60 overflow-hidden rounded-full border border-violet-400/25 bg-slate-950 shadow-[0_0_0_8px_rgba(139,92,246,0.06)]'>
                    <div className='relative h-full w-full overflow-hidden'>
                        <img
                            src={source}
                            alt={t('avatar_preview_alt')}
                            draggable={false}
                            onLoad={(event) => setDimensions({
                                width: event.currentTarget.naturalWidth,
                                height: event.currentTarget.naturalHeight,
                            })}
                            className='absolute max-w-none select-none'
                            style={{
                                width: layout.width,
                                height: layout.height,
                                left: layout.left,
                                top: layout.top,
                            }}
                        />
                    </div>
                </div>

                <div className='space-y-4 rounded-xl bg-muted/25 p-4'>
                    <label className='grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-xs font-medium'>
                        <span className='flex items-center gap-2'><ZoomIn className='h-3.5 w-3.5' />{t('avatar_zoom')}</span>
                        <span className='tabular-nums text-muted-foreground'>{Math.round(zoom * 100)}%</span>
                        <input
                            type='range'
                            min='1'
                            max='3'
                            step='0.01'
                            value={zoom}
                            onChange={(event) => setZoom(Number(event.target.value))}
                            className='col-span-2 w-full accent-violet-500'
                        />
                    </label>
                    <label className='grid gap-2 text-xs font-medium'>
                        <span className='flex items-center gap-2'><Move className='h-3.5 w-3.5' />{t('avatar_horizontal')}</span>
                        <input
                            type='range'
                            min='-1'
                            max='1'
                            step='0.01'
                            value={offsetX}
                            onChange={(event) => setOffsetX(Number(event.target.value))}
                            className='w-full accent-violet-500'
                        />
                    </label>
                    <label className='grid gap-2 text-xs font-medium'>
                        <span className='flex items-center gap-2'><Move className='h-3.5 w-3.5 rotate-90' />{t('avatar_vertical')}</span>
                        <input
                            type='range'
                            min='-1'
                            max='1'
                            step='0.01'
                            value={offsetY}
                            onChange={(event) => setOffsetY(Number(event.target.value))}
                            className='w-full accent-violet-500'
                        />
                    </label>
                </div>

                {error && <p role='alert' className='text-xs text-red-400'>{error}</p>}
            </div>

            <div className='flex items-center justify-between border-t border-border/60 bg-muted/10 px-5 py-4'>
                <Button type='button' variant='ghost' size='sm' onClick={reset} disabled={busy}>
                    <RotateCcw className='mr-2 h-3.5 w-3.5' />
                    {t('reset')}
                </Button>
                <div className='flex gap-2'>
                    <Button type='button' variant='outline' size='sm' onClick={onClose} disabled={busy}>
                        {t('cancel')}
                    </Button>
                    <Button type='button' size='sm' onClick={handleApply} disabled={busy} className='bg-violet-600 text-white hover:bg-violet-700'>
                        {busy && <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />}
                        {t('apply_avatar')}
                    </Button>
                </div>
            </div>
        </dialog>,
        document.body,
    );
};
