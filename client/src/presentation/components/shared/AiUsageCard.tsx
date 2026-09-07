import { useQuery } from '@tanstack/react-query';
import { Activity, Coins, Loader2, TrendingUp } from 'lucide-react';
import { adminService, type AiTokenUsage } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';

interface AiUsageCardProps {
    /** 'me' shows the current user's usage; 'admin' shows platform-wide totals. */
    scope: 'me' | 'admin';
}

function formatTokens(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
}

export function AiUsageCard({ scope }: AiUsageCardProps) {
    const lang = useAppStore((state) => state.lang);
    const isVi = lang === 'vi';

    const { data, isLoading } = useQuery({
        queryKey: ['ai-usage', scope],
        queryFn: () =>
            scope === 'me'
                ? adminService.getMyAiUsage(30)
                : adminService.getAiQualityMetrics(30),
        staleTime: 5 * 60 * 1000,
    });

    const tokens: AiTokenUsage | undefined = data?.tokens;
    const title = isVi ? 'Token usage (30 ngày)' : 'Token usage (30 days)';
    const subtitle = isVi
        ? 'Tổng token các yêu cầu AI của bạn đã tiêu thụ.'
        : 'Total tokens consumed by your AI requests.';

    return (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" />
                <h4 className="font-semibold text-sm">{title}</h4>
                {isLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
            </div>
            <p className="text-xs text-muted-foreground -mt-2">{subtitle}</p>

            {tokens ? (
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border/50 bg-background/60 p-3 space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {isVi ? 'Prompt' : 'Prompt'}
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                            {formatTokens(tokens.promptTokens)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-background/60 p-3 space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {isVi ? 'Output' : 'Output'}
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                            {formatTokens(tokens.completionTokens)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                        <div className="text-[10px] uppercase tracking-wide text-amber-500/80">
                            {isVi ? 'Tổng' : 'Total'}
                        </div>
                        <div className="text-lg font-bold tabular-nums text-amber-500">
                            {formatTokens(tokens.totalTokens)}
                        </div>
                    </div>
                </div>
            ) : !isLoading ? (
                <p className="text-xs text-muted-foreground">
                    {isVi
                        ? 'Chưa có dữ liệu usage trong 30 ngày qua.'
                        : 'No usage data in the last 30 days.'}
                </p>
            ) : null}

            {tokens && tokens.trackedRequests > 0 && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {tokens.trackedRequests}{' '}
                        {isVi ? 'yêu cầu được theo dõi' : 'tracked requests'}
                    </span>
                    {data && 'generations' in data && (
                        <span className="inline-flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {data.generations}{' '}
                            {isVi ? 'lần sinh SQL' : 'generations'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
