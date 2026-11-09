import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3, Coins, MessageSquareText, Sparkles } from 'lucide-react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { LoadingState } from '@/presentation/components/shared/LoadingState';

function formatTokens(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
}

export function AiQualityView() {
    const lang = useAppStore((state) => state.lang);
    const vi = lang === 'vi';
    const [days, setDays] = useState(30);
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-ai-quality', days],
        queryFn: () => adminService.getAiQualityMetrics(days),
    });

    if (isLoading) return <LoadingState className="min-h-[24rem]" label={vi ? 'Đang tải số liệu AI...' : 'Loading AI metrics...'} variant="dashboard" />;
    if (error || !data) return <div className="py-16 text-center text-sm text-red-500">{vi ? 'Không thể tải số liệu AI.' : 'Unable to load AI metrics.'}</div>;

    const tokens = data.tokens;
    const observed = tokens?.observedOnly === true &&
        (tokens.usageCoverage === 'complete' || tokens.usageCoverage === 'partial');
    const coverage = observed
        ? tokens.usageCoverage === 'complete' ? (vi ? 'đầy đủ' : 'complete') : (vi ? 'một phần' : 'partial')
        : (vi ? 'không khả dụng' : 'unavailable');
    const successRate = typeof data.generations === 'number' && data.generations > 0 &&
        typeof data.successRate === 'number' && Number.isFinite(data.successRate) && data.successRate >= 0 && data.successRate <= 100
        ? `${data.successRate}%` : '—';
    const averageLatency = typeof data.generations === 'number' && data.generations > 0 &&
        typeof data.averageLatencyMs === 'number' && Number.isFinite(data.averageLatencyMs) && data.averageLatencyMs >= 0
        ? `${data.averageLatencyMs} ms` : '—';
    const p95Latency = typeof data.generations === 'number' && data.generations > 0 &&
        typeof data.p95LatencyMs === 'number' && Number.isFinite(data.p95LatencyMs) && data.p95LatencyMs >= 0
        ? `${data.p95LatencyMs} ms` : '—';
    const cards = [
        { label: vi ? 'Lượt AI' : 'AI generations', value: formatTokens(data.generations), icon: Sparkles },
        { label: vi ? 'Thành công vận hành' : 'Operational success', value: successRate, icon: Activity },
        { label: vi ? 'Độ trễ trung bình' : 'Average latency', value: averageLatency, icon: Clock3 },
        { label: vi ? 'Feedback tích cực' : 'Positive feedback', value: `${formatTokens(data.feedback?.up)}/${formatTokens(data.feedback?.total)}`, icon: MessageSquareText },
        {
            label: vi ? 'Token quan sát' : 'Observed tokens',
            value: formatTokens(observed ? tokens.totalTokens : null),
            icon: Coins,
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">{vi ? 'Chất lượng AI' : 'AI quality'}</h2>
                    <p className="text-xs text-muted-foreground">{vi
                        ? `Chỉ metadata; không đọc prompt/SQL. Thành công = truyền tải/hợp đồng, không phải độ đúng ngữ nghĩa. Token chỉ là tổng quan sát; thiếu usage ≠ 0. Độ phủ: ${coverage}. Chi phí: không khả dụng.`
                        : `Metadata only; prompts/SQL are not read. Success = transport/contract, not semantic accuracy. Tokens are observed subtotals; missing usage ≠ 0. Coverage: ${coverage}. Cost: unavailable.`}</p>
                </div>
                <div className="flex gap-1 rounded-lg border p-1">
                    {[7, 30, 90].map((value) => (
                        <Button key={value} variant={days === value ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setDays(value)}>
                            {value}d
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {cards.map(({ label, value, icon: Icon }) => (
                    <Card key={label}>
                        <CardContent className="flex items-center justify-between p-4">
                            <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>
                            <Icon className="h-5 w-5 text-violet-500" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm">{vi ? 'Theo model' : 'By model'} · p95 {p95Latency}</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Model</th><th>{vi ? 'Thành công vận hành' : 'Operational success'}</th><th>{vi ? 'Chưa thành công' : 'Not succeeded'}</th><th>{vi ? 'Tổng' : 'Total'}</th></tr></thead>
                        <tbody>{data.models?.map((model) => <tr key={model.model} className="border-b last:border-0"><td className="py-3 font-medium">{model.model}</td><td>{formatTokens(model.success)}</td><td>{formatTokens(model.failed)}</td><td>{formatTokens(model.total)}</td></tr>)}</tbody>
                    </table>
                    {(!data.models || data.models.length === 0) && <div className="py-8 text-center text-sm text-muted-foreground">{!data.models ? (vi ? 'Số liệu model không khả dụng.' : 'Model metrics unavailable.') : (vi ? 'Chưa có lượt AI trong kỳ.' : 'No AI generations in this period.')}</div>}
                </CardContent>
            </Card>

            {tokens && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            {vi ? 'Token quan sát' : 'Observed tokens'} · {formatTokens(tokens.measuredAttempts)}/{formatTokens(tokens.attempts)}{' '}
                            {vi ? 'lượt thử đã đo' : 'measured attempts'} · {formatTokens(tokens.unmeasuredAttempts)}{' '}
                            {vi ? 'chưa đo' : 'unmeasured'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                            <div className="text-xs text-muted-foreground">{vi ? 'Prompt tokens' : 'Prompt tokens'}</div>
                            <div className="mt-1 text-2xl font-bold tabular-nums">{formatTokens(observed ? tokens.promptTokens : null)}</div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                            <div className="text-xs text-muted-foreground">{vi ? 'Output tokens' : 'Output tokens'}</div>
                            <div className="mt-1 text-2xl font-bold tabular-nums">{formatTokens(observed ? tokens.completionTokens : null)}</div>
                        </div>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                            <div className="text-xs text-amber-500/80">{vi ? 'Tổng quan sát' : 'Observed subtotal'}</div>
                            <div className="mt-1 text-2xl font-bold tabular-nums text-amber-500">{formatTokens(observed ? tokens.totalTokens : null)}</div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
