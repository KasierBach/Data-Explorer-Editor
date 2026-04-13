import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { SEO } from '../components/shared/Seo';
import { LandingHeader } from '../modules/LandingPage/components/LandingHeader';
import { InteractiveBackground } from '../modules/LandingPage/components/InteractiveBackground';
import { LandingFooter } from '../modules/LandingPage/components/LandingFooter';
import { motion } from 'framer-motion';
import { Sparkles, Database, Code2, ShieldCheck, Zap } from 'lucide-react';
import { AuthService } from '@/core/services/AuthService';

export const ChangelogPage: React.FC = () => {
    const { isAuthenticated, lang } = useAppStore();
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const handleLogout = async () => {
        await AuthService.logoutAndRedirect('/login');
    };

    const releases = [
        {
            version: 'v3.2.0',
            date: lang === 'vi' ? 'Tháng 4, 2026' : 'April 2026',
            title: lang === 'vi' ? 'Sức Mạnh Đa Nền Tảng & AI Toàn Diện' : 'Multi-Engine Power & Ultimate AI',
            badge: 'LATEST',
            features: [
                {
                    icon: <Database className="w-5 h-5 text-blue-400" />,
                    title: lang === 'vi' ? 'Kiến trúc Multi-Engine hoàn chỉnh' : 'Complete Multi-Engine Architecture',
                    desc: lang === 'vi' ? 'Hỗ trợ đồng thời PostgreSQL, MySQL, SQL Server và MongoDB trong một workspace thống nhất.' : 'Simultaneous support for PostgreSQL, MySQL, SQL Server, and MongoDB in a unified workspace.'
                },
                {
                    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
                    title: lang === 'vi' ? 'Gemini 3.1 Flash-Lite' : 'Gemini 3.1 Flash-Lite Integration',
                    desc: lang === 'vi' ? 'Cải thiện tốc độ stream AI, tối ưu hóa text-to-SQL và sửa lỗi query tự động.' : 'Improved AI stream speed, text-to-SQL optimization, and auto query bug fixing.'
                },
                {
                    icon: <ShieldCheck className="w-5 h-5 text-amber-400" />,
                    title: lang === 'vi' ? 'Phân Quyền Định Tuyến (RBAC)' : 'Deep Role-Based Access Control',
                    desc: lang === 'vi' ? 'Bảo vệ kết nối tầng server, ngăn chặn query trái phép cho từng workspace.' : 'Server-level connection protection, preventing unauthorized queries per workspace.'
                }
            ]
        },
        {
            version: 'v3.1.0',
            date: lang === 'vi' ? 'Tháng 3, 2026' : 'March 2026',
            title: lang === 'vi' ? 'ERD & Trực Quan Hóa' : 'ERD & Visual Intelligence',
            badge: '',
            features: [
                {
                    icon: <Code2 className="w-5 h-5 text-emerald-400" />,
                    title: lang === 'vi' ? 'Live ERD Visualization' : 'Live ERD Visualization',
                    desc: lang === 'vi' ? 'Tự động tạo đồ thị thực thể từ Data Schema với React Flow.' : 'Auto-generate entity graphs from your Data Schema using React Flow.'
                },
                {
                    icon: <Zap className="w-5 h-5 text-yellow-400" />,
                    title: 'Monaco Pro Editor',
                    desc: lang === 'vi' ? 'Intellisense cho schema, auto-complete và dark theme chuẩn VS Code.' : 'Schema intellisense, auto-complete, and native VS Code dark theme.'
                }
            ]
        },
        {
            version: 'v3.0.0',
            date: lang === 'vi' ? 'Tháng 1, 2026' : 'January 2026',
            title: lang === 'vi' ? 'Nền Tảng Cốt Lõi' : 'The Core Platform Genesis',
            badge: '',
            features: [
                {
                    icon: <Database className="w-5 h-5 text-cyan-400" />,
                    title: lang === 'vi' ? 'Kiến trúc NestJS & Prisma' : 'NestJS & Prisma Backbone',
                    desc: lang === 'vi' ? 'Backend ổn định hỗ trợ OAuth, JWT, mã hóa AES-256-GCM.' : 'Stable backend supporting OAuth, JWT, and AES-256-GCM encryption.'
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
                                transition={{ delay: idx * 0.1 }}
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
