import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Layers, ExternalLink } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface DocsCtaSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const DocsCtaSection: React.FC<DocsCtaSectionProps> = ({ lang, addToRevealRefs }) => {
    const navigate = useNavigate();

    return (
        <section id="docs" className="pb-32 relative">
            <div className="container mx-auto px-4 sm:px-6">
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
    );
};
