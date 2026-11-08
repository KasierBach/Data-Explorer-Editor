import React from 'react';
import { cn } from '@/lib/utils';

interface DocPageLayoutProps {
    title: string;
    subtitle: string;
    gradient?: boolean;
    visual?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export function DocPageLayout({ title, subtitle, gradient = false, visual, actions, children }: DocPageLayoutProps) {
    return (
        <div className="doc-page-layout space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={cn('doc-page-heading space-y-6', visual && 'pe-doc-hero')}>
                <div className="doc-heading-copy">
                {visual && <span className="pe-eyebrow"><span className="pe-nav-dot" aria-hidden="true" />Data Explorer / Knowledge Hub</span>}
                <h1
                    className={cn(
                        'text-4xl font-extrabold tracking-tight lg:text-5xl',
                        !gradient && 'text-foreground'
                    )}
                    style={gradient ? {
                        background: 'linear-gradient(to right, hsl(var(--primary)), #2563eb)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    } : undefined}
                >
                    {title}
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                    {subtitle}
                </p>
                {actions}
                </div>
                {visual}
            </div>
            {children}
        </div>
    );
}

export function DocSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="doc-section space-y-6 pt-10 border-t border-border/50" data-doc-reveal>
            <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground">
                {icon} {title}
            </h2>
            {children}
        </section>
    );
}

export function DocSubSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="doc-subsection space-y-4 pt-6">
            <h3 className="text-xl font-bold text-foreground/90">{title}</h3>
            {children}
        </div>
    );
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("doc-prose text-muted-foreground leading-relaxed text-base text-justify", className)}>{children}</div>;
}
