import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface HeroSectionProps {
    lang: string;
    isAuthenticated: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang, isAuthenticated }) => {
    const navigate = useNavigate();

    return (
        <section className="relative pt-16 pb-12 md:pt-24 md:pb-16 overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4 md:mb-6 animate-fade-in-up backdrop-blur-sm uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" />
                    <span>v3.1: Gemini 3.1 Flash-Lite & Modular Architecture</span>
                </div>
                <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-4 md:mb-5 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent max-w-5xl mx-auto leading-[0.9] animate-fade-in-up [animation-delay:100ms]">
                    {lang === 'vi' ? (
                        <>TRỰC QUAN HÓA <br /> <span className="text-blue-500 inline-block">DỮ LIỆU THÔNG MINH</span></>
                    ) : (
                        <>VISUALIZE YOUR <br /> <span className="text-blue-500 inline-block">DATA INTELLIGENCE</span></>
                    )}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground/80 max-w-3xl mx-auto mb-6 md:mb-8 leading-relaxed animate-fade-in-up [animation-delay:200ms] font-medium">
                    {lang === 'vi'
                        ? 'Trình quản lý SQL thế hệ mới kết hợp sức mạnh của Gemini 3.1 Flash-Lite với kiến trúc Clean Architecture. Bảo mật tuyệt đối, phản hồi tức thì và thông minh vượt trội.'
                        : 'The next-gen SQL client merging Gemini 3.1 Flash-Lite power with Clean Architecture. Military-grade security, instant response, and supreme intelligence.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up [animation-delay:300ms]">
                    <Button size="lg" onClick={() => navigate(isAuthenticated ? '/app' : '/login')} className="h-12 px-8 text-xs font-black uppercase tracking-[0.2em] bg-blue-600 hover:bg-blue-700 text-white shadow-2xl shadow-blue-500/40 w-full sm:w-auto rounded-xl transition-all hover:-translate-y-1">
                        {isAuthenticated ? (lang === 'vi' ? 'Vào Workspace' : 'Open Workspace') : (lang === 'vi' ? 'Nhận quyền truy cập' : 'Claim Your Access')}
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => window.open('/docs', '_blank')} className="h-12 px-8 text-xs font-black uppercase tracking-[0.2em] w-full sm:w-auto glass-panel hover:bg-white/10 rounded-xl border-white/10">
                        {lang === 'vi' ? 'Tài liệu hướng dẫn' : 'Documentation'}
                    </Button>
                </div>
            </div>
        </section>
    );
};
