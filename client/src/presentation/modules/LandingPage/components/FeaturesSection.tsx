import React from 'react';
import { Terminal, Zap, BarChart3, GitGraph, PieChart, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeaturesSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ lang, addToRevealRefs }) => {
    const features = [
        {
            icon: <Terminal className="w-6 h-6 text-blue-400" />,
            title: lang === 'vi' ? "Monaco Pro" : "Monaco Pro",
            desc: lang === 'vi' ? "Trình soạn thảo VS Code tích hợp hoàn hảo. Đầy đủ Intellisense, đa con trỏ và hiệu suất cực cao cho các câu lệnh SQL phức tạp." : "Seamlessly integrated VS Code editor. Full Intellisense, multi-cursor, and ultra-high performance for complex SQL queries."
        },
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" />,
            title: lang === 'vi' ? "Gemini 3.1 Flash-Lite" : "Gemini 3.1 Flash-Lite",
            desc: lang === 'vi' ? "Dịch ngôn ngữ tự nhiên sang SQL thông minh vượt trội. Tối ưu hóa cho các mô hình dữ liệu phức tạp và kiến trúc doanh nghiệp." : "Supreme natural language to SQL translation. Optimized for complex data models and enterprise architectures."
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-emerald-400" />,
            title: lang === 'vi' ? "Kiến trúc Modular" : "Modular Core",
            desc: lang === 'vi' ? "Xây dựng trên nguyên tắc SOLID & Clean Architecture. Dễ dàng mở rộng, bảo trì và tích hợp các module mới như Otp, Seed, Token." : "Built on SOLID & Clean Architecture. Easy to extend, maintain, and integrate new modules like Otp, Seed, and Token."
        },
        {
            icon: <GitGraph className="w-6 h-6 text-purple-400" />,
            title: lang === 'vi' ? "ERD & Vision AI" : "ERD & Vision AI",
            desc: lang === 'vi' ? "Phân tích lược đồ bằng Multimodal Vision. Tự động ánh xạ mối quan hệ và gợi ý tối ưu hóa cấu trúc database thông minh." : "Schema analysis via Multimodal Vision. Automatic relationship mapping and intelligent database structure optimization suggestions."
        },
        {
            icon: <PieChart className="w-6 h-6 text-cyan-400" />,
            title: lang === 'vi' ? "Biểu đồ Tức thì" : "Instant Analytics",
            desc: lang === 'vi' ? "Biến dữ liệu thô thành biểu đồ cao cấp chỉ với một cú nhấp chuột. Hỗ trợ đa dạng loại biểu đồ với hiệu suất rendering mượt mà." : "Transform raw data into premium charts with a single click. Supports diverse chart types with smooth rendering performance."
        },
        {
            icon: <Lock className="w-6 h-6 text-amber-500" />,
            title: lang === 'vi' ? "Bảo mật AES-256-GCM" : "AES-256-GCM Secure",
            desc: lang === 'vi' ? "Mã hóa cấp quân đội cho mọi thông tin xác thực. Dữ liệu của bạn được bảo vệ tuyệt đối và không bao giờ rời khỏi tầm kiểm soát." : "Military-grade encryption for all credentials. Your data is absolutely protected and never leaves your control."
        }
    ];

    return (
        <section id="features" className="py-12 md:py-16 relative">
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
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
                    {features.map((feature, idx) => (
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
    );
};
