import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { HeroSection } from '../modules/LandingPage/components/HeroSection';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import { AuthService } from '@/core/services/AuthService';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { cn } from '@/lib/utils';

// Lazy load sections below the fold
const FeaturesSection = lazy(() => import('../modules/LandingPage/components/FeaturesSection').then(m => ({ default: m.FeaturesSection })));
const WorkflowSection = lazy(() => import('../modules/LandingPage/components/WorkflowSection').then(m => ({ default: m.WorkflowSection })));
const DemoMockup = lazy(() => import('../modules/LandingPage/components/DemoMockup').then(m => ({ default: m.DemoMockup })));
const AiSpotlightSection = lazy(() => import('../modules/LandingPage/components/AiSpotlightSection').then(m => ({ default: m.AiSpotlightSection })));
const PricingSection = lazy(() => import('../modules/LandingPage/components/PricingSection').then(m => ({ default: m.PricingSection })));
const DocsCtaSection = lazy(() => import('../modules/LandingPage/components/DocsCtaSection').then(m => ({ default: m.DocsCtaSection })));
const LandingFooter = lazy(() => import('../modules/LandingPage/components/LandingFooter').then(m => ({ default: m.LandingFooter })));

type LandingSkeletonLayout = 'split' | 'cards' | 'footer';

function LandingSectionSkeleton({ className, layout }: { className: string; layout: LandingSkeletonLayout }) {
    const count = layout === 'footer' ? 5 : layout === 'cards' ? 3 : 2;
    const columns = layout === 'footer' ? 'grid-cols-2 md:grid-cols-5' : layout === 'cards' ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';

    return (
        <div aria-hidden="true" className={cn('flex w-full items-center px-4 py-14 sm:px-6', className)}>
            <div className="mx-auto w-full max-w-6xl space-y-8">
                <div className="mx-auto h-6 w-64 max-w-[70vw] animate-pulse rounded-md bg-muted/50 motion-reduce:animate-none" />
                <div className={cn('grid gap-4', columns)}>
                    {Array.from({ length: count }, (_, item) => (
                        <div key={item} className="h-40 animate-pulse rounded-2xl border border-border/40 bg-card/40 motion-reduce:animate-none" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export const LandingPage: React.FC = () => {
    const { isAuthenticated, lang } = useAppStore();
    const text = getWorkspaceText(lang).landingPage;
    const revealRefs = useRef<HTMLDivElement[]>([]);
    const observer = useRef<IntersectionObserver | null>(null);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    useEffect(() => {
        observer.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    }
                });
            },
            { threshold: 0.1 }
        );

        revealRefs.current.forEach((ref) => {
            if (ref) observer.current?.observe(ref);
        });

        return () => observer.current?.disconnect();
    }, []);

    const addToRevealRefs = (el: HTMLDivElement | null) => {
        if (el && !revealRefs.current.includes(el)) {
            revealRefs.current.push(el);
            if (observer.current) {
                observer.current.observe(el);
            }
        }
    };

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            <SEO 
                lang={lang} 
                title={text.seoTitle}
                description={text.seoDescription}
            />
            <InteractiveBackground />

            <LandingHeader 
                lang={lang} 
                isAuthenticated={isAuthenticated} 
                logout={handleLogout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
            />

            <main className="flex-1 flex flex-col relative z-10">
                <HeroSection lang={lang} isAuthenticated={isAuthenticated} />
                
                <Suspense fallback={<LandingSectionSkeleton className="min-h-[60vh]" layout="split" />}>
                    <DemoMockup addToRevealRefs={addToRevealRefs} />
                </Suspense>

                <Suspense fallback={<LandingSectionSkeleton className="min-h-screen" layout="cards" />}>
                    <FeaturesSection lang={lang} />
                </Suspense>
                
                <Suspense fallback={<LandingSectionSkeleton className="min-h-[80vh]" layout="cards" />}>
                    <WorkflowSection lang={lang} />
                </Suspense>

                <Suspense fallback={<LandingSectionSkeleton className="min-h-[80vh]" layout="split" />}>
                    <AiSpotlightSection lang={lang} addToRevealRefs={addToRevealRefs} />
                </Suspense>

                <Suspense fallback={<LandingSectionSkeleton className="min-h-screen" layout="cards" />}>
                    <PricingSection lang={lang} addToRevealRefs={addToRevealRefs} />
                </Suspense>

                <Suspense fallback={<LandingSectionSkeleton className="min-h-[40vh]" layout="split" />}>
                    <DocsCtaSection lang={lang} addToRevealRefs={addToRevealRefs} />
                </Suspense>

                <Suspense fallback={<LandingSectionSkeleton className="min-h-[30vh] bg-background" layout="footer" />}>
                    <LandingFooter lang={lang} />
                </Suspense>
            </main>
        </div>
    );
};
