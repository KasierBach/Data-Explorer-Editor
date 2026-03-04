import React from 'react';

interface StepBlockProps {
    step: number;
    title: string;
    children: React.ReactNode;
}

export function StepBlock({ step, title, children }: StepBlockProps) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                    {step}
                </div>
                <h2 className="text-2xl font-bold">{title}</h2>
            </div>
            {children}
        </section>
    );
}
