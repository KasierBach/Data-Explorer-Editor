import React from 'react';
import { Terminal, Zap, BarChart3, GitGraph, PieChart, Lock } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface FeaturesSectionProps {
    lang: string;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ lang }) => {
    const text = getWorkspaceText(lang).featuresSection;
    const features = [
        {
            icon: <Terminal className="w-6 h-6 text-blue-400" aria-hidden="true" />,
            ...text.features[0],
        },
        {
            icon: <Zap className="w-6 h-6 text-yellow-400" aria-hidden="true" />,
            ...text.features[1],
        },
        {
            icon: <GitGraph className="w-6 h-6 text-purple-400" aria-hidden="true" />,
            ...text.features[2],
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-emerald-400" aria-hidden="true" />,
            ...text.features[3],
        },
        {
            icon: <Lock className="w-6 h-6 text-amber-500" aria-hidden="true" />,
            ...text.features[4],
        },
        {
            icon: <PieChart className="w-6 h-6 text-cyan-400" aria-hidden="true" />,
            ...text.features[5],
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

    const cardVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.5, ease: "easeOut" }
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
                        {text.title}
                    </h2>
                    <p className="text-muted-foreground/80 text-lg md:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
                        {text.description}
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
                                        {feature.description}
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
