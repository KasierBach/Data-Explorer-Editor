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
            title: lang === 'vi' ? "Hỗ Trợ SQL & NoSQL Toàn Diện" : "Universal SQL & NoSQL Power",
            desc: lang === 'vi' ? "Trải nghiệm đồng nhất giữa PostgreSQL, MySQL và MongoDB với bộ phím tắt, menu và công cụ Trực quan hóa (Visualize) dùng chung." : "Unified experience across SQL & NoSQL. Share same shortcuts, menus, and Visualize designers between relational and document databases."
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
            desc: lang === 'vi' ? "Bảo mật đa lớp: Chặn đứng SQL injection lồng nhau, triệt phá SSRF qua Tunnel, siết chặt riêng tư Team và mã hóa AES-256-GCM toàn diện." : "Multi-layer security: Reinforced SQL Guard, SSRF tunnel protection, strict team privacy, and AES-256-GCM encryption."
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
                    <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 md:mb-8 bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">
                        {lang === 'vi' ? 'Trí tuệ hợp nhất' : 'Unified Intelligence'}
                    </h2>
                    <p className="text-muted-foreground/80 text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
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
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10"
                >
                    {features.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            variants={cardVariants}
                            whileHover={{ 
                                scale: 1.03, 
                                z: 50
                            }}
                            // Loại bỏ col-span-2 do thiếu ảnh Graphic phụ họa, dùng lưới 3 cột cân đối
                            className="p-8 md:p-10 rounded-[2rem] border border-white/10 hover:border-blue-400/50 transition-all duration-300 group relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.4)] bg-[#0f111a]/60 backdrop-blur-3xl flex flex-col items-center text-center"
                        >
                            {/* Ánh sáng tĩnh dưới đáy card */}
                            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/20 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                            
                            {/* Ánh sáng chạy viền lấp lánh (Sweep light) */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 ease-in-out" />
                            
                            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/20 flex items-center justify-center group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] group-hover:bg-blue-600/20 group-hover:scale-110 transition-all duration-500 shadow-xl text-white">
                                    {feature.icon}
                                </div>
                                <div className="mt-2">
                                    <h3 className="font-extrabold text-xl lg:text-2xl tracking-tight mb-3 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-300 transition-all">{feature.title}</h3>
                                    <p className="text-muted-foreground/80 leading-relaxed text-sm lg:text-base font-medium group-hover:text-white/90 transition-colors">
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
