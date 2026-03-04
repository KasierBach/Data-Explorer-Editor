import React from 'react';

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
                <h1 className={`text-4xl font-extrabold tracking-tight lg:text-5xl ${gradient ? 'bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent' : ''}`}>
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
        <section className="space-y-6 pt-10 border-t">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                {icon} {title}
            </h2>
            {children}
        </section>
    );
}

export function DocSubSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4 pt-6">
            <h3 className="text-xl font-bold">{title}</h3>
            {children}
        </div>
    );
}

export function Prose({ children }: { children: React.ReactNode }) {
    return <p className="text-muted-foreground leading-relaxed text-base text-justify">{children}</p>;
}
