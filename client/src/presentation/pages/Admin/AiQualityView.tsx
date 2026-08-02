import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock3, MessageSquareText, Sparkles } from 'lucide-react';
import { adminService } from '@/core/services/AdminService';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import { LoadingState } from '@/presentation/components/shared/LoadingState';

export function AiQualityView() {
    const lang = useAppStore((state) => state.lang);
    const vi = lang === 'vi';
    const [days, setDays] = useState(30);
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-ai-quality', days],
        queryFn: () => adminService.getAiQualityMetrics(days),
    });

    if (isLoading) return <LoadingState className="min-h-[24rem]" label={vi ? 'Đang tổng hợp chất lượng AI...' : 'Loading AI quality...'} variant="dashboard" />;
    if (error || !data) return <div className="py-16 text-center text-sm text-red-500">{vi ? 'Không thể tải số liệu AI.' : 'Unable to load AI metrics.'}</div>;

    const cards = [
        { label: vi ? 'Lượt tạo SQL' : 'SQL generations', value: data.generations, icon: Sparkles },
        { label: vi ? 'Tỉ lệ thành công' : 'Success rate', value: `${data.successRate}%`, icon: Activity },
        { label: vi ? 'Độ trễ trung bình' : 'Average latency', value: `${data.averageLatencyMs} ms`, icon: Clock3 },
        { label: vi ? 'Feedback tích cực' : 'Positive feedback', value: `${data.feedback.up}/${data.feedback.total}`, icon: MessageSquareText },
    ];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold">{vi ? 'Chất lượng AI' : 'AI quality'}</h2>
                    <p className="text-xs text-muted-foreground">{vi ? 'Chỉ tổng hợp metadata vận hành; không đọc prompt hoặc SQL.' : 'Operational metadata only; prompts and SQL are not read.'}</p>
                </div>
                <div className="flex gap-1 rounded-lg border p-1">
                    {[7, 30, 90].map((value) => (
                        <Button key={value} variant={days === value ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setDays(value)}>
                            {value}d
                        </Button>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                <CardHeader><CardTitle className="text-sm">{vi ? 'Theo model' : 'By model'} · p95 {data.p95LatencyMs} ms</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Model</th><th>{vi ? 'Thành công' : 'Success'}</th><th>{vi ? 'Lỗi' : 'Failed'}</th><th>Total</th></tr></thead>
                        <tbody>{data.models.map((model) => <tr key={model.model} className="border-b last:border-0"><td className="py-3 font-medium">{model.model}</td><td>{model.success}</td><td>{model.failed}</td><td>{model.total}</td></tr>)}</tbody>
                    </table>
                    {data.models.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">{vi ? 'Chưa có lượt tạo SQL trong kỳ.' : 'No SQL generations in this period.'}</div>}
                </CardContent>
            </Card>
        </div>
    );
}
