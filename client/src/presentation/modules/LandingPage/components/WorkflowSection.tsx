import React from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, Cpu, Search } from 'lucide-react';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface WorkflowSectionProps {
    lang: string;
}

export const WorkflowSection: React.FC<WorkflowSectionProps> = ({ lang }) => {
    const text = getWorkspaceText(lang).workflowSection;
    const steps = [
        {
            icon: <Search className="w-6 h-6" />,
            ...text.steps[0],
            color: 'blue',
            bg: 'bg-blue-500/20',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            shadow: 'shadow-blue-500/20'
        },
        {
            icon: <Cpu className="w-6 h-6" />,
            ...text.steps[1],
            color: 'purple',
            bg: 'bg-purple-500/20',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            shadow: 'shadow-purple-500/20'
        },
        {
            icon: <Zap className="w-6 h-6" />,
            ...text.steps[2],
            color: 'emerald',
            bg: 'bg-emerald-500/20',
            border: 'border-emerald-500/30',
            text: 'text-emerald-400',
            shadow: 'shadow-emerald-500/20'
        },
        {
            icon: <Database className="w-6 h-6" />,
            ...text.steps[3],
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
                        {text.title}
                    </h2>
                    <p className="text-muted-foreground font-medium max-w-2xl mx-auto">
                        {text.description}
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
                                <p className="text-sm text-muted-foreground leading-relaxed px-4">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
