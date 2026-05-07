import React from 'react';
import { 
    Database, Table, Search, Code2, Play, BarChart3, PieChart as PieIcon, 
    Type, Palette, Settings2, PanelLeftClose, FileText, Maximize2 
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { cn } from '@/lib/utils';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import type { DataMode } from '../useVisualizeLogic';

interface VizSidebarProps {
    isCollapsed: boolean;
    setCollapsed: (v: boolean) => void;
    activeSection: string;
    setActiveSection: (v: string) => void;
    dataMode: DataMode;
    setDataMode: (v: DataMode) => void;
    currentDb: string;
    setCurrentDb: (v: string) => void;
    databases: any[];
    searchTable: string;
    setSearchTable: (v: string) => void;
    selectedTable: string;
    setSelectedTable: (v: string) => void;
    filteredTables: any[];
    isLoadingTables: boolean;
    dataLimit: number;
    setDataLimit: (v: number) => void;
    sortColumn: string;
    setSortColumn: (v: string) => void;
    sortDir: string;
    setSortDir: (v: 'ASC' | 'DESC') => void;
    customSql: string;
    setCustomSql: (v: string) => void;
    isLoading: boolean;
    refetch: () => void;
    chartType: string;
    setChartType: (v: string) => void;
    xAxis: string;
    setXAxis: (v: string) => void;
    yAxis: string[];
    setYAxis: (v: (prev: string[]) => string[]) => void;
    columns: string[];
    numericColumns: string[];
    title: string;
    setTitle: (v: string) => void;
    paletteIdx: number;
    setPaletteIdx: (v: number) => void;
    colorPalettes: any[];
    chartTypes: any[];
    curveType: string;
    setCurveType: (v: string) => void;
    curveTypes: readonly string[];
    options: any[];
    handleExportPNG: () => void;
    handleExportCSV: () => void;
    chartData?: any[];
}

export const VizSidebar: React.FC<VizSidebarProps> = ({
    isCollapsed, setCollapsed, activeSection, setActiveSection, dataMode, setDataMode, 
    currentDb, setCurrentDb, databases, searchTable, setSearchTable, selectedTable, 
    setSelectedTable, filteredTables, isLoadingTables, dataLimit, setDataLimit, 
    sortColumn, setSortColumn, sortDir, setSortDir, customSql, setCustomSql, 
    isLoading, refetch, chartType, setChartType, xAxis, setXAxis, yAxis, setYAxis, 
    columns, numericColumns, title, setTitle, paletteIdx, setPaletteIdx, colorPalettes, 
    chartTypes, curveType, setCurveType, curveTypes, options, handleExportPNG, 
    handleExportCSV, chartData
}) => {
    const { isActualMobile } = useResponsiveLayoutMode();
    const sidebarSections = [
        { id: 'source', label: 'Data Source', icon: Database },
        { id: 'chart', label: 'Chart Type', icon: BarChart3 },
        { id: 'axes', label: 'Axes & Fields', icon: Type },
        { id: 'style', label: 'Style', icon: Palette },
        { id: 'options', label: 'Options', icon: Settings2 },
    ];

    return (
        <div className={cn(
            "border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 transition-all duration-300",
            isCollapsed ? "w-0 overflow-hidden border-none" : (isActualMobile ? "w-full" : "w-80")
        )}>
            <div className={cn(
                "h-full flex flex-col",
                isActualMobile ? "w-full" : "w-80"
            )}>
                <div className="p-5 border-b bg-muted/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
                            <PieIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="font-black text-sm tracking-tight leading-none">Chart Studio</h2>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold opacity-40 mt-0.5">
                                {chartData ? `${chartData.length} rows` : 'No data'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-40 hover:opacity-100" onClick={() => setCollapsed(true)}>
                        <PanelLeftClose className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="flex border-b bg-muted/5">
                    {sidebarSections.map(s => (
                        <button key={s.id} onClick={() => setActiveSection(s.id)}
                            className={cn(
                                "flex-1 py-2.5 flex flex-col items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-all border-b-2",
                                activeSection === s.id ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground/60"
                            )}>
                            <s.icon className="h-3.5 w-3.5" />
                            {s.label.split(' ')[0]}
                        </button>
                    ))}
                </div>

                <div className={cn(
                    "flex-1 overflow-auto custom-scrollbar space-y-5",
                    isActualMobile ? "p-3" : "p-5"
                )}>
                    {activeSection === 'source' && (
                        <>
                            <div className="flex gap-1 bg-muted/10 rounded-xl p-1">
                                <button onClick={() => setDataMode('table')}
                                    className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                        dataMode === 'table' ? "bg-emerald-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground")}>
                                    <Table className="h-3 w-3" /> Table
                                </button>
                                <button onClick={() => setDataMode('sql')}
                                    className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                        dataMode === 'sql' ? "bg-emerald-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground")}>
                                    <Code2 className="h-3 w-3" /> SQL
                                </button>
                            </div>

                            {databases && databases.length > 0 && (
                                <Select value={currentDb} onValueChange={setCurrentDb}>
                                    <SelectTrigger className="bg-muted/10 border-border/30 h-9 text-[11px] rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-3 w-3 opacity-50" />
                                            <SelectValue placeholder="Target Database" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {databases.map(db => <SelectItem key={db} value={db} className="text-xs">{db}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}

                            {dataMode === 'table' ? (
                                <>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                        <Input placeholder="Search tables..." value={searchTable} onChange={(e) => setSearchTable(e.target.value)}
                                            className="pl-9 bg-muted/20 border-border/20 h-9 text-xs rounded-xl" />
                                    </div>

                                    <Select value={selectedTable} onValueChange={setSelectedTable}>
                                        <SelectTrigger className="bg-emerald-500/10 border-none hover:bg-emerald-500/20 text-emerald-600 text-xs h-10 rounded-2xl shadow-inner font-bold overflow-hidden">
                                            <div className="flex items-center gap-2 truncate">
                                                <Table className="h-4 w-4" />
                                                <SelectValue placeholder={isLoadingTables ? "Scanning..." : "Select Table"} />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[350px] rounded-2xl overflow-hidden shadow-2xl">
                                            {filteredTables.map(t => (
                                                <SelectItem key={t.id} value={t.name} className="text-xs focus:bg-emerald-500/10 focus:text-emerald-600">
                                                    <div className="flex items-center justify-between w-full gap-8">
                                                        <span className="font-bold">{t.name}</span>
                                                        <span className="text-[9px] opacity-30 uppercase font-bold px-1.5 py-0.5 bg-muted rounded">{t.type}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Row Limit</label>
                                            <span className="text-[10px] font-mono text-emerald-500 font-bold">{dataLimit}</span>
                                        </div>
                                        <input type="range" min={10} max={1000} step={10} value={dataLimit}
                                            onChange={(e) => setDataLimit(Number(e.target.value))}
                                            className="w-full h-1.5 bg-muted/20 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                                    </div>

                                    {columns.length > 0 && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Sort By</label>
                                            <div className="flex gap-2">
                                                <Select value={sortColumn} onValueChange={setSortColumn}>
                                                    <SelectTrigger className="bg-muted/10 border-border/20 h-8 text-[10px] rounded-lg flex-1">
                                                        <SelectValue placeholder="Column" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none" className="text-xs">None</SelectItem>
                                                        {columns.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <button onClick={() => setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC')}
                                                    className="px-3 h-8 bg-muted/10 rounded-lg text-[9px] font-bold text-muted-foreground hover:bg-muted/20 transition-colors">
                                                    {sortDir}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Custom Query</label>
                                    <textarea value={customSql} onChange={(e) => setCustomSql(e.target.value)}
                                        className="w-full h-32 bg-muted/10 border border-border/20 rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                        placeholder="SELECT * FROM ..." spellCheck={false} />
                                </div>
                            )}

                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 shadow-xl shadow-emerald-500/20 transition-all active:scale-95 rounded-xl font-bold text-xs uppercase tracking-widest"
                                onClick={() => refetch()} disabled={dataMode === 'table' ? !selectedTable : !customSql.trim() || isLoading}>
                                <Play className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                {isLoading ? 'Loading...' : 'Run Query'}
                            </Button>
                        </>
                    )}

                    {activeSection === 'chart' && (
                        <div className="grid grid-cols-3 gap-2">
                            {chartTypes.map(type => (
                                <button key={type.id} onClick={() => setChartType(type.id)}
                                    className={cn(
                                        "p-3 rounded-xl flex flex-col items-center gap-2 transition-all border text-[9px] font-bold uppercase tracking-wider",
                                        chartType === type.id
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-lg shadow-emerald-500/5"
                                            : "bg-muted/5 text-muted-foreground/50 border-border/10 hover:bg-muted/10 hover:text-muted-foreground"
                                    )}>
                                    <type.icon className="h-5 w-5" />
                                    {type.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {activeSection === 'axes' && columns.length > 0 && (
                        <>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Dimension (X-Axis)</label>
                                <Select value={xAxis} onValueChange={setXAxis}>
                                    <SelectTrigger className="bg-muted/10 border-border/20 text-xs h-9 rounded-xl font-bold">
                                        <SelectValue placeholder="Choose Dimension" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns.map(col => <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Metrics (Y-Axis)</label>
                                    <span className="text-[9px] text-emerald-500 font-bold">{yAxis.length} selected</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-auto custom-scrollbar">
                                    {columns.map(col => (
                                        <div key={col} onClick={() => setYAxis(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-[11px] transition-all border font-bold",
                                                yAxis.includes(col) ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted/5 hover:bg-muted/10 border-transparent opacity-50"
                                            )}>
                                            <div className={cn("w-3.5 h-3.5 rounded-md border-2 transition-all shrink-0",
                                                yAxis.includes(col) ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-muted-foreground/30")} />
                                            <span className="truncate flex-1">{col}</span>
                                            {numericColumns.includes(col) && <span className="text-[8px] text-emerald-500/50 font-black">#</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {activeSection === 'axes' && columns.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30 gap-3">
                            <Table className="h-10 w-10" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">Run a query first</p>
                        </div>
                    )}

                    {activeSection === 'style' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Chart Title</label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)}
                                    className="bg-muted/10 border-border/20 h-9 text-xs rounded-xl" placeholder="Chart title..." />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Color Palette</label>
                                <div className="space-y-2">
                                    {colorPalettes.map((p, i) => (
                                        <div key={i} onClick={() => setPaletteIdx(i)}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border",
                                                paletteIdx === i ? "bg-emerald-500/10 border-emerald-500/20" : "border-transparent hover:bg-muted/10 opacity-50"
                                            )}>
                                            <div className="flex gap-1">
                                                {p.colors.slice(0, 6).map((c: string) => <div key={c} className="w-4 h-4 rounded-md" style={{ backgroundColor: c }} />)}
                                            </div>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{p.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {['line', 'area', 'composed'].includes(chartType) && (
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Curve Style</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {curveTypes.map(c => (
                                            <button key={c} onClick={() => setCurveType(c)}
                                                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                                                    curveType === c ? "bg-emerald-500 text-white" : "bg-muted/10 text-muted-foreground/50 hover:text-muted-foreground")}>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeSection === 'options' && (
                        <>
                            {options.map(opt => (
                                <div key={opt.label} className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border/10 hover:border-border/20 transition-all">
                                    <div className="flex items-center gap-2.5">
                                        <opt.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                                        <span className="text-xs font-bold">{opt.label}</span>
                                    </div>
                                    <button onClick={() => opt.set(!opt.value)}
                                        className={cn("w-9 h-5 rounded-full transition-all relative",
                                            opt.value ? "bg-emerald-500" : "bg-muted/30")}>
                                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                                            opt.value ? "translate-x-4" : "translate-x-0.5")} />
                                    </button>
                                </div>
                            ))}

                            <div className="space-y-2 pt-4 border-t border-border/10">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Export</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={handleExportPNG}
                                        className="h-9 gap-2 rounded-xl text-[10px] font-bold border-border/20">
                                        <Maximize2 className="h-3.5 w-3.5" /> PNG
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleExportCSV}
                                        className="h-9 gap-2 rounded-xl text-[10px] font-bold border-border/20">
                                        <FileText className="h-3.5 w-3.5" /> CSV
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
