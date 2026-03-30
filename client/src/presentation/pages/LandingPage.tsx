import React, { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { HeroSection } from '../modules/LandingPage/components/HeroSection';

// Lazy load sections below the fold
const FeaturesSection = lazy(() => import('../modules/LandingPage/components/FeaturesSection').then(m => ({ default: m.FeaturesSection })));
const WorkflowSection = lazy(() => import('../modules/LandingPage/components/WorkflowSection').then(m => ({ default: m.WorkflowSection })));
const DemoMockup = lazy(() => import('../modules/LandingPage/components/DemoMockup').then(m => ({ default: m.DemoMockup })));
const AiSpotlightSection = lazy(() => import('../modules/LandingPage/components/AiSpotlightSection').then(m => ({ default: m.AiSpotlightSection })));
const PricingSection = lazy(() => import('../modules/LandingPage/components/PricingSection').then(m => ({ default: m.PricingSection })));
const DocsCtaSection = lazy(() => import('../modules/LandingPage/components/DocsCtaSection').then(m => ({ default: m.DocsCtaSection })));
const LandingFooter = lazy(() => import('../modules/LandingPage/components/LandingFooter').then(m => ({ default: m.LandingFooter })));
const InteractiveBackground = lazy(() => import('../modules/LandingPage/components/InteractiveBackground').then(m => ({ default: m.InteractiveBackground })));

export const LandingPage: React.FC = () => {
    const { isAuthenticated, logout, lang } = useAppStore();
    const revealRefs = useRef<HTMLDivElement[]>([]);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
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
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, []);

    const addToRevealRefs = (el: HTMLDivElement | null) => {
        if (el && !revealRefs.current.includes(el)) {
            revealRefs.current.push(el);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            <SEO 
                lang={lang} 
                title={lang === 'vi' ? "Data Explorer - IDE Cơ sở dữ liệu Thông minh" : "Data Explorer - Smart Database IDE"}
                description={lang === 'vi' 
                    ? "Khám phá và quản lý SQL & NoSQL với sức mạnh của AI. Trình duyệt cơ sở dữ liệu hiện đại, nhanh chóng và bảo mật."
                    : "Explore and manage SQL & NoSQL with the power of AI. Modern, fast, and secure database explorer."
                }
            />
            <Suspense fallback={null}>
                <InteractiveBackground />
            </Suspense>

            <LandingHeader 
                lang={lang} 
                isAuthenticated={isAuthenticated} 
                logout={logout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
            />

            <main className="flex-1 flex flex-col relative z-10">
                <HeroSection lang={lang} isAuthenticated={isAuthenticated} />
                
                <Suspense fallback={<div className="h-96" />}>
                    <DemoMockup addToRevealRefs={addToRevealRefs} />

                    <FeaturesSection lang={lang} />
                    
                    <WorkflowSection lang={lang} />

                    <AiSpotlightSection lang={lang} addToRevealRefs={addToRevealRefs} />

                    <PricingSection lang={lang} addToRevealRefs={addToRevealRefs} />

                    <DocsCtaSection lang={lang} addToRevealRefs={addToRevealRefs} />

                    <LandingFooter lang={lang} />
                </Suspense>
            </main>
        </div>
    );
};
