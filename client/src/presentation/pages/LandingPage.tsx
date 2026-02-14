import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import {
    Database,
    Zap,
    BarChart3,
    ArrowRight,
    Terminal,
    Sparkles,
    Cpu,
    Lock,
    Github,
    Twitter,
    Disc
} from 'lucide-react';
import { useAppStore } from '@/core/services/store';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, logout } = useAppStore();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden relative">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 z-0 opacity-20 dark:opacity-30 pointer-events-none">
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

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
                        <a href="#features" className="hover:text-blue-500 transition-colors">Features</a>
                        <a href="#demo" className="hover:text-blue-500 transition-colors">Live Demo</a>
                        <a href="#docs" className="hover:text-blue-500 transition-colors">Docs</a>
                        <a href="#pricing" className="hover:text-blue-500 transition-colors">Pricing</a>
                    </nav>

                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" onClick={() => { logout(); navigate('/login'); }} className="hidden sm:flex hover:bg-red-500/10 hover:text-red-500">
                                    Log out
                                </Button>
                                <Button onClick={() => navigate('/app')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95">
                                    Go to App
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:flex hover:bg-blue-500/10 hover:text-blue-500">
                                    Log in
                                </Button>
                                <Button onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95">
                                    Get Started
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col relative z-10">
                {/* Hero Section */}
                <section className="relative pt-32 pb-20 md:pt-48 md:pb-32">
                    <div className="container mx-auto px-6 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8 animate-fade-in-up backdrop-blur-sm">
                            <Sparkles className="w-3 h-3" />
                            <span>v2.0: SQL Server & AI Insights Enabled</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent max-w-5xl mx-auto leading-[1.1] animate-fade-in-up [animation-delay:100ms] drop-shadow-sm">
                            The Professional SQL Editor <br />
                            <span className="text-blue-500 relative">
                                for Modern Teams
                                <svg className="absolute w-full h-3 -bottom-1 left-0 text-blue-500/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                                </svg>
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-muted-foreground/90 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up [animation-delay:200ms]">
                            Stop switching between tools. Query PostgreSQL, MySQL, and SQL Server in one unified interface.
                            Generate charts instantly. Secure, local, and incredibly fast.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up [animation-delay:300ms]">
                            <Button size="lg" onClick={() => navigate(isAuthenticated ? '/app' : '/login')} className="h-14 px-8 text-base bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 w-full sm:w-auto rounded-full transition-all hover:-translate-y-1">
                                {isAuthenticated ? 'Open Workspace' : 'Start Analyzing Free'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-14 px-8 text-base w-full sm:w-auto glass-panel hover:bg-white/10 rounded-full border-white/10">
                                View Documentation
                            </Button>
                        </div>
                    </div>

                    {/* Dashboard Mockup */}
                    <div id="demo" className="container mx-auto px-6 mt-20 relative animate-fade-in-up [animation-delay:500ms]">
                        <div className="relative rounded-xl border border-white/10 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] group ring-1 ring-white/10">
                            {/* Real-world UI Mockup */}
                            <div className="h-full flex divide-x divide-white/5">
                                {/* Sidebar */}
                                <div className="w-64 bg-muted/20 hidden md:flex flex-col p-4 gap-4">
                                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Explorer</div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm p-2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Production_DB
                                        </div>
                                        <div className="flex items-center gap-2 text-sm p-2 rounded hover:bg-white/5 text-muted-foreground/80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                                            Staging_Analytics
                                        </div>
                                    </div>
                                </div>

                                {/* Main Area */}
                                <div className="flex-1 flex flex-col">
                                    {/* Tab Strip */}
                                    <div className="h-10 border-b border-white/5 flex items-center px-4 bg-white/5">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Terminal className="w-3.5 h-3.5" />
                                            <span>Query_1.sql</span>
                                        </div>
                                    </div>
                                    {/* Editor content */}
                                    <div className="h-[45%] p-5 font-mono text-sm leading-7 text-gray-300 relative bg-black/5">
                                        <div><span className="text-blue-400">SELECT</span> <span className="text-purple-400">DATE_TRUNC</span>(<span className="text-green-400">'month'</span>, created_at) <span className="text-blue-400">as</span> month,</div>
                                        <div>&nbsp;&nbsp;<span className="text-purple-400">COUNT</span>(*) <span className="text-blue-400">as</span> total_users,</div>
                                        <div>&nbsp;&nbsp;<span className="text-purple-400">SUM</span>(revenue) <span className="text-blue-400">as</span> mrr</div>
                                        <div><span className="text-blue-400">FROM</span> subscriptions</div>
                                        <div><span className="text-blue-400">WHERE</span> status = <span className="text-green-400">'active'</span></div>
                                        <div><span className="text-blue-400">GROUP BY</span> 1 <span className="text-blue-400">ORDER BY</span> 1 <span className="text-blue-400">DESC</span> <span className="text-blue-400">LIMIT</span> 12;</div>

                                        {/* AI Floating Suggestion */}
                                        <div className="absolute top-6 right-6 glass-panel py-2 px-3 rounded-lg flex items-center gap-2 animate-float border-l-2 border-l-yellow-400">
                                            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                                            <span className="text-xs text-yellow-100/80">Suggestion: Add year-over-year comparison?</span>
                                        </div>
                                    </div>

                                    {/* Results */}
                                    <div className="flex-1 bg-background/50 border-t border-white/5 p-4 flex gap-4">
                                        <div className="flex-1 border border-white/5 rounded-lg bg-black/20 p-3 relative overflow-hidden">
                                            <div className="grid grid-cols-3 gap-4 text-[10px] font-bold text-muted-foreground mb-2 border-b border-white/5 pb-2">
                                                <div>MONTH</div>
                                                <div>TOTAL_USERS</div>
                                                <div>MRR</div>
                                            </div>
                                            <div className="space-y-2 text-xs font-mono text-gray-300">
                                                <div className="grid grid-cols-3 gap-4"><div>2023-11-01</div><div>1,240</div><div className="text-green-400">$45,200</div></div>
                                                <div className="grid grid-cols-3 gap-4"><div>2023-10-01</div><div>1,150</div><div className="text-green-400">$41,800</div></div>
                                                <div className="grid grid-cols-3 gap-4"><div>2023-09-01</div><div>980</div><div className="text-green-400">$38,100</div></div>
                                            </div>
                                        </div>
                                        <div className="w-1/3 border border-white/5 rounded-lg bg-black/20 p-3 flex items-end justify-between gap-1">
                                            {[40, 60, 55, 80, 70, 90].map((h, i) => (
                                                <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-blue-500/80 rounded-t-sm hover:bg-blue-400 transition-colors" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section id="features" className="py-32 relative">
                    <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-blue-900/5 to-transparent pointer-events-none" />
                    <div className="container mx-auto px-6 relative z-10">
                        <div className="text-center mb-20">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Everything you need, nothing you don't.</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Built for developers who hate bloated enterprise software. Data Explorer is lean, fast, and local.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                {
                                    icon: <Terminal className="w-6 h-6 text-blue-400" />,
                                    title: "Advanced SQL Editor",
                                    desc: "Monaco-based editor with Intellisense, auto-complete, and multi-cursor support. It feels just like VS Code."
                                },
                                {
                                    icon: <Cpu className="w-6 h-6 text-purple-400" />,
                                    title: "Local-First Processing",
                                    desc: "Your data never leaves your network. Direct TCP connections ensure low latency and maximum security."
                                },
                                {
                                    icon: <BarChart3 className="w-6 h-6 text-green-400" />,
                                    title: "Instant Visualizations",
                                    desc: "Turn query results into interactive charts in one click. No export-to-Excel needed to see the trends."
                                },
                                {
                                    icon: <Zap className="w-6 h-6 text-yellow-400" />,
                                    title: "AI Query Assistant",
                                    desc: "Describe what you want in English, get optimized SQL back. Context-aware based on your schema."
                                },
                                {
                                    icon: <Lock className="w-6 h-6 text-red-400" />,
                                    title: "Enterprise Grade Security",
                                    desc: "AES-256 encryption for all credentials. Role-based access logs and audit trails included."
                                },
                                {
                                    icon: <Database className="w-6 h-6 text-cyan-400" />,
                                    title: "Multi-Database Support",
                                    desc: "PostgreSQL, MySQL, SQL Server, and ClickHouse supported out of the box. Unified interface for all."
                                }
                            ].map((feature, idx) => (
                                <div key={idx} className="glass-panel p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 group cursor-default border border-white/5">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform">
                                            {feature.icon}
                                        </div>
                                        <h3 className="font-bold text-lg">{feature.title}</h3>
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">
                                        {feature.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Professional Fat Footer */}
                <footer className="border-t border-white/5 bg-background/50 backdrop-blur-lg pt-16 pb-8">
                    <div className="container mx-auto px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
                            <div className="col-span-2 lg:col-span-2">
                                <div className="flex items-center gap-2 font-bold text-xl mb-4">
                                    <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                                        <Database className="w-3 h-3 text-white" />
                                    </div>
                                    <span>DataExplorer</span>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-6">
                                    The modern SQL client for data teams who prioritize speed, security, and user experience.
                                </p>
                                <div className="flex gap-4">
                                    <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                                        <Github className="w-4 h-4" />
                                    </a>
                                    <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                                        <Twitter className="w-4 h-4" />
                                    </a>
                                    <a href="#" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                                        <Disc className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold mb-4 text-sm tracking-wider uppercase text-foreground/80">Product</h4>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Features</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Integrations</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Changelog</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Roadmap</a></li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold mb-4 text-sm tracking-wider uppercase text-foreground/80">Resources</h4>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Documentation</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">API Reference</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Community</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold mb-4 text-sm tracking-wider uppercase text-foreground/80">Legal</h4>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
                                    <li><a href="#" className="hover:text-blue-400 transition-colors">Security</a></li>
                                </ul>
                            </div>
                        </div>

                        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                            <p className="text-xs text-muted-foreground/60">
                                © 2025 Data Explorer Inc. All rights reserved.
                            </p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                <span className="text-xs text-muted-foreground font-mono">ALL SYSTEMS OPERATIONAL</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};
