import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import { Label } from "@/presentation/components/ui/label";
import { Card } from "@/presentation/components/ui/card";
import { BarChart3, LineChart as LineIcon, AreaChart as AreaIcon } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';

interface ResultVisualizerProps {
    data: any[];
}

export const ResultVisualizer: React.FC<ResultVisualizerProps> = ({ data }) => {
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]);
    }, [data]);

    const numericColumns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return columns.filter(col => {
            const val = data[0][col];
            return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '');
        });
    }, [data, columns]);

    const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
    const [xAxis, setXAxis] = useState<string>(columns[0] || '');
    const [yAxis, setYAxis] = useState<string>(numericColumns[0] || '');

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available to visualize
            </div>
        );
    }

    const chartData = data.map(row => ({
        ...row,
        [yAxis]: Number(row[yAxis])
    }));

    const renderChart = () => {
        const commonProps = {
            data: chartData,
            margin: { top: 20, right: 30, left: 20, bottom: 20 }
        };

        const colors = {
            bar: "#3b82f6",
            line: "#8b5cf6",
            area: "#10b981",
            stroke: "hsl(var(--muted-foreground))",
            grid: "hsl(var(--border))"
        };

        if (chartType === 'line') {
            return (
                <LineChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey={xAxis} stroke={colors.stroke} fontSize={12} />
                    <YAxis stroke={colors.stroke} fontSize={12} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                        itemStyle={{ color: colors.line }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey={yAxis} stroke={colors.line} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
            );
        }

        if (chartType === 'area') {
            return (
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colors.area} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={colors.area} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey={xAxis} stroke={colors.stroke} fontSize={12} />
                    <YAxis stroke={colors.stroke} fontSize={12} />
                    <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                        itemStyle={{ color: colors.area }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey={yAxis} stroke={colors.area} fillOpacity={1} fill="url(#colorArea)" />
                </AreaChart>
            );
        }

        return (
            <BarChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey={xAxis} stroke={colors.stroke} fontSize={12} />
                <YAxis stroke={colors.stroke} fontSize={12} />
                <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: colors.bar }}
                />
                <Legend />
                <Bar dataKey={yAxis} fill={colors.bar} radius={[4, 4, 0, 0]} />
            </BarChart>
        );
    };

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent overflow-hidden">
            <div className="flex flex-wrap items-end gap-6 p-4 border-b bg-muted/20">
                <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Chart Type</Label>
                    <div className="flex bg-background border rounded-md p-1">
                        <Button
                            variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setChartType('bar')}
                            title="Bar Chart"
                        >
                            <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === 'line' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setChartType('line')}
                            title="Line Chart"
                        >
                            <LineIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={chartType === 'area' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setChartType('area')}
                            title="Area Chart"
                        >
                            <AreaIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-1.5 w-40">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">X Axis (Categories)</Label>
                    <Select value={xAxis} onValueChange={setXAxis}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                            {columns.map(col => (
                                <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5 w-40">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">Y Axis (Values)</Label>
                    <Select value={yAxis} onValueChange={setYAxis}>
                        <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                            {numericColumns.map(col => (
                                <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-4">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </Card>
    );
};
