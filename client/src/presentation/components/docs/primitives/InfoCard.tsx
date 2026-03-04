import React from 'react';

interface InfoCardProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    color?: 'blue' | 'purple' | 'emerald' | 'orange' | 'amber' | 'cyan' | 'red';
}

const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/10',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/10',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/10',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/10',
    cyan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/10',
    red: 'bg-red-500/10 text-red-500 border-red-500/10',
};

const iconColorMap = {
    blue: 'bg-blue-500/10',
    purple: 'bg-purple-500/10',
    emerald: 'bg-emerald-500/10',
    orange: 'bg-orange-500/10',
    amber: 'bg-amber-500/10',
    cyan: 'bg-cyan-500/10',
    red: 'bg-red-500/10',
};

export function InfoCard({ icon, title, children, color = 'blue' }: InfoCardProps) {
    return (
        <div className={`p-8 rounded-3xl border bg-card/50 space-y-4 shadow-sm hover:shadow-xl transition-all ${colorMap[color]} group`}>
            <div className={`${iconColorMap[color]} w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <h3 className="font-bold text-xl">{title}</h3>
            <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
        </div>
    );
}

interface CalloutProps {
    type?: 'info' | 'warning' | 'tip';
    children: React.ReactNode;
}

export function Callout({ type = 'info', children }: CalloutProps) {
    const styles = {
        info: 'bg-primary/5 border-l-4 border-primary',
        warning: 'bg-amber-500/5 border-l-4 border-amber-500',
        tip: 'bg-emerald-500/5 border-l-4 border-emerald-500',
    };
    return (
        <div className={`${styles[type]} p-6 rounded-r-2xl shadow-inner`}>
            <div className="text-sm leading-relaxed">{children}</div>
        </div>
    );
}

interface FeatureGridProps {
    children: React.ReactNode;
    columns?: 2 | 3;
}

export function FeatureGrid({ children, columns = 2 }: FeatureGridProps) {
    const gridClass = columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
    return <div className={`grid ${gridClass} gap-6`}>{children}</div>;
}
