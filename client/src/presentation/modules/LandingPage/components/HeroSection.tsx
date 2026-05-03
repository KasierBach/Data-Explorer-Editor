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
                            <Hexagon className="w-7 h-7 md:w-8 md:h-8 text-white animate-pulse" aria-hidden="true" />
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                    variants={itemVariants} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative inline-flex group items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.1] text-blue-400 text-[10px] font-bold mb-4 md:mb-8 backdrop-blur-xl uppercase tracking-[0.15em] cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.15)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 transition-colors" aria-hidden="true" />
                    <span className="text-white/90 group-hover:text-white transition-colors relative z-10">v3.4: ADVANCED SECURITY & INFRA HARDENING</span>
                </motion.div>
                
                <motion.h1 
                    variants={itemVariants}
                    className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 md:mb-8 bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent max-w-5xl mx-auto leading-tight md:leading-[1.1] pb-2 cursor-default"
                >
                    {lang === 'vi' ? (
                        <>HỆ QUẢN TRỊ <br /> 
                        <motion.span 
                            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                            transition={{ duration: 5, ease: "linear", repeat: Infinity }}
                            className="bg-[length:200%_200%] bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent inline-block"
                        >
                            CƠ SỞ DỮ LIỆU BẰNG AI
                        </motion.span></>
                    ) : (
                        <>THE AI-POWERED <br /> 
                        <motion.span 
                            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                            transition={{ duration: 5, ease: "linear", repeat: Infinity }}
                            className="bg-[length:200%_200%] bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent inline-block"
                        >
                            DATABASE IDE
                        </motion.span></>
                    )}
                </motion.h1>
                
                <motion.p 
                    variants={itemVariants}
                    className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed font-medium"
                >
                    {lang === 'vi'
                        ? 'Thay thế các công cụ cũ kĩ. Kết nối SQL & NoSQL, bảo mật đa lớp chuẩn doanh nghiệp (SSRF & SQL Guard), và viết query siêu tốc cùng AI Assistant.'
                        : 'Ditch the legacy tools. Connect to SQL & NoSQL simultaneously, secure your workflows with Enterprise-grade guardrails, and write queries at lightspeed.'}
                </motion.p>
                
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="relative group w-full sm:w-auto">
                        {/* Glow effect behind the button */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl blur-lg opacity-40 group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse"></div>
                        <Button 
                            size="lg" 
                            onClick={() => navigate(isAuthenticated ? '/sql-explorer' : '/login')} 
                            className="relative h-12 px-8 text-[11px] font-bold uppercase tracking-[0.15em] bg-background/50 hover:bg-background/80 text-white backdrop-blur-xl border border-blue-400/30 w-full sm:w-auto rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                        >
                            {isAuthenticated ? (lang === 'vi' ? 'Vào Workspace' : 'Open Workspace') : (lang === 'vi' ? 'Nhận quyền truy cập' : 'Claim Your Access')}
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1.5 transition-transform text-blue-400" />
                        </Button>
                    </div>
                    
                    <Button 
                        size="lg" 
                        variant="outline" 
                        onClick={() => window.open('/docs', '_blank')} 
                        className="relative overflow-hidden group h-12 px-8 text-[11px] font-bold uppercase tracking-[0.15em] w-full sm:w-auto glass-panel hover:bg-white/10 hover:text-white text-muted-foreground/90 rounded-xl border-white/[0.08] backdrop-blur-md transition-colors"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                        <span className="relative z-10">{lang === 'vi' ? 'Tài liệu hướng dẫn' : 'Documentation'}</span>
                    </Button>
                </motion.div>
            </motion.div>
        </section>
    );
};
