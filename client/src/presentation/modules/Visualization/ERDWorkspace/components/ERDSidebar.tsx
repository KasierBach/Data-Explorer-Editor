import React, { useMemo } from 'react';
import { Table, PanelLeftClose, Search, CheckSquare, Square, X, Plus, Globe, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

interface ERDSidebarProps {
    isCollapsed: boolean;
    setCollapsed: (v: boolean) => void;
    lang: string;
    selectedDatabase?: string;
    setSelectedDatabase: (v: string) => void;
    allDatabases: any[];
    hierarchy: any[];
    filteredHierarchy: any[];
    visibleTableNames: Set<string>;
    toggleTable: (name: string) => void;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    schemaFilter: string;
    setSchemaFilter: (v: string) => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
    isLoadingHierarchy?: boolean;
    globalSearchResults?: any[];
    isSearchingGlobal?: boolean;
    onAddGlobalTable?: (item: any) => void;
}

export const ERDSidebar: React.FC<ERDSidebarProps> = ({
    isCollapsed, setCollapsed, lang, selectedDatabase, setSelectedDatabase, allDatabases, hierarchy, filteredHierarchy, visibleTableNames, toggleTable, searchTerm, setSearchTerm, schemaFilter, setSchemaFilter, handleSelectAll, handleDeselectAll, isLoadingHierarchy, globalSearchResults = [], isSearchingGlobal = false, onAddGlobalTable
}) => {
    const hasDatabases = allDatabases && allDatabases.length > 0;

    const schemas = useMemo(() => {
        if (!hierarchy) return [];
        const schemaSet = new Set<string>();
        hierarchy.forEach(h => {
            const match = h.id?.match(/schema:([^.]+)/);
            if (match) schemaSet.add(match[1]);
        });
        return Array.from(schemaSet).sort();
    }, [hierarchy]);

    return (
        <div className={cn(
            "border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 custom-scrollbar transition-all duration-300",
            isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-80"
        )}>
            <div className="p-5 border-b bg-muted/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/10">
                            <Table className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="font-black text-sm uppercase tracking-widest">{lang === 'vi' ? 'Thực thể' : 'Entities'}</h2>
                            <span className="text-[9px] text-muted-foreground">
                                {visibleTableNames.size}/{hierarchy?.length || 0} {lang === 'vi' ? 'đã chọn' : 'selected'}
                            </span>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)}>
                        <PanelLeftClose className="h-4 w-4" />
                    </Button>
                </div>

                {hasDatabases && (
                    <div className="mb-3">
                        <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                            <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/20">
                                <SelectValue placeholder={lang === 'vi' ? 'Chọn Cơ sở dữ liệu' : 'Select Database'} />
                            </SelectTrigger>
                            <SelectContent>
                                {allDatabases.map((db: any) => (
                                    <SelectItem key={db.id} value={db.name} className="text-xs">{db.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {schemas.length > 1 && (
                    <div className="mb-3">
                        <Select value={schemaFilter} onValueChange={setSchemaFilter}>
                            <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/20">
                                <Layers className="w-3 h-3 mr-1" />
                                <SelectValue placeholder={lang === 'vi' ? 'Tất cả Schema' : 'All Schemas'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">{lang === 'vi' ? 'Tất cả Schema' : 'All Schemas'}</SelectItem>
                                {schemas.map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {isSearchingGlobal ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        ) : (
                            <Search className="h-3 w-3 text-muted-foreground opacity-40" />
                        )}
                    </div>
                    <Input
                        placeholder={lang === 'vi' ? "Lọc hoặc tìm nhanh bảng..." : "Filter or quick find tables..."}
                        className="pl-8 bg-muted/20 border-border/20 h-8 text-[11px] rounded-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider gap-1" onClick={handleSelectAll}>
                        <CheckSquare className="h-3 w-3" />
                        {lang === 'vi' ? 'Tất cả' : 'All'}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider gap-1" onClick={handleDeselectAll}>
                        <Square className="h-3 w-3" />
                        {lang === 'vi' ? 'Bỏ chọn' : 'None'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                {isLoadingHierarchy ? (
                    <div className="p-12 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        <p className="text-[11px] font-bold text-muted-foreground animate-pulse tracking-wide uppercase">
                            {lang === 'vi' ? 'Đang tải thực thể...' : 'Exploring Entities...'}
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {/* Local Results */}
                        <div className="space-y-1.5">
                            <div className="px-3 pb-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-b border-border/10 mb-2 flex justify-between items-center">
                                <span>{lang === 'vi' ? 'Danh sách bảng' : 'Table List'}</span>
                                {filteredHierarchy.length > 0 && <span className="opacity-50">{filteredHierarchy.length}</span>}
                            </div>
                            {filteredHierarchy.length === 0 && !isSearchingGlobal && (
                                <div className="py-4 text-center text-[10px] text-muted-foreground italic">
                                    {lang === 'vi' ? 'Không tìm thấy bảng cục bộ' : 'No local tables found'}
                                </div>
                            )}
                            {filteredHierarchy.map((t) => (
                                <div
                                    key={t.id}
                                    className={cn(
                                        "px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 flex items-center justify-between group relative overflow-hidden",
                                        visibleTableNames.has(t.name)
                                            ? "bg-blue-500/10 text-primary border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                                            : "hover:bg-muted/40 text-muted-foreground border border-transparent hover:border-border/30"
                                    )}
                                    onClick={() => toggleTable(t.name)}
                                >
                                    <div className="flex items-center gap-3 min-w-0 relative z-10">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            visibleTableNames.has(t.name) ? "bg-blue-500 animate-pulse" : "bg-muted-foreground/20"
                                        )} />
                                        <span className="text-xs font-bold truncate tracking-tight">{t.name}</span>
                                    </div>
                                    <div className="relative z-10 flex items-center">
                                        {visibleTableNames.has(t.name) ? (
                                            <X className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Global/Smart Suggestions */}
                        {globalSearchResults.length > 0 && (
                            <div className="space-y-1.5 pt-2 animate-in slide-in-from-bottom-2 duration-500">
                                <div className="px-3 pb-2 text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] border-b border-emerald-500/10 mb-2 flex items-center gap-2">
                                    <Globe className="w-3 h-3" />
                                    <span>{lang === 'vi' ? 'Gợi ý thông minh' : 'Smart Suggestions'}</span>
                                </div>
                                {globalSearchResults.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col gap-1 group border border-transparent",
                                            item.isAiSuggested 
                                                ? "bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.05)]" 
                                                : "hover:bg-emerald-500/5 hover:border-emerald-500/20"
                                        )}
                                        onClick={() => onAddGlobalTable?.(item)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-xs font-bold transition-colors uppercase tracking-tight",
                                                    item.isAiSuggested ? "text-purple-400 group-hover:text-purple-300" : "text-white group-hover:text-emerald-400"
                                                )}>
                                                    {item.name}
                                                </span>
                                                {item.isAiSuggested && (
                                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[8px] text-purple-400 font-black animate-pulse">
                                                        <Sparkles className="w-2 h-2" />
                                                        AI
                                                    </div>
                                                )}
                                            </div>
                                            <Plus className={cn(
                                                "h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity",
                                                item.isAiSuggested ? "text-purple-500" : "text-emerald-500"
                                            )} />
                                        </div>
                                        <div className="flex items-center gap-2 opacity-50 text-[9px] font-medium italic">
                                            <span className="truncate max-w-[100px]">{item.connectionName}</span>
                                            <span>•</span>
                                            <span>{item.database} {item.schema ? `• ${item.schema}` : ''}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="px-4 py-2 text-[9px] text-muted-foreground/30 text-center italic">
                                    {globalSearchResults.some(i => i.isAiSuggested) 
                                        ? (lang === 'vi' ? 'Kết quả từ Redis Hybrid Search (AI + Index)' : 'Results from Redis Hybrid Search (AI + Index)')
                                        : (lang === 'vi' ? 'Kết quả từ Redis Global Index' : 'Results from Redis Global Index')
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 border-t bg-muted/10">
                <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl" onClick={handleDeselectAll}>
                    {lang === 'vi' ? 'XÓA SƠ ĐỒ' : 'Clear Canvas'}
                </Button>
            </div>
        </div>
    );
};
