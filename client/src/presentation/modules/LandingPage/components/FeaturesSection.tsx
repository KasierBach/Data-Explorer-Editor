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
