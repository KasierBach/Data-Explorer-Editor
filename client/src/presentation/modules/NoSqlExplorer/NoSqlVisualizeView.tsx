import React, { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    BarChart3,
    Database,
    Filter,
    LineChart as LineIcon,
    PieChart as PieIcon,
    Settings2,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/presentation/components/ui/select';
import { useAppStore } from '@/core/services/store';
import type { RowData } from '@/core/domain/entities';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface NoSqlVisualizeViewProps {
    data: RowData[];
}

type ChartType = 'bar' | 'pie' | 'line';
type MetricMode = 'count' | 'sum' | 'avg' | 'min' | 'max';
type FieldKind = 'categorical' | 'numeric' | 'date' | 'boolean' | 'unsupported';

interface FieldProfile {
    name: string;
    kind: FieldKind;
    distinctCount: number;
    nonEmptyCount: number;
}

interface ChartBucket {
    label: string;
    value: number;
    count: number;
    numericCount: number;
    total: number;
    min: number;
    max: number;
    sortValue: number;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];
const MAX_BAR_BUCKETS = 8;
const MAX_PIE_BUCKETS = 6;

const toFiniteNumber = (value: unknown) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const toDateTimestamp = (value: unknown) => {
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.getTime() : null;
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const normalizeLabel = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value.length > 28 ? `${value.slice(0, 25)}...` : value;
    return '[complex]';
};

const truncateTick = (label: string) => (
    label.length > 18 ? `${label.slice(0, 15)}...` : label
);

const metricLabel = (
    metricMode: MetricMode,
    metricField: string,
    text: ReturnType<typeof getWorkspaceText>['noSqlVisualize'],
) => {
    if (metricMode === 'count') {
        return text.documentCount;
    }

    const prefixMap: Record<Exclude<MetricMode, 'count'>, string> = {
        sum: text.sum,
        avg: text.average,
        min: text.minimum,
        max: text.maximum,
    };

    return `${prefixMap[metricMode]} ${metricField}`;
};

const formatMetricValue = (value: unknown, lang: 'vi' | 'en') => {
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    const numericValue =
        typeof normalizedValue === 'number'
            ? normalizedValue
            : Number.parseFloat(String(normalizedValue ?? 0));
    const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
    return safeValue.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
};

const bucketValue = (bucket: ChartBucket, metricMode: MetricMode) => {
    if (metricMode === 'count') return bucket.count;
    if (metricMode === 'sum') return bucket.total;
    if (metricMode === 'avg') return bucket.numericCount > 0 ? bucket.total / bucket.numericCount : 0;
    if (metricMode === 'min') return bucket.numericCount > 0 ? bucket.min : 0;
    return bucket.numericCount > 0 ? bucket.max : 0;
};

const buildFieldProfiles = (data: RowData[]) => {
    if (!data.length) return [];

    const keys = Array.from(
        new Set(
            data.flatMap((row) => Object.keys(row)),
        ),
    );

    return keys
        .filter((key) => key !== '_id')
        .map((key): FieldProfile => {
            const values = data.map((row) => row[key]).filter((value) => value !== undefined && value !== null && value !== '');
            const distinctCount = new Set(values.map((value) => String(value))).size;

            if (!values.length) {
                return {
                    name: key,
                    kind: 'unsupported',
                    distinctCount: 0,
                    nonEmptyCount: 0,
                };
            }

            const numericValues = values.map(toFiniteNumber);
            const numericCoverage = numericValues.filter((value) => value !== null).length / values.length;
            const dateCoverage = values.map(toDateTimestamp).filter((value) => value !== null).length / values.length;
            const booleanCoverage = values.filter((value) => typeof value === 'boolean').length / values.length;
            const complexCoverage = values.filter((value) => Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))).length / values.length;

            let kind: FieldKind = 'categorical';

            if (complexCoverage > 0.35) {
                kind = 'unsupported';
            } else if (booleanCoverage === 1) {
                kind = 'boolean';
            } else if (numericCoverage >= 0.8) {
                kind = 'numeric';
            } else if (dateCoverage >= 0.8) {
                kind = 'date';
            }

            return {
                name: key,
                kind,
                distinctCount,
                nonEmptyCount: values.length,
            };
        });
};

