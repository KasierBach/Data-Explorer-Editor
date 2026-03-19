import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Hexagon } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { motion } from 'framer-motion';

interface HeroSectionProps {
    lang: string;
    isAuthenticated: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang, isAuthenticated }) => {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as any }
        }
    };

    return (
        <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="container mx-auto px-4 sm:px-6 text-center relative z-10"
            >
                {/* 3D Core Visual - Abstract Floating Element */}
                <motion.div 
                    animate={{ 
                        y: [0, -20, 0],
                        rotate: [0, 10, -10, 0],
                        scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                        duration: 6, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                    }}
                    className="mb-8 relative flex justify-center"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-600/30 blur-2xl rounded-full scale-125 animate-pulse" />
                        <div className="relative w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-sm">
                            <Hexagon className="w-7 h-7 md:w-8 md:h-8 text-white animate-pulse" />
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-blue-400 text-[10px] font-black mb-4 md:mb-6 backdrop-blur-md uppercase tracking-[0.2em] shadow-xl">
                    <Sparkles className="w-3 h-3" />
                    <span>v3.1: Gemini 3.1 Flash-Lite & Modular Hub</span>
                </motion.div>
                
                <motion.h1 
                    variants={itemVariants}
                    className="text-4xl md:text-7xl font-black tracking-tighter mb-4 md:mb-6 bg-gradient-to-b from-white via-white to-white/30 bg-clip-text text-transparent max-w-5xl mx-auto leading-[0.9] uppercase"
                >
                    {lang === 'vi' ? (
                        <>TRỰC QUAN HÓA <br /> <span className="bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent">DỮ LIỆU THÔNG MINH</span></>
                    ) : (
                        <>VISUALIZE YOUR <br /> <span className="bg-gradient-to-r from-blue-400 to-indigo-600 bg-clip-text text-transparent">DATA INTELLIGENCE</span></>
                    )}
                </motion.h1>
                
                <motion.p 
                    variants={itemVariants}
                    className="text-base md:text-lg text-muted-foreground/60 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed font-medium"
                >
                    {lang === 'vi'
                        ? 'Nền tảng quản trị dữ liệu tích hợp Gemini 3.1 Flash-Lite. Trải nghiệm tốc độ ánh xạ cực nhanh và bảo mật đa lớp chuẩn doanh nghiệp.'
                        : 'The ultimate data management platform powered by Gemini 3.1 Flash-Lite. Experience lightning-fast mapping and enterprise-grade multi-layer security.'}
                </motion.p>
                
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Button 
                        size="lg" 
                        onClick={() => navigate(isAuthenticated ? '/app' : '/login')} 
                        className="h-12 px-8 text-[10px] font-black uppercase tracking-[0.2em] bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] w-full sm:w-auto rounded-xl transition-all hover:scale-105 active:scale-95 group"
                    >
                        {isAuthenticated ? (lang === 'vi' ? 'Vào Workspace' : 'Open Workspace') : (lang === 'vi' ? 'Nhận quyền truy cập' : 'Claim Your Access')}
                        <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button 
                        size="lg" 
                        variant="outline" 
                        onClick={() => window.open('/docs', '_blank')} 
                        className="h-12 px-8 text-[10px] font-black uppercase tracking-[0.2em] w-full sm:w-auto glass-panel hover:bg-white/10 rounded-xl border-white/10 backdrop-blur-md"
                    >
                        {lang === 'vi' ? 'Tài liệu hướng dẫn' : 'Documentation'}
                    </Button>
                </motion.div>
            </motion.div>
        </section>
    );
};
