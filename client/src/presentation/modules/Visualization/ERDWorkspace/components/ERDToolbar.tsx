import React from 'react';
import { Panel } from '@xyflow/react';
import { PanelLeft, GitGraph, LayoutGrid, Download, FileCode, Eye, Maximize2, Settings, Minimize2, Activity, Grid } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/presentation/components/ui/dropdown-menu";
import type { DetailLevel } from '../useERDLogic';

interface ERDToolbarProps {
    isSidebarCollapsed: boolean;
    setSidebarCollapsed: (v: boolean) => void;
    lang: string;
    activeConnectionName?: string;
    selectedDatabase?: string;
    detailLevel: DetailLevel;
    setDetailLevel: (v: DetailLevel) => void;
    showMinimap: boolean;
    setShowMinimap: (v: boolean) => void;
    handleAutoLayout: (direction?: 'TB' | 'LR') => void;
    handleExportPNG: () => void;
    handleExportSQL: () => void;
    performanceMode: boolean;
    setPerformanceMode: (v: boolean) => void;
    edgeRouting: 'smoothstep' | 'step' | 'straight';
    setEdgeRouting: (v: 'smoothstep' | 'step' | 'straight') => void;
    backgroundVariant: 'dots' | 'lines' | 'cross';
    setBackgroundVariant: (v: 'dots' | 'lines' | 'cross') => void;
    isEdgeAnimated: boolean;
    setIsEdgeAnimated: (v: boolean) => void;
    isToolbarCollapsed: boolean;
    setIsToolbarCollapsed: (v: boolean) => void;
    onFitView: () => void;
}

