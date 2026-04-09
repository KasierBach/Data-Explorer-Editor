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
            title: lang === 'vi' ? "Monaco Editor" : "Monaco Editor",
            desc: lang === 'vi' ? "Trình soạn thảo mã chuyên nghiệp với Auto-Complete, gợi ý cấu trúc bảng trực tiếp bằng AI và Schema Intellisense." : "Professional grade editor with precise Auto-complete, AI-driven schema suggestions, and Intellisense."
        },
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Hỗ Trợ SQL & NoSQL" : "SQL & NoSQL Engines",
            desc: lang === 'vi' ? "Kết nối và thao tác trên PostgreSQL, MySQL, SQL Server, và MongoDB Atlas... tất cả trong một nền tảng duy nhất." : "Query across PostgreSQL, MySQL, SQL Server, and MongoDB Atlas seamlessly from a single unified workspace."
        },
        {
            icon: <GitGraph className="w-6 h-6 text-purple-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Live ERD Visualizer" : "Live ERD Visualizer",
            desc: lang === 'vi' ? "Tự động phân tích và tạo sơ đồ quan hệ (ERD) bằng React Flow. Cung cấp góc nhìn tổng quan 100% rõ ràng về kiến trúc database." : "Automatically generate and explore interactive Entity Relationship Diagrams (ERD) powered by React Flow."
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-emerald-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Gemini 3.1 AI Agent" : "Gemini 3.1 AI Agent",
            desc: lang === 'vi' ? "Sức mạnh AI Assistant phân tích ngữ cảnh, giúp bạn tạo SQL bằng ngôn ngữ tự nhiên hoặc sửa lỗi tối ưu hóa Query." : "Context-aware AI understands your schema, converts natural language to SQL, and highlights query bugs."
        },
        {
            icon: <Lock className="w-6 h-6 text-amber-500" aria-hidden="true" />,
            title: lang === 'vi' ? "Bảo mật & Phân Quyền" : "Enterprise Security",
            desc: lang === 'vi' ? "Phân quyền cực sâu bằng RBAC. Mã hóa mật khẩu DB bằng AES-256-GCM. Hỗ trợ đăng nhập Single Sign On (SSO)." : "Deep RBAC, AES-256-GCM encrypted connections, and seamless OAuth (SSO) integration."
        },
        {
            icon: <PieChart className="w-6 h-6 text-cyan-400" aria-hidden="true" />,
            title: lang === 'vi' ? "Lịch Sử & Export" : "History & Data Export",
            desc: lang === 'vi' ? "Giám sát thời gian thực thi, giữ lại lịch sử câu lệnh, và hỗ trợ xuất dữ liệu ra file CSV, JSON hoặc chèn script SQL." : "Track query timings, retain execution history, and instantly export data grids to CSV, JSON, or SQL format."
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
