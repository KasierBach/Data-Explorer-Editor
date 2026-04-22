import React from 'react';
import { cn } from '@/lib/utils';

interface DocPageLayoutProps {
    title: string;
    subtitle: string;
    gradient?: boolean;
    children: React.ReactNode;
}

export function DocPageLayout({ title, subtitle, gradient = false, children }: DocPageLayoutProps) {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
                <h1 className={cn(
                    "text-4xl font-extrabold tracking-tight lg:text-5xl",
                    gradient ? "bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent" : "text-white"
                )}>
                    {title}
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                    {subtitle}
                </p>
            </div>
            {children}
        </div>
    );
}

export function DocSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-6 pt-10 border-t border-border/50">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
                {icon} {title}
            </h2>
            {children}
        </section>
    );
}

export function DocSubSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4 pt-6">
            <h3 className="text-xl font-bold text-white/90">{title}</h3>
            {children}
        </div>
    );
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("text-muted-foreground leading-relaxed text-base text-justify", className)}>{children}</div>;
}
