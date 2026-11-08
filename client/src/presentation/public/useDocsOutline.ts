import { useEffect, useState, type RefObject } from 'react';

export interface DocsOutlineHeading { id: string; text: string; level: number }

export function useDocsOutline(articleRef: RefObject<HTMLElement | null>, scrollRef: RefObject<HTMLElement | null>, sectionId: string) {
    const [headings, setHeadings] = useState<DocsOutlineHeading[]>([]);
    const [activeHeading, setActiveHeading] = useState('');
    useEffect(() => {
        let frame = 0;
        let observer: IntersectionObserver | undefined;
        const article = articleRef.current;
        const scroll = scrollRef.current;
        if (!article || !scroll) return;
        let elements: HTMLElement[] = [];
        const update = () => {
            frame = 0;
            const top = scroll.getBoundingClientRect().top + 100;
            let active = elements[0]?.id ?? '';
            for (const heading of elements) {
                if (heading.getBoundingClientRect().top <= top) active = heading.id;
            }
            setActiveHeading(active);
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
        frame = requestAnimationFrame(() => {
            elements = Array.from(article.querySelectorAll<HTMLElement>('h2,h3')).filter(element => !element.closest('[data-doc-outline-exclude], [aria-hidden="true"]'));
            setHeadings(elements.map((element, index) => {
                element.id ||= `heading-${index}`;
                return { id: element.id, text: element.textContent ?? '', level: element.tagName === 'H2' ? 2 : 3 };
            }));
            const reveals = Array.from(article.querySelectorAll<HTMLElement>('[data-doc-reveal]'));
            if (typeof IntersectionObserver !== 'undefined') {
                observer = new IntersectionObserver(entries => {
                    for (const entry of entries) {
                        if (entry.isIntersecting) {
                            (entry.target as HTMLElement).dataset.revealed = 'true';
                            observer?.unobserve(entry.target);
                        }
                    }
                }, { root: scroll, threshold: 0.08 });
                reveals.forEach(element => observer?.observe(element));
            } else reveals.forEach(element => { element.dataset.revealed = 'true'; });
            update();
            let hash = '';
            try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Invalid fragments must not interrupt document reading. */ }
            if (hash) elements.find(element => element.id === hash)?.scrollIntoView({ block: 'start' });
        });
        scroll.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            scroll.removeEventListener('scroll', onScroll);
        };
    }, [articleRef, scrollRef, sectionId]);
    return { headings, activeHeading };
}
