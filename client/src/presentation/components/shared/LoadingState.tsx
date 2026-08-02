import { cn } from '@/lib/utils';

type LoadingStateVariant = 'route' | 'workspace' | 'dashboard' | 'table';

interface LoadingStateProps {
    label: string;
    variant?: LoadingStateVariant;
    className?: string;
}

const pulse = 'animate-pulse motion-reduce:animate-none rounded-md bg-muted/70';

function DashboardSkeleton() {
    return (
        <div aria-hidden="true" className="w-full max-w-7xl space-y-5">
            <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className={cn(pulse, 'h-5 w-40')} />
                    <div className={cn(pulse, 'h-3 w-56 max-w-[65vw]')} />
                </div>
                <div className={cn(pulse, 'h-9 w-24 shrink-0')} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-4">
                        <div className={cn(pulse, 'h-3 w-24')} />
                        <div className={cn(pulse, 'h-7 w-20')} />
                    </div>
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-56 rounded-xl border border-border/60 bg-card/40 p-4 lg:col-span-2">
                    <div className={cn(pulse, 'h-full w-full')} />
                </div>
                <div className="h-56 rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className={cn(pulse, 'h-full w-full')} />
                </div>
            </div>
        </div>
    );
}

function TableSkeleton() {
    return (
        <div aria-hidden="true" className="w-full space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className={cn(pulse, 'h-9 w-64 max-w-[65vw]')} />
                <div className={cn(pulse, 'h-9 w-28')} />
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30">
                <div className="grid grid-cols-4 gap-4 border-b border-border/60 p-4">
                    {[0, 1, 2, 3].map((item) => <div key={item} className={cn(pulse, 'h-3')} />)}
                </div>
                {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="grid grid-cols-4 gap-4 border-b border-border/40 p-4 last:border-0">
                        {[0, 1, 2, 3].map((cell) => <div key={cell} className={cn(pulse, 'h-3')} />)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function WorkspaceSkeleton() {
    return (
        <div aria-hidden="true" className="grid h-full min-h-64 w-full overflow-hidden rounded-xl border border-border/60 bg-card/30 md:grid-cols-[minmax(10rem,0.28fr)_1fr]">
            <div className="hidden space-y-3 border-r border-border/60 p-4 md:block">
                <div className={cn(pulse, 'h-8 w-full')} />
                {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className={cn(pulse, 'h-3', item % 2 ? 'w-3/4' : 'w-full')} />)}
            </div>
            <div className="flex min-w-0 flex-col">
                <div className="flex gap-2 border-b border-border/60 p-3">
                    <div className={cn(pulse, 'h-7 w-28')} />
                    <div className={cn(pulse, 'h-7 w-20')} />
                </div>
                <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2">
                    <div className={cn(pulse, 'min-h-40')} />
                    <div className={cn(pulse, 'min-h-40')} />
                </div>
            </div>
        </div>
    );
}

export function LoadingState({ label, variant = 'dashboard', className }: LoadingStateProps) {
    const content = variant === 'table'
        ? <TableSkeleton />
        : variant === 'workspace'
            ? <WorkspaceSkeleton />
            : <DashboardSkeleton />;

    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className={cn(
                'flex w-full flex-col items-center justify-center gap-5 bg-background p-4 text-muted-foreground sm:p-6',
                variant === 'route' ? 'min-h-dvh' : 'h-full min-h-56',
                className,
            )}
        >
            {content}
            <div className="flex items-center gap-2 text-xs font-medium">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
                <span>{label}</span>
            </div>
        </div>
    );
}
