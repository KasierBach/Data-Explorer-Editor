import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Sparkles } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { Card, CardContent } from '@/presentation/components/ui/card';

interface AiSpotlightSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const AiSpotlightSection: React.FC<AiSpotlightSectionProps> = ({ lang, addToRevealRefs }) => {
    const navigate = useNavigate();
    const text = lang === 'vi'
        ? {
            badge: 'AI THEO TỪNG VAI TRÒ',
            titleLine1: 'Trợ lý dữ liệu AI',
            titleLine2: 'theo cách bạn chọn.',
            description: 'Chọn model riêng cho Assistant, Explain, AI SQL, AI NoSQL và Autocomplete. Nếu cần, bạn có thể thêm provider OpenAI-compatible của riêng mình rồi tải danh sách model trực tiếp từ endpoint đó.',
            primaryAction: 'Mở SQL Workspace',
            secondaryAction: 'Xem tài liệu AI',
            prompt: '"Phân tích bảng orders 200k dòng, gợi ý index cần thêm và giải thích lý do."',
            snippetLine1: 'EXPLAIN ANALYZE',
            snippetLine2: 'SELECT tenant_id, SUM(amount) total_amount',
            snippetLine3: 'FROM perf_orders_200k_v1',
            snippetLine4: "WHERE created_at >= NOW() - INTERVAL '30 days'",
        }
        : {
            badge: 'ROLE-BASED AI',
            titleLine1: 'An AI data copilot',
            titleLine2: 'you can actually route.',
            description: 'Use separate models for Assistant, Explain, AI SQL, AI NoSQL, and Autocomplete. If needed, add your own OpenAI-compatible provider and fetch its model catalog directly from the endpoint.',
            primaryAction: 'Open SQL workspace',
            secondaryAction: 'Read AI docs',
            prompt: '"Review the 200k-row orders table, suggest the right indexes, and explain why."',
            snippetLine1: 'EXPLAIN ANALYZE',
            snippetLine2: 'SELECT tenant_id, SUM(amount) total_amount',
            snippetLine3: 'FROM perf_orders_200k_v1',
            snippetLine4: "WHERE created_at >= NOW() - INTERVAL '30 days'",
        };

    return (
        <section className="py-12 md:py-16 relative overflow-hidden">
            <div className="container mx-auto px-6">
                <div ref={addToRevealRefs} className="reveal bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-white/10 relative overflow-hidden flex flex-col lg:flex-row items-center gap-8 md:gap-12">
                    <div className="flex-1 text-center lg:text-left">
                        <Badge className="mb-4 md:mb-6 bg-purple-500/20 text-purple-400 border-purple-500/30 font-black tracking-[0.2em] px-4 py-1">
                            {text.badge}
                        </Badge>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 md:mb-8 uppercase leading-none">
                            <>{text.titleLine1} <br /> {text.titleLine2}</>
                        </h1>
                        <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl font-medium">
                            {text.description}
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                            <Button size="lg" onClick={() => navigate('/sql-explorer')} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8">
                                {text.primaryAction}
                            </Button>
                            <Button size="lg" variant="ghost" onClick={() => navigate('/docs')} className="text-xs font-bold text-muted-foreground hover:text-white uppercase tracking-widest">
                                {text.secondaryAction}
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
                                            {text.prompt}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 justify-end">
                                        <div className="bg-purple-500/10 rounded-2xl p-4 text-xs text-purple-100/80 leading-relaxed font-mono border border-purple-500/20 animate-in fade-in zoom-in-95 duration-700 delay-500">
                                            <span className="text-purple-400">{text.snippetLine1}</span><br />
                                            <span className="text-blue-400">{text.snippetLine2}</span><br />
                                            {text.snippetLine3}<br />
                                            <span className="text-emerald-400">{text.snippetLine4}</span>
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
    );
};
