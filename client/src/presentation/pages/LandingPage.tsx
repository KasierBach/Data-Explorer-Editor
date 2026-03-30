import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { HeroSection } from '../modules/LandingPage/components/HeroSection';
import { FeaturesSection } from '../modules/LandingPage/components/FeaturesSection';
import { WorkflowSection } from '../modules/LandingPage/components/WorkflowSection';
import { DemoMockup } from '../modules/LandingPage/components/DemoMockup';
import { AiSpotlightSection } from '../modules/LandingPage/components/AiSpotlightSection';
import { PricingSection } from '../modules/LandingPage/components/PricingSection';
import { DocsCtaSection } from '../modules/LandingPage/components/DocsCtaSection';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';

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
            <InteractiveBackground />

            <LandingHeader 
                lang={lang} 
                isAuthenticated={isAuthenticated} 
                logout={logout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
            />

            <main className="flex-1 flex flex-col relative z-10">
                <HeroSection lang={lang} isAuthenticated={isAuthenticated} />
                
                <DemoMockup addToRevealRefs={addToRevealRefs} />

                <FeaturesSection lang={lang} />
                
                <WorkflowSection lang={lang} />

                <AiSpotlightSection lang={lang} addToRevealRefs={addToRevealRefs} />

                <PricingSection lang={lang} addToRevealRefs={addToRevealRefs} />

                <DocsCtaSection lang={lang} addToRevealRefs={addToRevealRefs} />

                <LandingFooter lang={lang} />
            </main>
        </div>
    );
};
