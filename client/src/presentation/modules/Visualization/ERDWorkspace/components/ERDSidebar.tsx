import React, { useMemo } from 'react';
import { Table, PanelLeftClose, Search, CheckSquare, Square, X, Plus } from 'lucide-react';
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
    visibleTableNames: Set<string>;
    toggleTable: (name: string) => void;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    schemaFilter: string;
    setSchemaFilter: (v: string) => void;
    handleSelectAll: () => void;
    handleDeselectAll: () => void;
}

export const ERDSidebar: React.FC<ERDSidebarProps> = ({
    isCollapsed, setCollapsed, lang, selectedDatabase, setSelectedDatabase, allDatabases, hierarchy, visibleTableNames, toggleTable, searchTerm, setSearchTerm, schemaFilter, setSchemaFilter, handleSelectAll, handleDeselectAll
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

    const filteredHierarchy = useMemo(() => {
        if (!hierarchy) return [];
        let filtered = hierarchy;
        if (schemaFilter !== 'all') filtered = filtered.filter(h => h.id?.includes(`schema:${schemaFilter}`));
        if (searchTerm) filtered = filtered.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return filtered;
    }, [hierarchy, searchTerm, schemaFilter]);

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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-40" />
                    <Input
                        placeholder={lang === 'vi' ? "Lọc bảng..." : "Filter tables..."}
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
                <div className="p-3 space-y-1">
                    {filteredHierarchy.map((t) => (
                        <div
                            key={t.id}
                            className={cn(
                                "px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                visibleTableNames.has(t.name)
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                            )}
                            onClick={() => toggleTable(t.name)}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Table className={cn("h-3.5 w-3.5 shrink-0", visibleTableNames.has(t.name) ? "opacity-100" : "opacity-30")} />
                                <span className="text-[11px] font-bold truncate">{t.name}</span>
                            </div>
                            {visibleTableNames.has(t.name) ? (
                                <X className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                            ) : (
                                <Plus className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t bg-muted/10">
                <Button variant="outline" size="sm" className="w-full text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl" onClick={handleDeselectAll}>
                    {lang === 'vi' ? 'XÓA SƠ ĐỒ' : 'Clear Canvas'}
                </Button>
            </div>
        </div>
    );
};
