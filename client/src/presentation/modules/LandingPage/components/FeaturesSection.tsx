import React from 'react';
import { Terminal, Zap, BarChart3, GitGraph, PieChart, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeaturesSectionProps {
    lang: string;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ lang }) => {
    const features = [
        {
            icon: <Terminal className="w-6 h-6 text-blue-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Monaco Pro" : "Monaco Pro",
            desc: lang === 'vi' ? "Trình soạn thảo VS Code tích hợp hoàn hảo. Đầy đủ Intellisense, đa con trỏ và hiệu suất cực cao cho các câu lệnh SQL phức tạp." : "Seamlessly integrated VS Code editor. Full Intellisense, multi-cursor, and ultra-high performance for complex SQL queries."
        },
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Gemini 3.1 Flash-Lite" : "Gemini 3.1 Flash-Lite",
            desc: lang === 'vi' ? "Dịch ngôn ngữ tự nhiên sang SQL thông minh vượt trội. Tối ưu hóa cho các mô hình dữ liệu phức tạp và kiến trúc doanh nghiệp." : "Supreme natural language to SQL translation. Optimized for complex data models and enterprise architectures."
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-emerald-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Kiến trúc Modular" : "Modular Core",
            desc: lang === 'vi' ? "Xây dựng trên nguyên tắc SOLID & Clean Architecture. Dễ dàng mở rộng, bảo trì và tích hợp các module mới như Otp, Seed, Token." : "Built on SOLID & Clean Architecture. Easy to extend, maintain, and integrate new modules like Otp, Seed, and Token."
        },
        {
            icon: <GitGraph className="w-6 h-6 text-purple-400" aria-hidden="true" />,
            title: lang === 'vi' ? "ERD & Vision AI" : "ERD & Vision AI",
            desc: lang === 'vi' ? "Phân tích lược đồ bằng Multimodal Vision. Tự động ánh xạ mối quan hệ và gợi ý tối ưu hóa cấu trúc database thông minh." : "Schema analysis via Multimodal Vision. Automatic relationship mapping and intelligent database structure optimization suggestions."
        },
        {
            icon: <PieChart className="w-6 h-6 text-cyan-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Biểu đồ Tức thì" : "Instant Analytics",
            desc: lang === 'vi' ? "Biến dữ liệu thô thành biểu đồ cao cấp chỉ với một cú nhấp chuột. Hỗ trợ đa dạng loại biểu đồ với hiệu suất rendering mượt mà." : "Transform raw data into premium charts with a single click. Supports diverse chart types with smooth rendering performance."
        },
        {
            icon: <Lock className="w-6 h-6 text-amber-500" aria-hidden="true" />,
            title: lang === 'vi' ? "Bảo mật AES-256-GCM" : "AES-256-GCM Secure",
            desc: lang === 'vi' ? "Mã hóa cấp quân đội cho mọi thông tin xác thực. Dữ liệu của bạn được bảo vệ tuyệt đối và không bao giờ rời khỏi tầm kiểm soát." : "Military-grade encryption for all credentials. Your data is absolutely protected and never leaves your control."
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const cardVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5, ease: "easeOut" as any }
        }
    };

    return (
        <section id="features" className="py-24 md:py-32 relative bg-black/20">
            <div className="container mx-auto px-4 sm:px-6 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16 md:mb-24 max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 md:mb-8 uppercase bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                        {lang === 'vi' ? 'Trí tuệ hợp nhất' : 'Unified Intelligence'}
                    </h2>
                    <p className="text-muted-foreground text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
                        {lang === 'vi'
                            ? 'Không chỉ là một trình chỉnh sửa. Đó là trung tâm chỉ huy cho dữ liệu của bạn, được xây dựng với sự tinh xảo hiện đại.'
                            : 'Not just an editor. A command center for your data, built with modern craftsmanship.'}
                    </p>
                </motion.div>

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
                >
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            variants={cardVariants}
                            whileHover={{ 
                                scale: 1.02, 
                                rotateX: 5, 
                                rotateY: -5,
                                z: 50
                            }}
                            className="glass-panel p-8 md:p-10 rounded-[2.5rem] border-white/5 hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden preserve-3d shadow-2xl"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex flex-col gap-8 relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-blue-600/10 group-hover:scale-110 transition-all duration-500 shadow-2xl">
                                    {feature.icon}
                                </div>
                                <div>
                                    <h3 className="font-black text-2xl uppercase tracking-tight mb-4 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                                    <p className="text-muted-foreground/60 leading-relaxed text-sm font-medium group-hover:text-white/80 transition-colors">
                                        {feature.desc}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};
