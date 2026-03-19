import React from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, Cpu, Search } from 'lucide-react';

interface WorkflowSectionProps {
    lang: string;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({ lang }) => {
    const steps = [
        {
            icon: <Search className="w-6 h-6" />,
            title: lang === 'vi' ? 'Khám phá' : 'Discovery',
            desc: lang === 'vi' ? 'Tự động quét và lập chỉ mục toàn bộ lược đồ dữ liệu của bạn.' : 'Auto-scans and indexes your entire data schema instantly.',
            color: 'blue',
            bg: 'bg-blue-500/20',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            shadow: 'shadow-blue-500/20'
        },
        {
            icon: <Cpu className="w-6 h-6" />,
            title: lang === 'vi' ? 'Xử lý AI' : 'AI Augmentation',
            desc: lang === 'vi' ? 'Gemini 3.1 phân tích ngữ cảnh và tối ưu hóa câu lệnh SQL.' : 'Gemini 3.1 analyzes context and optimizes your SQL constructs.',
            color: 'purple',
            bg: 'bg-purple-500/20',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            shadow: 'shadow-purple-500/20'
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: lang === 'vi' ? 'Thực thi' : 'Instant Execution',
            desc: lang === 'vi' ? 'Phản hồi trong tích tắc với kết quả được trực quan hóa.' : 'Real-time execution with beautifully visualized results.',
            color: 'emerald',
            bg: 'bg-emerald-500/20',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            shadow: 'shadow-emerald-500/20'
        },
        {
            icon: <Database className="w-6 h-6" />,
            title: lang === 'vi' ? 'Lưu trữ & Đồng bộ' : 'Sync & Save',
            desc: lang === 'vi' ? 'Mã hóa AES-256 và đồng bộ hóa an toàn trên các thiết bị.' : 'AES-256 encrypted storage and secure multi-device sync.',
            color: 'amber',
            bg: 'bg-amber-500/20',
            border: 'border-amber-500/30',
            text: 'text-amber-400',
            shadow: 'shadow-amber-500/20'
        }
    ];

    return (
        <section className="py-20 md:py-32 relative overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 uppercase">
                        {lang === 'vi' ? 'Quy trình Thông minh' : 'Intelligent Workflow'}
                    </h2>
                    <p className="text-muted-foreground font-medium max-w-2xl mx-auto">
                        {lang === 'vi' 
                            ? 'Sự kết hợp hoàn hảo giữa con người và trí tuệ nhân tạo.' 
                            : 'The perfect synergy between human intuition and artificial intelligence.'}
                    </p>
                </div>

                <div className="relative">
                    {/* Connection Line */}
                    <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
                        {steps.map((step, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                                className="flex flex-col items-center text-center"
                            >
                                <motion.div 
                                    whileHover={{ scale: 1.1, rotate: 360 }}
                                    transition={{ duration: 0.5 }}
                                    className={`w-16 h-16 rounded-3xl ${step.bg} border ${step.border} flex items-center justify-center mb-6 shadow-2xl ${step.shadow}`}
                                >
                                    <div className={`${step.text}`}>
                                        {step.icon}
                                    </div>
                                </motion.div>
                                <h3 className="text-lg font-black mb-3 uppercase tracking-tight">{step.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed px-4">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