export const NoSqlVisualizeView: React.FC<NoSqlVisualizeViewProps> = ({ data }) => {
    const { lang, nosqlActiveCollection } = useAppStore();
    const text = getWorkspaceText(lang).noSqlVisualize;
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [groupField, setGroupField] = useState('');
    const [metricField, setMetricField] = useState('');
    const [metricMode, setMetricMode] = useState<MetricMode>('count');

    const fieldProfiles = useMemo(() => buildFieldProfiles(data), [data]);
    const numericFields = useMemo(
        () => fieldProfiles.filter((field) => field.kind === 'numeric').map((field) => field.name),
        [fieldProfiles],
    );
    const groupableFields = useMemo(
        () => fieldProfiles
            .filter((field) => field.kind !== 'unsupported')
            .filter((field) => field.kind !== 'numeric' || field.distinctCount <= 12)
            .map((field) => field.name),
        [fieldProfiles],
    );
    const bestGroupingField = groupableFields[0] || '';

    const resolvedGroupField =
        groupField && groupableFields.includes(groupField)
            ? groupField
            : groupableFields[0] || '';
    const resolvedMetricField =
        metricField && numericFields.includes(metricField)
            ? metricField
            : numericFields[0] || '';
    const resolvedMetricMode = !numericFields.length ? 'count' : metricMode;

    const chartData = useMemo(() => {
        if (!data.length || !resolvedGroupField) return [];

        const buckets = new Map<string, ChartBucket>();
        const groupProfile = fieldProfiles.find((field) => field.name === resolvedGroupField);

        data.forEach((row) => {
            const rawGroupValue = row[resolvedGroupField];
            const label = normalizeLabel(rawGroupValue);
            const existing = buckets.get(label) || {
                label,
                value: 0,
                count: 0,
                numericCount: 0,
                total: 0,
                min: Number.POSITIVE_INFINITY,
                max: Number.NEGATIVE_INFINITY,
                sortValue: toDateTimestamp(rawGroupValue) ?? 0,
            };

            existing.count += 1;

            if (resolvedMetricField) {
                const numericValue = toFiniteNumber(row[resolvedMetricField]);
                if (numericValue !== null) {
                    existing.numericCount += 1;
                    existing.total += numericValue;
                    existing.min = Math.min(existing.min, numericValue);
                    existing.max = Math.max(existing.max, numericValue);
                }
            }

            buckets.set(label, existing);
        });

        const limit = chartType === 'pie' ? MAX_PIE_BUCKETS : MAX_BAR_BUCKETS;

        return Array.from(buckets.values())
            .map((bucket) => ({
                ...bucket,
                value: bucketValue(bucket, resolvedMetricMode),
            }))
            .filter((bucket) => Number.isFinite(bucket.value))
            .sort((left, right) => {
                if (groupProfile?.kind === 'date') {
                    return left.sortValue - right.sortValue;
                }

                return right.value - left.value;
            })
            .slice(0, limit);
    }, [chartType, data, fieldProfiles, resolvedGroupField, resolvedMetricField, resolvedMetricMode]);

    const topBucket = chartData[0];
    const metricTitle = metricLabel(
        resolvedMetricMode,
        resolvedMetricField || text.numericFieldFallback,
        text,
    );
    const chartLegendLabel = resolvedMetricMode === 'count'
        ? text.countShort
        : resolvedMetricField;

    const renderChart = () => {
        if (!chartData.length) return null;

        if (chartType === 'line') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                        <XAxis
                            dataKey="label"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={truncateTick}
                        />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(value) => [formatMetricValue(value, lang), metricTitle]}
                            labelFormatter={(label) => `${text.bucket}: ${label}`}
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '12px',
                            }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="value"
                            name={chartLegendLabel}
                            stroke={CHART_COLORS[1]}
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === 'pie') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            outerRadius={88}
                            label={({ name, percent }) => `${truncateTick(String(name))} ${(((percent ?? 0) * 100)).toFixed(0)}%`}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => [formatMetricValue(value, lang), metricTitle]}
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '12px',
                            }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis
                        dataKey="label"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={truncateTick}
                    />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip
                        formatter={(value) => [formatMetricValue(value, lang), metricTitle]}
                        labelFormatter={(label) => `${text.bucket}: ${label}`}
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                        }}
                    />
                    <Legend />
                    <Bar dataKey="value" name={chartLegendLabel} radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    if (!data.length) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground opacity-50">
                <BarChart3 className="h-12 w-12" />
                <p className="text-sm font-medium">
                    {text.empty}
                </p>
            </div>
        );
    }

    if (!groupableFields.length) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted-foreground">
                <Settings2 className="h-12 w-12 opacity-30" />
                <div>
                    <p className="text-base font-semibold">
                        {text.notChartReadyTitle}
                    </p>
                    <p className="mt-2 max-w-lg text-sm text-muted-foreground/80">
                        {text.notChartReadyDescription}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4 animate-in fade-in duration-500">
            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border bg-card/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <Database className="h-3.5 w-3.5 text-emerald-500" />
                        {text.currentSample}
                    </div>
                    <div className="mt-3 text-2xl font-bold">{data.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {text.documentsFrom(nosqlActiveCollection || text.currentCollectionFallback)}
                    </p>
                </div>

                <div className="rounded-xl border bg-card/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <Filter className="h-3.5 w-3.5 text-blue-500" />
                        {text.groupingFields}
                    </div>
                    <div className="mt-3 text-2xl font-bold">{groupableFields.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {bestGroupingField
                            ? text.bestDefault(bestGroupingField)
                            : text.noStrongGrouping}
                    </p>
                </div>

                <div className="rounded-xl border bg-card/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <BarChart3 className="h-3.5 w-3.5 text-orange-500" />
                        {text.numericMetrics}
                    </div>
                    <div className="mt-3 text-2xl font-bold">{numericFields.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {metricMode === 'count'
                            ? text.usingDocumentCount
                            : metricTitle}
                    </p>
                </div>

                <div className="rounded-xl border bg-card/50 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <PieIcon className="h-3.5 w-3.5 text-pink-500" />
                        {text.topBucket}
                    </div>
                    <div className="mt-3 text-lg font-bold">{topBucket?.label || '-'}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {topBucket
                            ? `${topBucket.value.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')} ${chartLegendLabel}`
                            : text.noTopBucket}
                    </p>
                </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                        <Button
                            variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('bar')}
                        >
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === 'line' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('line')}
                        >
                            <LineIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === 'pie' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType('pie')}
                        >
                            <PieIcon className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="grid flex-1 gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                {text.groupBy}
                            </span>
                            <Select value={resolvedGroupField} onValueChange={setGroupField}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder={text.groupFieldPlaceholder} />
                                </SelectTrigger>
                                <SelectContent>
                                    {groupableFields.map((field) => (
                                        <SelectItem key={field} value={field}>
                                            {field}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                {text.metric}
                            </span>
                            <Select
                                value={resolvedMetricMode}
                                onValueChange={(value) => setMetricMode(value as MetricMode)}
                            >
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder={text.metricPlaceholder} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="count">{text.countMetric}</SelectItem>
                                    <SelectItem value="sum">{text.sum}</SelectItem>
                                    <SelectItem value="avg">{text.average}</SelectItem>
                                    <SelectItem value="min">{text.minimum}</SelectItem>
                                    <SelectItem value="max">{text.maximum}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                {text.numericField}
                            </span>
                            <Select
                                value={resolvedMetricField}
                                onValueChange={setMetricField}
                                disabled={resolvedMetricMode === 'count' || !numericFields.length}
                            >
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue
                                        placeholder={
                                            resolvedMetricMode === 'count'
                                                ? text.notNeededForCount
                                                : text.numericFieldPlaceholder
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {numericFields.map((field) => (
                                        <SelectItem key={field} value={field}>
                                            {field}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="mt-3 rounded-lg border border-dashed border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs text-orange-100/80">
                    {text.insightHint}
                </div>
            </div>

            <div className="relative min-h-[460px] overflow-hidden rounded-2xl border bg-card/50 p-4 shadow-inner">
                {chartData.length > 0 ? (
                    <>
                        <div className="mb-3">
                            <h3 className="text-sm font-semibold">
                                {text.compareBy(resolvedGroupField)}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {metricTitle}
                            </p>
                        </div>
                        <div className="h-[360px] md:h-[420px]">
                            {renderChart()}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                        <Settings2 className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">
                            {text.insufficientNumericData}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
