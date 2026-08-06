import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ checked, onCheckedChange, className, disabled, label, ...props }, ref) => {
        return (
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                ref={ref}
                onClick={(e) => {
                    e.stopPropagation();
                    onCheckedChange(!checked);
                }}
                className={cn(
                    'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                    checked ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                    className,
                )}
                {...props}
            >
                <span
                    className={cn(
                        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-md ring-0 transition-transform',
                        checked ? 'translate-x-4' : 'translate-x-0',
                    )}
                />
            </button>
        );
    },
);

Switch.displayName = 'Switch';
