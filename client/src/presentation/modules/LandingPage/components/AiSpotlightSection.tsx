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

    return (
        <section className="py-12 md:py-16 relative overflow-hidden">
            <div className="container mx-auto px-6">
                <div ref={addToRevealRefs} className="reveal bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 border border-white/10 relative overflow-hidden flex flex-col lg:flex-row items-center gap-8 md:gap-12">
                    <div className="flex-1 text-center lg:text-left">
                        <Badge className="mb-4 md:mb-6 bg-purple-500/20 text-purple-400 border-purple-500/30 font-black tracking-[0.2em] px-4 py-1">
                            {lang === 'vi' ? 'GEMINI 3.1 FLASH-LITE' : 'GEMINI 3.1 FLASH-LITE'}
                        </Badge>
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 md:mb-8 uppercase leading-none">
                            {lang === 'vi' ? <>Trợ lý Dữ liệu <br /> AI Đa Phương Thức.</> : <>The Ultimate <br /> AI Data Assistant.</>}
                        </h1>
                        <p className="text-lg text-muted-foreground/80 mb-10 max-w-xl font-medium">
                            {lang === 'vi'
                                ? 'Phân tích tự động 100% Data Schema của bạn. Dùng ngôn ngữ tự nhiên để truy vấn dữ liệu phức tạp. Với Multimodal Vision, Gemini 3.1 còn có thể đọc sơ đồ ERD bằng hình ảnh và tái tạo cấu trúc DB.'
                                : "Automatically parses 100% of your Data Schema. Use natural language to perform complex queries. With Multimodal Vision, the AI can even read ERD image diagrams and reconstruct DB structures."}
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                            <Button size="lg" onClick={() => navigate('/sql-explorer')} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[10px] h-12 px-8">
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
    );
};
