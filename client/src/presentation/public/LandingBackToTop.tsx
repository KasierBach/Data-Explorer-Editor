import { useEffect, useState, type RefObject } from 'react';
import { ArrowUp } from 'lucide-react';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import type { PublicLanguage } from '@/core/seo/publicRoutes';

export function LandingBackToTop({ lang, targetRef }: { lang: PublicLanguage; targetRef: RefObject<HTMLDivElement | null> }) {
    const [enhanced, setEnhanced] = useState(false);
    const [visible, setVisible] = useState(true);
    const label = getWorkspaceText(lang).landingHeader.backToTopAria;
    useEffect(() => {
        const update = () => setVisible(window.scrollY > window.innerHeight);
        const frame = requestAnimationFrame(() => { setEnhanced(true); update(); });
        const target = targetRef.current;
        const observer = typeof IntersectionObserver !== 'undefined' && target ? new IntersectionObserver(entries => {
            for (const entry of entries) setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        }, { threshold: 0 }) : null;
        if (target && observer) observer.observe(target);
        else window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [targetRef]);
    return <a href="#landing-top" className="lp-back-to-top" data-enhanced={enhanced} hidden={enhanced && !visible} aria-label={label} onClick={() => targetRef.current?.focus({ preventScroll: true })}><ArrowUp size={18} aria-hidden="true" /><span>{label}</span></a>;
}