export const ERDToolbar: React.FC<ERDToolbarProps> = ({
    isSidebarCollapsed, setSidebarCollapsed, lang, activeConnectionName, selectedDatabase, detailLevel, setDetailLevel, showMinimap, setShowMinimap, handleAutoLayout, handleExportPNG, handleExportSQL, performanceMode, setPerformanceMode, edgeRouting, setEdgeRouting, backgroundVariant, setBackgroundVariant, isEdgeAnimated, setIsEdgeAnimated, isToolbarCollapsed, setIsToolbarCollapsed
}) => {
    if (isToolbarCollapsed) {
        return (
            <Panel position="top-left" className="m-4 flex flex-col gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10 bg-card/80 backdrop-blur border-border/40 shadow-xl rounded-xl" onClick={() => setIsToolbarCollapsed(false)} title="Expand Toolbar">
                    <Maximize2 className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
                {isSidebarCollapsed && (
                    <Button variant="outline" size="icon" className="h-10 w-10 bg-card/80 backdrop-blur border-border/40 shadow-xl rounded-xl" onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} title="Toggle Sidebar">
                        <PanelLeft className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </Button>
                )}
            </Panel>
        );
    }

    return (
        <Panel position="top-left" className="m-4">
            <div className="flex flex-col gap-3 group/toolbar transition-all duration-300 transform-gpu origin-top-left">
                <div className="bg-card/80 backdrop-blur-xl border border-border/40 p-4 rounded-2xl shadow-2xl ring-1 ring-white/5 relative">
                    {/* Minimize button */}
                    <button 
                        onClick={() => setIsToolbarCollapsed(true)}
                        className="absolute right-2 top-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                        title="Minimize Toolbar"
                    >
                        <Minimize2 className="h-3.5 w-3.5" />
                    </button>
                    
                    <div className="flex items-center gap-3 mb-3 pr-6">
                        {isSidebarCollapsed && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => setSidebarCollapsed(false)}>
                                <PanelLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <GitGraph className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <h1 className="text-sm font-black tracking-tight leading-none mb-1 truncate">ERD Visualizer</h1>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60 overflow-hidden">
                                <span className="truncate max-w-[120px] sm:max-w-xs">{activeConnectionName}</span>
                                <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                                <span className="truncate max-w-[80px] sm:max-w-[150px]">{selectedDatabase || (lang === 'vi' ? 'Sơ đồ mặc định' : 'Default Schema')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-3 border-t border-border/10">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="sm" className="h-8 text-[11px] font-bold gap-2 px-3 rounded-lg shadow-sm">
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                    {lang === 'vi' ? 'Sắp xếp' : 'Auto Layout'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 p-1.5 rounded-xl border-border/40 backdrop-blur-3xl bg-card/80">
                                <DropdownMenuItem onClick={() => handleAutoLayout('LR')} className="gap-2">
                                    <LayoutGrid className="w-3.5 h-3.5 rotate-90" />
                                    {lang === 'vi' ? 'Sắp xếp Ngang' : 'Horizontal (L-R)'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAutoLayout('TB')} className="gap-2">
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Sắp xếp Dọc' : 'Vertical (T-B)'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-6 bg-border/20 mx-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold gap-2 px-3 rounded-lg">
                                    <Eye className="h-3.5 w-3.5" />
                                    {lang === 'vi' ? 'Chế độ xem' : 'View Mode'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border-border/40 backdrop-blur-3xl bg-card/80">
                                <DropdownMenuItem onClick={() => setDetailLevel('all')} className={detailLevel === 'all' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Chi tiết nhất' : 'Full Detail'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDetailLevel('keys')} className={detailLevel === 'keys' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Chỉ xem Khóa' : 'Only Keys'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setDetailLevel('name')} className={detailLevel === 'name' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Rút gọn' : 'Compact View'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowMinimap(!showMinimap)}>
                                    {showMinimap ? (lang === 'vi' ? 'Ẩn bản đồ thu nhỏ' : 'Hide Minimap') : (lang === 'vi' ? 'Hiện bản đồ thu nhỏ' : 'Show Minimap')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-6 bg-border/20 mx-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold gap-2 px-3 rounded-lg">
                                    <Settings className="h-3.5 w-3.5" />
                                    {lang === 'vi' ? 'Tuỳ chỉnh UI' : 'UI Options'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl border-border/40 backdrop-blur-3xl bg-card/80">
                                <DropdownMenuItem onClick={() => setPerformanceMode(!performanceMode)} className={performanceMode ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-3.5 w-3.5 text-blue-400" />
                                        {performanceMode ? (lang === 'vi' ? 'Đang bật Tối ưu' : 'Performance Mode ON') : (lang === 'vi' ? 'Tắt hiệu ứng chống lag' : 'Basic Performance')}
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsEdgeAnimated(!isEdgeAnimated)} className={isEdgeAnimated ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${isEdgeAnimated ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
                                        {isEdgeAnimated ? (lang === 'vi' ? 'Hiệu ứng Data Flow' : 'Data Flow Animation') : (lang === 'vi' ? 'Bật hiệu ứng Data Flow' : 'Enable Flow Animation')}
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">{lang === 'vi' ? 'Nền (Background)' : 'Background'}</span>
                                    <Grid className="h-3 w-3 text-muted-foreground/50" />
                                </div>
                                <div className="px-2 pb-2 pt-1 flex gap-2">
                                    {(['dots', 'lines', 'cross'] as const).map(variant => (
                                        <button 
                                            key={variant}
                                            onClick={() => setBackgroundVariant(variant)}
                                            className={`flex-1 py-1 text-[10px] uppercase font-bold rounded-md border text-center transition-colors ${backgroundVariant === variant ? 'border-primary text-primary bg-primary/10' : 'border-border/50 text-muted-foreground hover:bg-white/5'}`}
                                        >
                                            {variant}
                                        </button>
                                    ))}
                                </div>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1.5 text-[9px] font-black uppercase text-muted-foreground/50 tracking-widest">
                                    {lang === 'vi' ? 'Kiểu đường kết nối' : 'Edge Routing'}
                                </div>
                                <DropdownMenuItem onClick={() => setEdgeRouting('smoothstep')} className={edgeRouting === 'smoothstep' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Góc Trơn (Mặc định)' : 'Smooth Step'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEdgeRouting('step')} className={edgeRouting === 'step' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Góc Vuông' : 'Step'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEdgeRouting('straight')} className={edgeRouting === 'straight' ? 'bg-primary/10 text-primary font-bold' : ''}>
                                    {lang === 'vi' ? 'Đường Thẳng' : 'Straight'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="w-px h-6 bg-border/20 mx-1" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold gap-2 px-3 rounded-lg">
                                    <Download className="h-3.5 w-3.5" />
                                    {lang === 'vi' ? 'Xuất' : 'Export'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border-border/40 backdrop-blur-3xl bg-card/80">
                                <DropdownMenuItem onClick={handleExportPNG} className="gap-2">
                                    <Download className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Tải ảnh PNG' : 'Download PNG'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportSQL} className="gap-2">
                                    <FileCode className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Tải mã SQL' : 'Download SQL'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>


                    </div>
                </div>
            </div>
        </Panel>
    );
};
