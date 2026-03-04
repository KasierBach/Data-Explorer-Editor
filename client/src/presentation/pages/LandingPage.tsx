import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { Card, CardContent } from '@/presentation/components/ui/card';
import {
    Database,
    Zap,
    BarChart3,
    ArrowRight,
    Terminal,
    Sparkles,
    Lock,
    Github,
    Twitter,
    Disc,
    PieChart,
    GitGraph,
    ChevronRight,
    BookOpen,
    Layers,
    ExternalLink
} from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, logout, lang } = useAppStore();
    const revealRefs = useRef<HTMLDivElement[]>([]);

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
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 z-0 opacity-20 dark:opacity-30 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[120px] animate-gradient-xy" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] rounded-full bg-purple-600/30 blur-[120px] animate-gradient-xy animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-teal-600/20 blur-[120px] animate-gradient-xy animation-delay-4000" />
            </div>

            {/* Sticky Header with Glassmorphism */}
            <header className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b border-white/5 supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Database className="w-4 h-4 text-white" />
                        </div>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Data<span className="text-blue-500">Explorer</span></span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground absolute left-1/2 -translate-x-1/2">
                        <a href="#features" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                            {lang === 'vi' ? 'Tính năng' : 'Features'}
                        </a>
                        <a href="#demo" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                            {lang === 'vi' ? 'Bản demo' : 'Live Demo'}
                        </a>
                        <button onClick={() => navigate('/docs')} className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                            {lang === 'vi' ? 'Tài liệu' : 'Docs'}
                        </button>
                        <a href="#pricing" className="hover:text-blue-500 transition-colors uppercase tracking-widest text-[10px]">
                            {lang === 'vi' ? 'Giá cả' : 'Pricing'}
                        </a>
                    </nav>

                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        {isAuthenticated ? (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/login'); }} className="hidden sm:flex hover:bg-red-500/10 hover:text-red-500 text-xs uppercase tracking-wider">
                                    Logout
                                </Button>
                                <Button size="sm" onClick={() => navigate('/app')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest font-bold">
                                    Workspace
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:flex hover:bg-blue-500/10 hover:text-blue-500 text-xs uppercase tracking-wider">
                                    {lang === 'vi' ? 'Đăng nhập' : 'Login'}
                                </Button>
                                <Button size="sm" onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest font-bold px-5">
                                    {lang === 'vi' ? 'Bắt đầu' : 'Start Analysis'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col relative z-10">
                {/* Hero Section */}
                <section className="relative pt-16 pb-12 md:pt-24 md:pb-16 overflow-hidden">
                    <div className="container mx-auto px-6 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-4 md:mb-6 animate-fade-in-up backdrop-blur-sm uppercase tracking-widest">
                            <Sparkles className="w-3 h-3" />
                            <span>v2.1: Cloud Sync & AI Insights</span>
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-4 md:mb-5 bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent max-w-5xl mx-auto leading-[0.9] animate-fade-in-up [animation-delay:100ms]">
                            {lang === 'vi' ? (
                                <>TRỰC QUAN HÓA <br /> <span className="text-blue-500 inline-block">DỮ LIỆU THÔNG MINH</span></>
                            ) : (
                                <>VISUALIZE YOUR <br /> <span className="text-blue-500 inline-block">DATA INTELLIGENCE</span></>
                            )}
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-6 md:mb-8 leading-relaxed animate-fade-in-up [animation-delay:200ms] font-medium">
                            {lang === 'vi'
                                ? 'Trình quản lý SQL chuyên nghiệp biến các truy vấn thô thành thông tin hữu ích. Phản hồi nhanh, bảo mật và hỗ trợ bởi Gemini AI.'
                                : 'The professional SQL client that turns raw queries into actionable insights. Fully responsive, secure, and powered by Gemini AI.'}
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

                    {/* High-Fidelity Mockup Section */}
                    <div id="demo" ref={addToRevealRefs} className="reveal container mx-auto px-6 mt-10 md:mt-16 max-w-6xl">
                        <div className="relative group">
                            {/* Decorative Glows */}
                            <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] animate-pulse" />
                            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />

                            <div className="relative rounded-2xl border border-white/10 bg-card/40 backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 shimmer">
                                {/* Window Buttons */}
                                <div className="h-11 border-b border-white/5 flex items-center justify-between px-4 bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1.5 mr-4">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/5 text-[10px] text-muted-foreground font-mono">
                                            <Terminal className="w-3 h-3" />
                                            analytics_dashboard.sql
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/20">CONNECTED</Badge>
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex h-[400px] md:h-[500px] divide-x divide-white/5">
                                    {/* Real Sidebar Preview */}
                                    <div className="w-60 bg-muted/10 hidden lg:flex flex-col p-4 gap-6">
                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Navigator</div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">
                                                    <Database className="w-3.5 h-3.5" />
                                                    production_neon
                                                </div>
                                                <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 text-muted-foreground/50 text-xs group-hover:text-muted-foreground transition-colors">
                                                    <Database className="w-3.5 h-3.5" />
                                                    staging_local
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Tables</div>
                                            <div className="space-y-1 pl-2 border-l border-white/5">
                                                <div className="flex items-center gap-2 text-[11px] p-1.5 text-blue-400/80 font-medium">
                                                    <ChevronRight className="w-3 h-3" /> users
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] p-1.5 text-muted-foreground/60">
                                                    <ChevronRight className="w-3 h-3" /> transactions
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] p-1.5 text-muted-foreground/60">
                                                    <ChevronRight className="w-3 h-3" /> subscriptions
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Real Editor Preview */}
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <div className="p-6 font-mono text-sm leading-8 text-gray-400 relative overflow-hidden flex-1">
                                            <div className="animate-in fade-in slide-in-from-left duration-700">
                                                <span className="text-blue-500">SELECT</span> <br />
                                                &nbsp;&nbsp;u.name, <br />
                                                &nbsp;&nbsp;<span className="text-purple-500">SUM</span>(t.amount) <span className="text-blue-500">as</span> total_spent, <br />
                                                &nbsp;&nbsp;<span className="text-emerald-500">COUNT</span>(t.id) <span className="text-blue-500">as</span> order_count <br />
                                                <span className="text-blue-500">FROM</span> users u <br />
                                                <span className="text-blue-500">JOIN</span> transactions t <span className="text-blue-500">ON</span> u.id = t.user_id <br />
                                                <span className="text-blue-500">WHERE</span> t.status = <span className="text-emerald-500">'completed'</span> <br />
                                                <span className="text-blue-500">GROUP BY</span> 1 <span className="text-blue-500">HAVING</span> total_spent &gt; 1000;
                                            </div>

                                            {/* Floating AI Bubble - Real Component style */}
                                            <div className="absolute bottom-6 right-6 max-w-[280px]">
                                                <div className="glass-panel p-4 rounded-2xl glow-purple animate-float border-l-4 border-l-purple-500">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">AI Assistant</span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-300 leading-relaxed italic">
                                                        "I've optimized your join. Removed redundant indexes and added a covering index hint for Postgres."
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Real Results Preview */}
                                        <div className="h-[40%] bg-[#020617]/50 border-t border-white/5 p-4 flex flex-col md:flex-row gap-4">
                                            <div className="flex-1 rounded-xl bg-black/40 border border-white/5 p-4 overflow-hidden">
                                                <div className="grid grid-cols-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-3 border-b border-white/5 pb-2">
                                                    <div>USER</div>
                                                    <div>TOTAL</div>
                                                    <div>ORDERS</div>
                                                </div>
                                                <div className="space-y-3 font-mono text-[11px]">
                                                    <div className="grid grid-cols-3 text-gray-300"><div>Alex Chen</div><div className="text-emerald-400">$12,450</div><div>42</div></div>
                                                    <div className="grid grid-cols-3 text-gray-300"><div>Sarah Miller</div><div className="text-emerald-400">$8,900</div><div>31</div></div>
                                                    <div className="grid grid-cols-3 text-gray-300 opacity-40"><div>James Wilson</div><div>$4,200</div><div>12</div></div>
                                                </div>
                                            </div>
                                            <div className="w-full md:w-1/3 flex items-end gap-1.5 px-2 pb-2">
                                                {[45, 75, 60, 95, 80, 55, 100].map((h, i) => (
                                                    <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm opacity-60 hover:opacity-100 transition-all cursor-pointer" />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section - Staggered Reveal */}
                <section id="features" className="py-12 md:py-16 relative">
                    <div className="container mx-auto px-6 relative z-10">
                        <div ref={addToRevealRefs} className="reveal text-center mb-10 md:mb-16 max-w-3xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 md:mb-6 uppercase">
                                {lang === 'vi' ? 'Trí tuệ hợp nhất' : 'Unified Intelligence'}
                            </h2>
                            <p className="text-muted-foreground text-base md:text-lg font-medium leading-relaxed">
                                {lang === 'vi'
                                    ? 'Không chỉ là một trình chỉnh sửa. Đó là trung tâm chỉ huy cho dữ liệu của bạn, được xây dựng với sự tinh xảo hiện đại.'
                                    : 'Not just an editor. A command center for your data, built with modern craftsmanship.'}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: <Terminal className="w-6 h-6 text-blue-400" />,
                                    title: lang === 'vi' ? "Công cụ Monaco" : "Monaco Engine",
                                    desc: lang === 'vi' ? "Trải nghiệm trình chỉnh sửa của VS Code trong luồng công việc dữ liệu của bạn. Đầy đủ Intellisense, đa con trỏ và hiệu suất cực nhanh." : "Experience VS Code's editor in your data workflow. Full Intellisense, multi-cursor, and ultra-fast performance."
                                },
                                {
                                    icon: <Zap className="w-6 h-6 text-yellow-400" />,
                                    title: lang === 'vi' ? "AI Tạo hình" : "Generative AI",
                                    desc: lang === 'vi' ? "Dịch ngôn ngữ tự nhiên sang SQL được hỗ trợ bởi Google Gemini. Được tối ưu hóa cho các mô hình kiến trúc phức tạp." : "Natural language to SQL translations powered by Google Gemini. Optimized for complex architectural patterns."
                                },
                                {
                                    icon: <BarChart3 className="w-6 h-6 text-emerald-400" />,
                                    title: lang === 'vi' ? "Thông tin Thông minh" : "Smart Insights",
                                    desc: lang === 'vi' ? "Tự động phân tích kích thước bảng, các phiên hoạt động và lập bản đồ mối quan hệ với cấu hình bằng không." : "Automated analysis of table sizes, active sessions, and relationship mapping with zero configuration."
                                },
                                {
                                    icon: <GitGraph className="w-6 h-6 text-purple-400" />,
                                    title: lang === 'vi' ? "ERD Động" : "Dynamic ERD",
                                    desc: lang === 'vi' ? "Sơ đồ mối quan hệ trực tiếp, tương tác phản ánh các thay đổi lược đồ của bạn trong thời gian thực. Xuất và thiết kế nhanh chóng." : "Live, interactive relationship diagrams that reflect your schema changes in real-time. Export and design on the fly."
                                },
                                {
                                    icon: <PieChart className="w-6 h-6 text-cyan-400" />,
                                    title: lang === 'vi' ? "Biểu đồ Tức thì" : "Instant Charts",
                                    desc: lang === 'vi' ? "Biến bất kỳ tập kết quả nào thành biểu đồ đẹp mắt chỉ với một cú nhấp chuột. Hỗ trợ hơn 15 loại biểu đồ hiện đại." : "Transform any result set into a beautiful chart with one click. 15+ modern chart types supported."
                                },
                                {
                                    icon: <Lock className="w-6 h-6 text-amber-500" />,
                                    title: lang === 'vi' ? "Đám mây & Cục bộ" : "Cloud & Local",
                                    desc: lang === 'vi' ? "Kết nối an toàn với Neon, Supabase hoặc thực thể Docker cục bộ của bạn. Thông tin xác thực của bạn không bao giờ rời khỏi màn hình." : "Securely connect to Neon, Supabase, or your local Docker instance. Your credentials never leave your screen."
                                }
                            ].map((feature, idx) => (
                                <div
                                    key={idx}
                                    ref={addToRevealRefs}
                                    className={cn(
                                        "reveal glass-panel p-6 md:p-8 rounded-3xl hover:bg-white/10 transition-all duration-500 hover:-translate-y-2 group cursor-default border-white/5",
                                        `stagger-${(idx % 3) + 1}`
                                    )}
                                >
                                    <div className="flex flex-col gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl group-hover:shadow-blue-500/10">
                                            {feature.icon}
                                        </div>
                                        <h3 className="font-black text-xl uppercase tracking-tight">{feature.title}</h3>
                                        <p className="text-muted-foreground leading-relaxed text-sm font-medium opacity-70 group-hover:opacity-100 transition-opacity">
                                            {feature.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* AI Spotlight Section */}
                <section className="py-12 md:py-16 relative overflow-hidden">
                    <div className="container mx-auto px-6">
                        <div ref={addToRevealRefs} className="reveal bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-white/10 relative overflow-hidden flex flex-col lg:flex-row items-center gap-8 md:gap-12">
                            <div className="flex-1 text-center lg:text-left">
                                <Badge className="mb-4 md:mb-6 bg-purple-500/20 text-purple-400 border-purple-500/30 font-black tracking-[0.2em] px-4 py-1">
                                    {lang === 'vi' ? 'MIỀN AI' : 'AI DOMAIN'}
                                </Badge>
                                <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 md:mb-8 uppercase leading-none">
                                    {lang === 'vi' ? <>Cơ sở dữ liệu, <br /> Thông minh Nhân tạo.</> : <>Your Database, <br /> Artificially Intelligent.</>}
                                </h1>
                                <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl font-medium">
                                    {lang === 'vi'
                                        ? 'AI nhận biết ngữ cảnh của chúng tôi không chỉ viết SQL. Nó hiểu toàn bộ lược đồ của bạn, tối ưu hóa khóa ngoại và gợi ý các mô hình kiến trúc tốt hơn.'
                                        : "Our context-aware AI doesn't just write SQL. It understands your entire schema, optimizes foreign keys, and suggests better architectural patterns."}
                                </p>
                                <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                                    <Button size="lg" onClick={() => navigate('/app')} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8">
                                        {lang === 'vi' ? 'Trò chuyện với Trợ lý' : 'Talk to Assistant'}
                                    </Button>
                                    <Button size="lg" variant="ghost" onClick={() => navigate('/docs')} className="text-xs font-bold text-muted-foreground hover:text-white uppercase tracking-widest">
                                        {lang === 'vi' ? 'Tìm hiểu cách hoạt động' : 'Learn how it works'}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 w-full max-w-xl">
                                <Card className="bg-black/40 border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl relative">
                                    <CardContent className="p-0">
                                        <div className="h-10 bg-white/5 border-b border-white/5 flex items-center px-4 justify-between">
                                            <div className="flex gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-blue-500/30" />
                                                <div className="w-2 h-2 rounded-full bg-blue-500/30" />
                                            </div>
                                            <Sparkles className="w-3 h-3 text-purple-500/50" />
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="flex gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex-shrink-0 flex items-center justify-center">
                                                    <Database className="w-4 h-4 text-blue-500" />
                                                </div>
                                                <div className="bg-blue-500/10 rounded-2xl p-4 text-xs text-blue-100/70 leading-relaxed font-medium">
                                                    "Summarize our largest customers and calculate churn risk based on the last 30 days of transactions."
                                                </div>
                                            </div>
                                            <div className="flex gap-4 justify-end">
                                                <div className="bg-purple-500/10 rounded-2xl p-4 text-xs text-purple-100/80 leading-relaxed font-mono border border-purple-500/20 animate-in fade-in zoom-in-95 duration-700 delay-500">
                                                    <span className="text-purple-400">WITH</span> monthly_stats <span className="text-purple-400">AS</span> (<br />
                                                    &nbsp;&nbsp;<span className="text-blue-400">SELECT</span> user_id, <span className="text-emerald-400">SUM</span>(amount)...<br />
                                                    )...
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex-shrink-0 flex items-center justify-center">
                                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-20 relative">
                    <div className="container mx-auto px-6">
                        <div ref={addToRevealRefs} className="reveal text-center mb-16 max-w-2xl mx-auto">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
                                {lang === 'vi' ? 'Bảng giá Minh bạch' : 'Transparent Pricing'}
                            </h2>
                            <p className="text-muted-foreground text-lg font-medium opacity-70">
                                {lang === 'vi'
                                    ? 'Bắt đầu miễn phí, mở rộng khi bạn sẵn sàng. Không phí ẩn, chỉ có sức mạnh thuần túy.'
                                    : "Start for free, scale when you're ready. No hidden fees, just raw power."}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                            {[
                                {
                                    tier: lang === 'vi' ? "Cộng đồng" : "Community",
                                    price: "$0",
                                    desc: lang === 'vi' ? "Hoàn hảo cho các nhà phát triển độc lập và sinh viên." : "Perfect for independent developers and students.",
                                    features: lang === 'vi'
                                        ? ["Kết nối DB cục bộ", "AI Cơ bản (Gemini Flash)", "Biểu đồ tiêu chuẩn", "Hỗ trợ SQLite & DuckDB"]
                                        : ["Local DB Connections", "Basic AI (Gemini Flash)", "Standard Charting", "SQLite & DuckDB support"],
                                    cta: lang === 'vi' ? "Bắt đầu ngay" : "Get Started",
                                    popular: false
                                },
                                {
                                    tier: "Pro",
                                    price: "$19",
                                    desc: lang === 'vi' ? "Công cụ nâng cao cho các chuyên gia dữ liệu và nhóm." : "Advanced tools for data professionals and teams.",
                                    features: lang === 'vi'
                                        ? ["Đồng bộ Cloud DB", "AI Nâng cao (Gemini Pro)", "Sơ đồ ER tương tác", "Truyền phát SSE ưu tiên", "Giấy phép thương mại"]
                                        : ["Cloud DB Syncing", "Advanced AI (Gemini Pro)", "Interactive ER Diagrams", "Priority SSE Streaming", "Commercial License"],
                                    cta: lang === 'vi' ? "Mua ngay" : "Buy Now",
                                    popular: true
                                },
                                {
                                    tier: lang === 'vi' ? "Doanh nghiệp" : "Enterprise",
                                    price: lang === 'vi' ? "Liên hệ" : "Custom",
                                    desc: lang === 'vi' ? "Hạ tầng dành riêng cho các tổ chức ưu tiên bảo mật." : "Dedicated infrastructure for security-first organizations.",
                                    features: lang === 'vi'
                                        ? ["Thực thể AI riêng biệt", "Xác thực SSO & SAML", "Nhật ký kiểm tra", "Gắn nhãn trắng", "Quản lý tài khoản riêng"]
                                        : ["Dedicated AI Instance", "SSO & SAML Auth", "Audit Logging", "White-labeling", "Dedicated Account Manager"],
                                    cta: lang === 'vi' ? "Liên hệ Sales" : "Contact Sales",
                                    popular: false
                                }
                            ].map((pkg, i) => (
                                <div key={i} ref={addToRevealRefs} className={cn(
                                    "reveal glass-panel p-8 rounded-3xl border flex flex-col items-start gap-6 relative group transition-all duration-500",
                                    pkg.popular ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20 scale-105" : "border-white/5",
                                    `stagger-${i + 1}`
                                )}>
                                    {pkg.popular && (
                                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white font-black px-4 py-1">MOST POPULAR</Badge>
                                    )}
                                    <div className="space-y-1">
                                        <h3 className="font-black text-xl text-foreground uppercase tracking-tight">{pkg.tier}</h3>
                                        <p className="text-xs text-muted-foreground font-medium h-8">{pkg.desc}</p>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black">{pkg.price}</span>
                                        {pkg.price !== "Custom" && <span className="text-muted-foreground text-xs font-medium">/month</span>}
                                    </div>
                                    <div className="w-full h-px bg-white/5" />
                                    <ul className="space-y-3 flex-1 mb-4">
                                        {pkg.features.map(f => (
                                            <li key={f} className="flex items-center gap-2 text-xs font-medium text-muted-foreground/80">
                                                <Zap className="w-3 h-3 text-blue-500" /> {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <Button className={cn(
                                        "w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-12",
                                        pkg.popular ? "bg-blue-600 hover:bg-blue-700 text-white" : "glass-panel bg-white/5 hover:bg-white/10"
                                    )}>
                                        {pkg.cta}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Documentation CTA Section */}
                <section id="docs" className="pb-32 relative">
                    <div className="container mx-auto px-6">
                        <div ref={addToRevealRefs} className="reveal glass-panel p-8 md:p-12 rounded-[2.5rem] border-white/5 bg-gradient-to-r from-background to-muted/20 flex flex-col md:flex-row items-center justify-between gap-10">
                            <div className="max-w-xl space-y-6">
                                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">
                                    {lang === 'vi' ? 'Bạn đã sẵn sàng đi sâu hơn?' : 'Ready to dive deeper?'}
                                </h2>
                                <p className="text-lg text-muted-foreground/80 font-medium">
                                    {lang === 'vi'
                                        ? 'Tài liệu toàn diện của chúng tôi bao gồm mọi thứ từ thiết lập ban đầu đến kỹ thuật AI nâng cao.'
                                        : 'Our comprehensive documentation covers everything from initial setup to advanced AI prompt engineering.'}
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                                        <BookOpen className="w-5 h-5 text-blue-400" />
                                        <span className="text-xs font-bold">{lang === 'vi' ? 'Tham chiếu API' : 'API Reference'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                                        <Layers className="w-5 h-5 text-purple-400" />
                                        <span className="text-xs font-bold">{lang === 'vi' ? 'Kiến trúc' : 'Architecture'}</span>
                                    </div>
                                </div>
                            </div>
                            <Button size="lg" onClick={() => navigate('/docs')} className="h-16 px-12 rounded-2xl bg-white text-black hover:bg-gray-200 shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                                <span className="text-xs font-black uppercase tracking-[0.2em]">
                                    {lang === 'vi' ? 'Mở Tài liệu' : 'Open Documentation'}
                                </span>
                                <ExternalLink className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-white/5 bg-background/50 backdrop-blur-xl pt-12 md:pt-16 pb-12">
                    <div className="container mx-auto px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12 mb-12 md:mb-20">
                            <div className="col-span-2 lg:col-span-2">
                                <div className="flex items-center gap-3 font-black text-2xl mb-6 tracking-tighter uppercase">
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <Database className="w-4 h-4 text-white" />
                                    </div>
                                    <span>DataExplorer</span>
                                </div>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs mb-8 opacity-70">
                                    Precision engineered data tools for the next generation of engineers. Built with speed and security at its core.
                                </p>
                                <div className="flex gap-5">
                                    <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                        <Github className="w-5 h-5" />
                                    </a>
                                    <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                        <Twitter className="w-5 h-5" />
                                    </a>
                                    <a href="#" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                        <Disc className="w-5 h-5" />
                                    </a>
                                </div>
                            </div>

                            {[
                                { title: lang === 'vi' ? 'Sản phẩm' : 'Product', links: lang === 'vi' ? ['Tính năng', 'AI Insights', 'Sơ đồ', 'Nhật ký thay đổi'] : ['Features', 'AI Insights', 'Diagrams', 'Changelog'] },
                                { title: lang === 'vi' ? 'Tài nguyên' : 'Resources', links: lang === 'vi' ? ['Tài liệu', 'Tham chiếu API', 'Đồng bộ Cloud', 'Trạng thái'] : ['Documentation', 'API Reference', 'Cloud Sync', 'Status'] },
                                { title: lang === 'vi' ? 'Pháp lý' : 'Legal', links: lang === 'vi' ? ['Quyền riêng tư', 'Điều khoản', 'Bảo mật', 'Tuân thủ'] : ['Privacy', 'Terms', 'Security', 'Compliance'] }
                            ].map((col, i) => (
                                <div key={i}>
                                    <h4 className="font-black mb-6 text-xs tracking-[0.2em] uppercase text-foreground/80">{col.title}</h4>
                                    <ul className="space-y-4 text-sm font-medium text-muted-foreground/60">
                                        {col.links.map(link => (
                                            <li key={link}><a href="#" className="hover:text-blue-500 transition-colors">{link}</a></li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                © 2026 ANTIGRAVITY ENGINE. {lang === 'vi' ? 'TẤT CẢ HỆ THỐNG ĐÃ ĐƯỢC MÃ HÓA.' : 'ALL SYSTEMS ENCRYPTED.'}
                            </p>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                                        {lang === 'vi' ? 'Trạng thái: Hoạt động' : 'Live Status: Nominal'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 group cursor-pointer">
                                    <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors">
                                        {lang === 'vi' ? 'Tiếng Việt' : 'English (US)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};
