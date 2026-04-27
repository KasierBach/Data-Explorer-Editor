import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { motion } from 'framer-motion';
import { Sparkles, Database, Code2, ShieldCheck, Zap, Globe, TestTube, FileCode, Settings } from 'lucide-react';
import { AuthService } from '@/core/services/AuthService';

export const ChangelogPage: React.FC = () => {
    const { isAuthenticated, lang } = useAppStore();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    const releases = [
        // v3.3.1 - Late April 2026
        {
            version: 'v3.3.1',
            date: lang === 'vi' ? 'Cuối Tháng 4, 2026' : 'Late April 2026',
            title: lang === 'vi' ? 'Team Collaboration & Mobile Polish' : 'Team Collaboration & Mobile Polish',
            badge: 'LATEST',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Organizations & Shared Workspaces' : 'Organizations & Shared Workspaces',
                    desc: lang === 'vi'
                        ? 'Thêm nền tảng team collaboration với organizations, members, roles, và shared connections / queries / dashboards.'
                        : 'Add the collaboration base for organizations, members, roles, and shared connections / queries / dashboards.'
                },
                {
                    icon: <Globe className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Mobile Collaboration Access' : 'Mobile Collaboration Access',
                    desc: lang === 'vi'
                        ? 'Teams giờ có thể mở từ menu avatar trên mobile, và các màn workspace, dialog, admin được siết lại để thân thiện hơn trên màn nhỏ.'
                        : 'Teams is now reachable from the mobile avatar menu, while workspace, dialog, and admin screens are tuned for smaller displays.'
                },
                {
                    icon: <TestTube className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Connection Diagnostics' : 'Connection Diagnostics',
                    desc: lang === 'vi'
                        ? 'ConnectionDialog có Test Connection, đi kèm sửa lỗi UI và tinh chỉnh lại trải nghiệm thiết lập kết nối.'
                        : 'ConnectionDialog gains Test Connection, plus UI fixes and a smoother connection setup flow.'
                },
                {
                    icon: <Database className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Realtime Stability' : 'Realtime Stability',
                    desc: lang === 'vi'
                        ? 'Thông báo SSE, cache, và luồng cập nhật nền được đồng bộ lại với backend API và hạ tầng Redis hiện tại.'
                        : 'SSE notifications, cache, and background update flows are aligned with the current backend API and Redis infrastructure.'
                }
            ]
        },
        // v3.3.0 - April 2026
        {
            version: 'v3.3.0',
            date: lang === 'vi' ? 'Giữa Tháng 4, 2026' : 'Mid April 2026',
            title: lang === 'vi' ? 'AI Thế Hệ Mới & Type Safety Toàn Diện' : 'Next-Gen AI & Comprehensive Type Safety',
            badge: '',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'AI Service Decomposition' : 'AI Service Decomposition',
                    desc: lang === 'vi' ? 'Tách AI service thành các sub-services chuyên biệt: routing, provider runner, chat completion, autocomplete.' : 'Decompose AI service into specialized sub-services: routing, provider runner, chat completion, autocomplete.'
                },
                {
                    icon: <Code2 className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Type Safety Hoàn Toàn' : 'Complete Type Safety',
                    desc: lang === 'vi' ? 'Loại bỏ tất cả any types, constraint generics, extract AI constants, cải thiện code quality theo SOLID, KISS, YAGNI, DRY.' : 'Remove all any types, constrain generics, extract AI constants, improve code quality following SOLID, KISS, YAGNI, DRY principles.'
                },
                {
                    icon: <Database className="w-5 h-5 text-red-400" />,
                    title: lang === 'vi' ? 'Redis Caching & Global Search' : 'Redis Caching & Global Search',
                    desc: lang === 'vi' ? 'Query result caching, global schema search, real-time SSE notifications, và optimized session management.' : 'Query result caching, global schema search, real-time SSE notifications, and optimized session management.'
                },
                {
                    icon: <Zap className="w-5 h-5 text-yellow-400" />,
                    title: lang === 'vi' ? 'AI-Powered SQL Generation' : 'AI-Powered SQL Generation',
                    desc: lang === 'vi' ? 'Tạo SQL tự động từ ngôn ngữ tự nhiên và semantic search cho database objects.' : 'Auto-generate SQL from natural language and semantic search for database objects.'
                }
            ]
        },
        // v3.2.0 - April 2026
        {
            version: 'v3.2.0',
            date: lang === 'vi' ? 'Đầu Tháng 4, 2026' : 'Early April 2026',
            title: lang === 'vi' ? 'ERD Thông Minh & Real-time Notifications' : 'Smart ERD & Real-time Notifications',
            badge: '',
            features: [
                {
                    icon: <Code2 className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'ERD Performance Optimization' : 'ERD Performance Optimization',
                    desc: lang === 'vi' ? 'Tối ưu hóa performance và visual clarity với Redis caching và smart suggestions cho ERD visualization.' : 'Optimize performance and visual clarity with Redis caching and smart suggestions for ERD visualization.'
                },
                {
                    icon: <Globe className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Real-time SSE Notifications' : 'Real-time SSE Notifications',
                    desc: lang === 'vi' ? 'Thông báo real-time qua Server-Sent Events cho query status và system updates.' : 'Real-time notifications via Server-Sent Events for query status and system updates.'
                },
                {
                    icon: <TestTube className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Client-side Testing Suite' : 'Client-side Testing Suite',
                    desc: lang === 'vi' ? 'Thêm unit tests cho ConnectionService và SavedQueryService, đảm bảo reliability.' : 'Add unit tests for ConnectionService and SavedQueryService, ensuring reliability.'
                }
            ]
        },
        // v3.1.0 - March 2026
        {
            version: 'v3.1.0',
            date: lang === 'vi' ? 'Cuối Tháng 3, 2026' : 'Late March 2026',
            title: lang === 'vi' ? 'UI Upgrade & Hooks Refinement' : 'UI Upgrade & Hooks Refinement',
            badge: '',
            features: [
                {
                    icon: <Sparkles className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Cinematic Dark Mode Landing Page' : 'Cinematic Dark Mode Landing Page',
                    desc: lang === 'vi' ? 'Nâng cấp giao diện landing page với dark mode cinematic, animations mượt mà và visual effects.' : 'Upgrade landing page UI with cinematic dark mode, smooth animations and visual effects.'
                },
                {
                    icon: <Code2 className="w-5 h-5 text-yellow-400" />,
                    title: lang === 'vi' ? 'Query ERD Hooks Alignment' : 'Query ERD Hooks Alignment',
                    desc: lang === 'vi' ? 'Căn chỉnh Query và ERD hooks, fix TypeScript errors và clean up unused code.' : 'Align Query and ERD hooks, fix TypeScript errors and clean up unused code.'
                }
            ]
        },
        // v3.0.5 - March 2026
        {
            version: 'v3.0.5',
            date: lang === 'vi' ? 'Giữa Tháng 3, 2026' : 'Mid March 2026',
            title: lang === 'vi' ? 'Code Quality & Type Fixes' : 'Code Quality & Type Fixes',
            badge: '',
            features: [
                {
                    icon: <Settings className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'SOLID, KISS, YAGNI, DRY Refactoring' : 'SOLID, KISS, YAGNI, DRY Refactoring',
                    desc: lang === 'vi' ? 'Cải thiện code quality với các nguyên tắc thiết kế phần mềm.' : 'Improve code quality with software design principles.'
                },
                {
                    icon: <FileCode className="w-5 h-5 text-green-400" />,
                    title: lang === 'vi' ? 'TypeScript Error Resolution' : 'TypeScript Error Resolution',
                    desc: lang === 'vi' ? 'Fix TypeScript errors, clean up unused props và types.' : 'Fix TypeScript errors, clean up unused props and types.'
                }
            ]
        },
        // v3.0.0 - January 2026
        {
            version: 'v3.0.0',
            date: lang === 'vi' ? 'Cuối Tháng 1, 2026' : 'Late January 2026',
            title: lang === 'vi' ? 'Nền Tảng Cốt Lõi' : 'The Core Platform Genesis',
            badge: '',
            features: [
                {
                    icon: <Database className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Kiến trúc NestJS & Prisma' : 'NestJS & Prisma Backbone',
                    desc: lang === 'vi' ? 'Backend ổn định hỗ trợ OAuth, JWT, mã hóa AES-256-GCM.' : 'Stable backend supporting OAuth, JWT, and AES-256-GCM encryption.'
                },
                {
                    icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Auth Service Spec' : 'Auth Service Specification',
                    desc: lang === 'vi' ? 'Thêm auth service specification và agent directory configuration.' : 'Add auth service specification and agent directory configuration.'
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden relative">
            <SEO 
                lang={lang} 
                title={lang === 'vi' ? "Changelog | Data Explorer" : "Changelog | Data Explorer"}
                description={lang === 'vi' ? "Cập nhật mới nhất của nền tảng Data Explorer." : "The latest updates from the Data Explorer platform."}
            />
            <InteractiveBackground />

            <LandingHeader 
                lang={lang} 
                isAuthenticated={isAuthenticated} 
                logout={handleLogout}
                isMobileNavOpen={isMobileNavOpen}
                setIsMobileNavOpen={setIsMobileNavOpen}
                hideSectionLinks={true}
            />

            <main className="flex-1 relative z-10 pt-32 pb-24">
                <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 uppercase bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                            {lang === 'vi' ? 'Bản ghi Cập nhật' : 'Changelog'}
                        </h1>
                        <p className="text-muted-foreground text-lg font-medium max-w-2xl mx-auto">
                            {lang === 'vi' 
                                ? 'Theo dõi hành trình phát triển của hệ quản trị cơ sở dữ liệu thế hệ mới.' 
                                : 'Track the journey of the next-generation database management IDE.'}
                        </p>
                    </div>

                    <div className="space-y-16">
                        {releases.map((release, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="relative border-l border-white/10 pl-8 md:pl-12 ml-4 md:ml-0"
                            >
                                <div className="absolute w-4 h-4 rounded-full bg-blue-500 -left-[8.5px] top-1 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-2 border-background" />
                                
                                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">{release.version}</h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground/60 text-sm font-medium">{release.date}</span>
                                        {release.badge && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-widest uppercase">
                                                {release.badge}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg md:text-xl font-bold mb-6 text-white/90">{release.title}</h3>

                                <div className="space-y-4">
                                    {release.features.map((feat, fidx) => (
                                        <div key={fidx} className="glass-panel p-5 rounded-2xl border-white/5 hover:border-white/10 transition-colors flex gap-4">
                                            <div className="mt-1 flex-shrink-0">
                                                {feat.icon}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white/90 mb-1">{feat.title}</h4>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {feat.desc}
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
