import { useEffect, useRef } from 'react';
import { HeroSection } from '../modules/LandingPage/components/HeroSection';
import { DemoMockup } from '../modules/LandingPage/components/DemoMockup';
import { FeaturesSection } from '../modules/LandingPage/components/FeaturesSection';
import { WorkflowSection } from '../modules/LandingPage/components/WorkflowSection';
import { AiSpotlightSection } from '../modules/LandingPage/components/AiSpotlightSection';
import { PricingSection } from '../modules/LandingPage/components/PricingSection';
import { FaqSection } from '../modules/LandingPage/components/FaqSection';
import { DocsCtaSection } from '../modules/LandingPage/components/DocsCtaSection';
import type { PublicLanguage } from '@/core/seo/publicRoutes';
import { LandingBackToTop } from './LandingBackToTop';

interface LandingBodyProps {
    lang: PublicLanguage;
    isAuthenticated?: boolean;
    paused?: boolean;
    onToggleMotion?: () => void;
}

export function LandingBody({ lang, isAuthenticated = false, paused = false, onToggleMotion }: LandingBodyProps) {
    const top = useRef<HTMLDivElement>(null);
    const revealRefs = useRef<HTMLDivElement[]>([]);
    const observer = useRef<IntersectionObserver | null>(null);
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        observer.current = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-active');
                    observer.current?.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        revealRefs.current.forEach(element => observer.current?.observe(element));
        return () => { observer.current?.disconnect(); observer.current = null; };
    }, [paused]);
    const reveal = (element: HTMLDivElement | null) => {
        if (element && !revealRefs.current.includes(element)) {
            revealRefs.current.push(element);
            element.classList.add('lp-reveal');
            observer.current?.observe(element);
        }
    };
    return (
        <main className="flex-1 flex flex-col">
            <div id="landing-top" ref={top} tabIndex={-1} className="lp-top-target" />
            <section id="demo" className="lp-section lp-hero-section">
                <div className="lp-ambient" aria-hidden="true" />
                <div className="lp-container lp-hero-grid">
                    <HeroSection lang={lang} isAuthenticated={isAuthenticated} />
                    <DemoMockup lang={lang} isMotionPaused={paused} onToggleMotion={onToggleMotion} />
                </div>
            </section>
            <FeaturesSection lang={lang} isMotionPaused={paused} addToRevealRefs={reveal} />
            <div ref={reveal} className="lp-signal-section"><WorkflowSection lang={lang} /></div>
            <div className="lp-signal-section"><AiSpotlightSection lang={lang} addToRevealRefs={reveal} /></div>
            <PricingSection lang={lang} addToRevealRefs={reveal} />
            <div ref={reveal}><FaqSection lang={lang} /></div>
            <DocsCtaSection lang={lang} addToRevealRefs={reveal} isAuthenticated={isAuthenticated} />
            <LandingBackToTop lang={lang} targetRef={top} />
        </main>
    );
}
