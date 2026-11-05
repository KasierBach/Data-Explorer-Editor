import { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowUpRight, Maximize2, X } from 'lucide-react';
import { useLandingAppearance } from '../hooks/useLandingAppearance';

interface LandingScreenshotProps {
    src: string;
    alt: string;
    lang: string;
    priority?: boolean;
}

export function LandingScreenshot({ src, alt, lang, priority = false }: LandingScreenshotProps) {
    const [open, setOpen] = useState(false);
    const opener = useRef<HTMLAnchorElement>(null);
    const { theme } = useLandingAppearance();
    const vi = lang === 'vi';

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <figure className="lp-image-frame m-0">
                <a
                    ref={opener}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-screenshot-link"
                    aria-haspopup="dialog"
                    onClick={event => {
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        setOpen(true);
                    }}
                >
                    <img src={src} alt={alt} width={2880} height={1800} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} />
                    <span className="lp-screenshot-caption"><Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />{vi ? 'Xem ảnh đầy đủ' : 'View full image'}</span>
                </a>
            </figure>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="lp-viewer-overlay" />
                <DialogPrimitive.Content
                    className="landing-page lp-image-viewer"
                    data-theme={theme}
                    onCloseAutoFocus={event => {
                        event.preventDefault();
                        opener.current?.focus();
                    }}
                >
                    <div className="lp-viewer-toolbar">
                        <div><DialogPrimitive.Title>{vi ? 'Giao diện sản phẩm' : 'Product interface'}</DialogPrimitive.Title><DialogPrimitive.Description>{alt}</DialogPrimitive.Description></div>
                        <DialogPrimitive.Close className="lp-icon-button" aria-label={vi ? 'Đóng ảnh' : 'Close image'}><X className="h-5 w-5" aria-hidden="true" /></DialogPrimitive.Close>
                    </div>
                    <div className="lp-viewer-image"><img src={src} alt={alt} width={2880} height={1800} /></div>
                    <a href={src} target="_blank" rel="noopener noreferrer" className="lp-inline-link lp-viewer-original">{vi ? 'Mở file ảnh gốc' : 'Open original image'}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
