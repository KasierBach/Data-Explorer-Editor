import React from 'react';
import { Terminal, Database, Sparkles, ChevronRight } from 'lucide-react';
import { Badge } from '@/presentation/components/ui/badge';

interface DemoMockupProps {
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const DemoMockup: React.FC<DemoMockupProps> = ({ addToRevealRefs }) => {
    return (
        <div id="demo" ref={addToRevealRefs} className="reveal container mx-auto px-4 sm:px-6 mt-10 md:mt-16 max-w-6xl">
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
                                        <Database className="w-3.5 h-3.5 text-blue-400" />
                                        production_pg (Postgres)
                                    </div>
                                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 text-muted-foreground/50 text-xs group-hover:text-muted-foreground transition-colors">
                                        <Database className="w-3.5 h-3.5 text-green-500/50" />
                                        mongodb_atlas (NoSQL)
                                    </div>
                                    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/5 text-muted-foreground/50 text-xs group-hover:text-muted-foreground transition-colors">
                                        <Database className="w-3.5 h-3.5 text-red-500/50" />
                                        mssql_legacy (SQL Server)
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
    );
};
