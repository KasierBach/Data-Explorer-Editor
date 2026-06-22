import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Code2,
  Database,
  FileCode,
  Globe,
  Settings,
  ShieldCheck,
  Sparkles,
  TestTube,
  Users,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { AuthService } from '@/core/services/AuthService';
import { SEO } from '../components/shared/Seo';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { getChangelogPageContent, type ChangelogIconKey } from './changelogContent';

const iconMap: Record<ChangelogIconKey, React.ReactNode> = {
  sparkles: <Sparkles className="w-5 h-5 text-purple-400" />,
  database: <Database className="w-5 h-5 text-emerald-400" />,
  code2: <Code2 className="w-5 h-5 text-cyan-400" />,
  shieldCheck: <ShieldCheck className="w-5 h-5 text-red-400" />,
  zap: <Zap className="w-5 h-5 text-yellow-400" />,
  globe: <Globe className="w-5 h-5 text-blue-400" />,
  testTube: <TestTube className="w-5 h-5 text-amber-400" />,
  fileCode: <FileCode className="w-5 h-5 text-indigo-400" />,
  settings: <Settings className="w-5 h-5 text-amber-400" />,
  users: <Users className="w-5 h-5 text-cyan-400" />,
};

export const ChangelogPage: React.FC = () => {
  const { isAuthenticated, lang } = useAppStore();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const content = getChangelogPageContent(lang);

  const handleLogout = async () => {
    await AuthService.logoutAndRedirect('/login');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-blue-500/30">
      <SEO lang={lang} title={content.seoTitle} description={content.seoDescription} />
      <InteractiveBackground />

      <LandingHeader
        lang={lang}
        isAuthenticated={isAuthenticated}
        logout={handleLogout}
        isMobileNavOpen={isMobileNavOpen}
        setIsMobileNavOpen={setIsMobileNavOpen}
        hideSectionLinks={true}
      />

      <main className="relative z-10 flex-1 pb-24 pt-32">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-16 text-center">
            <h1 className="mb-4 bg-gradient-to-b from-white to-white/50 bg-clip-text text-4xl font-black uppercase tracking-tighter text-transparent md:text-6xl">
              {content.heading}
            </h1>
            <p className="mx-auto max-w-2xl text-lg font-medium text-muted-foreground">
              {content.subtitle}
            </p>
          </div>

          <div className="space-y-16">
            {content.releases.map((release, index) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative ml-4 border-l border-white/10 pl-8 md:ml-0 md:pl-12"
              >
                <div className="absolute -left-[8.5px] top-1 h-4 w-4 rounded-full border-2 border-background bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />

                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
                  <h2 className="text-2xl font-black tracking-tight md:text-3xl">{release.version}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground/60">{release.date}</span>
                    {release.badge && (
                      <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-400">
                        {release.badge}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mb-6 text-lg font-bold text-white/90 md:text-xl">{release.title}</h3>

                <div className="space-y-4">
                  {release.features.map((feature, featureIndex) => (
                    <div
                      key={`${release.version}-${featureIndex}`}
                      className="glass-panel flex gap-4 rounded-2xl border-white/5 p-5 transition-colors hover:border-white/10"
                    >
                      <div className="mt-1 shrink-0">{iconMap[feature.icon]}</div>
                      <div>
                        <h4 className="mb-1 font-bold text-white/90">{feature.title}</h4>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <LandingFooter lang={lang} />
    </div>
  );
};
