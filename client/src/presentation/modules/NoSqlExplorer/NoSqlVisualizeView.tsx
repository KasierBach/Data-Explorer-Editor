import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, Legend
} from 'recharts';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";

interface NoSqlVisualizeViewProps {
    data: any[];
}

export const NoSqlVisualizeView: React.FC<NoSqlVisualizeViewProps> = ({ data }) => {
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxis, setYAxis] = useState<string>('');

    // Detect fields and their types
    const { categoricalFields, numericalFields } = useMemo(() => {
        if (!data || data.length === 0) return { categoricalFields: [], numericalFields: [] };
        
        const cat: string[] = [];
        const num: string[] = [];
        
        // Sample first 5 docs to detect types
        const sampleDocs = data.slice(0, 5);
        const keys = Object.keys(data[0]);
        
        keys.forEach(key => {
            if (key === '_id') return;
            const values = sampleDocs.map(d => d[key]);
            const isNumerical = values.every(v => typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v)));
            
            if (isNumerical) {
                num.push(key);
            } else {
                cat.push(key);
            }
        });
        
        return { categoricalFields: cat, numericalFields: num };
    }, [data]);

    // Initial axis selection
    React.useEffect(() => {
        if (categoricalFields.length > 0 && !xAxis) setXAxis(categoricalFields[0]);
        if (numericalFields.length > 0 && !yAxis) setYAxis(numericalFields[0]);
    }, [categoricalFields, numericalFields, xAxis, yAxis]);

    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

    const renderChart = () => {
        if (!data || data.length === 0 || !xAxis || !yAxis) return null;

        const chartData = data.slice(0, 50).map(d => ({
            ...d,
            [yAxis]: typeof d[yAxis] === 'number' ? d[yAxis] : parseFloat(d[yAxis]) || 0
        }));

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey={xAxis} fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Legend />
                            <Bar dataKey={yAxis} fill={palette[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey={xAxis} fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey={yAxis} stroke={palette[1]} strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={chartData.slice(0, 10)} 
                                dataKey={yAxis} 
                                nameKey={xAxis} 
                                cx="50%" cy="50%" 
                                outerRadius={80}
                                label={{ fontSize: 10 }}
                            >
                                {chartData.slice(0, 10).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '12px' }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-muted/20 p-2 border rounded-lg gap-4">
                <div className="flex items-center gap-1 bg-background border p-1 rounded-md">
                    <Button 
                        variant={chartType === 'bar' ? 'secondary' : 'ghost'} 
                        size="icon" className="h-8 w-8" 
                        onClick={() => setChartType('bar')}
                    >
                        <BarChart3 className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant={chartType === 'line' ? 'secondary' : 'ghost'} 
                        size="icon" className="h-8 w-8"
                        onClick={() => setChartType('line')}
                    >
                        <LineIcon className="w-4 h-4" />
                    </Button>
                    <Button 
                        variant={chartType === 'pie' ? 'secondary' : 'ghost'} 
                        size="icon" className="h-8 w-8"
                        onClick={() => setChartType('pie')}
                    >
                        <PieIcon className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-3 flex-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">X Axis</span>
                        <Select value={xAxis} onValueChange={setXAxis}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select field" />
                            </SelectTrigger>
                            <SelectContent>
                                {categoricalFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                {numericalFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">Y Axis</span>
                        <Select value={yAxis} onValueChange={setYAxis}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select metric" />
                            </SelectTrigger>
                            <SelectContent>
                                {numericalFields.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-orange-500 bg-orange-500/5 px-2 py-1 rounded border border-orange-500/20">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">AI Insights</span>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-card/50 border rounded-xl p-4 shadow-inner relative overflow-hidden">
                {(!data || data.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                         <BarChart3 className="w-12 h-12" />
                         <p className="text-sm font-medium">No documents to visualize.</p>
                    </div>
                ) : (xAxis && yAxis) ? (
                    renderChart()
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Settings2 className="w-10 h-10 opacity-20" />
                        <p className="text-xs">Chưa chọn trường dữ liệu để vẽ biểu đồ.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
