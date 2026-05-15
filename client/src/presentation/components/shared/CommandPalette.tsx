import React, { useState, useEffect } from 'react';
import { Search, Database, Globe, Command as CommandIcon, Loader2, Sparkles, Zap, History } from 'lucide-react';
import { Dialog, DialogContent } from '@/presentation/components/ui/dialog';
import { Input } from '@/presentation/components/ui/input';
import { SearchService } from '@/core/services/SearchService';
import type { SearchResult } from '@/core/services/SearchService';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const CommandPalette: React.FC = () => {
    const { 
        isCommandPaletteOpen, 
        setCommandPaletteOpen, 
        lang, 
        setActiveConnectionId,
        setActiveDatabase
    } = useAppStore();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setCommandPaletteOpen]);

    // Search logic
    useEffect(() => {
        if (!isCommandPaletteOpen) {
            setQuery('');
            setResults([]);
            return;
        }

        if (query.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const data = await SearchService.search(query);
                setResults(data);
                setActiveIndex(0);
            } catch (err) {
                console.error('Search error:', err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isCommandPaletteOpen]);

    const handleSelect = (result: SearchResult) => {
        setActiveConnectionId(result.connectionId);
        if (result.database) {
            setActiveDatabase(result.database);
        }
        
        toast.success(lang === 'vi' 
            ? `Đã chuyển sang ${result.connectionName}${result.database ? ` (${result.database})` : ''}` 
            : `Switched to ${result.connectionName}${result.database ? ` (${result.database})` : ''}`
        );
        
        setCommandPaletteOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter' && results[activeIndex]) {
            handleSelect(results[activeIndex]);
        } else if (e.key === 'Escape') {
            setCommandPaletteOpen(false);
        }
    };

    return (
        <Dialog open={isCommandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
            <DialogContent className="max-w-[calc(100vw-1rem)] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl sm:max-w-2xl">
                <div className="flex items-center border-b border-white/5 px-4 h-14 space-x-3">
                    <Search className="w-5 h-5 text-muted-foreground opacity-50" />
                    <Input
                        autoFocus
                        placeholder={lang === 'vi' ? "Tìm kiếm bảng, view hoặc thực thi lệnh..." : "Search tables, views or run commands..."}
                        className="flex-1 bg-transparent border-none focus-visible:ring-0 text-md h-full placeholder:text-muted-foreground/40"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <div className="flex items-center space-x-1.5 h-6 px-1.5 rounded-md bg-white/5 border border-white/10">
                        <span className="text-[10px] font-bold text-muted-foreground opacity-60">ESC</span>
                    </div>
                </div>

                <div className="max-h-[min(450px,70vh)] overflow-y-auto p-2 custom-scrollbar">
                    {isLoading && (
                        <div className="flex items-center justify-center py-10 opacity-50 space-x-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-xs font-medium tracking-tight italic">
                                {lang === 'vi' ? "AI đang suy nghĩ..." : "AI is thinking..."}
                            </span>
                        </div>
                    )}

                    {!isLoading && results.length === 0 && query.length >= 2 && (
                        <div className="py-12 text-center">
                            <p className="text-sm text-muted-foreground italic opacity-40">
                                {lang === 'vi' ? "Không tìm thấy kết quả nào" : "No results found"}
                            </p>
                        </div>
                    )}

                    {!isLoading && results.length === 0 && query.length < 2 && (
                        <div className="p-4 py-8 space-y-6">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-2 mb-3">
                                    {lang === 'vi' ? "Lệnh gợi ý" : "Suggested Commands"}
                                </h3>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <CommandItem 
                                        icon={<Zap className="w-4 h-4 text-amber-400" />} 
                                        label={lang === 'vi' ? "Đồng bộ Index" : "Sync Index"} 
                                        shortcut="CTRL+S"
                                        onClick={async () => {
                                            await SearchService.syncIndex();
                                            toast.success("Sync complete");
                                        }}
                                    />
                                    <CommandItem 
                                        icon={<History className="w-4 h-4 text-blue-400" />} 
                                        label={lang === 'vi' ? "Thanh lịch sử" : "Query History"} 
                                        shortcut="G+H"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-center space-x-2 py-4 border-t border-white/5">
                                <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                                <p className="text-[10px] text-muted-foreground/40 font-medium">
                                    {lang === 'vi' 
                                        ? "Dùng ngôn ngữ tự nhiên để tìm kiếm thông minh" 
                                        : "Use natural language for semantic search"}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isLoading && results.length > 0 && (
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-3 py-2">
                                {lang === 'vi' ? "Kết quả tìm kiếm" : "Search Results"}
                            </h3>
                            {results.map((result, index) => (
                                <div
                                    key={`${result.id}-${index}`}
                                    onClick={() => handleSelect(result)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer border border-transparent",
                                        index === activeIndex 
                                            ? "bg-blue-500/10 border-blue-500/20 shadow-inner" 
                                            : "hover:bg-white/5",
                                        result.isAiSuggested && "bg-purple-500/5"
                                    )}
                                >
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center border transition-all",
                                            index === activeIndex ? "bg-blue-500 border-blue-400/50 shadow-lg shadow-blue-500/20" : "bg-muted/50 border-white/5"
                                        )}>
                                            {result.isAiSuggested ? (
                                                <Sparkles className={cn("w-4 h-4", index === activeIndex ? "text-white" : "text-purple-400")} />
                                            ) : (
                                                <Database className={cn("w-4 h-4", index === activeIndex ? "text-white" : "text-blue-500")} />
                                            )}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <div className="flex items-center space-x-2">
                                                <span className={cn(
                                                    "text-sm font-bold truncate",
                                                    result.isAiSuggested && index !== activeIndex ? "text-purple-300" : "text-foreground"
                                                )}>
                                                    {result.name}
                                                </span>
                                                {result.isAiSuggested && (
                                                    <span className="text-[8px] px-1 py-0.5 rounded-sm bg-purple-500/20 text-purple-400 font-black tracking-tighter">AI</span>
                                                )}
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-black uppercase tracking-tighter">
                                                    {result.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground/60 font-medium">
                                                <Globe className="w-2.5 h-2.5 opacity-40" />
                                                <span className="truncate">{result.connectionName}</span>
                                                {result.schema && <span className="opacity-30">• {result.schema}</span>}
                                                {result.database && result.database !== 'default' && <span className="opacity-30">({result.database})</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {index === activeIndex && (
                                            <div className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 border border-white/10 animate-in fade-in slide-in-from-right-2 duration-300">
                                                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">ENTER TO OPEN</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="h-10 px-4 border-t border-white/5 flex items-center justify-between gap-3 bg-muted/20">
                    <div className="hidden items-center space-x-4 sm:flex">
                        <KbdHint keys={["↑", "↓"]} label={lang === 'vi' ? "Di chuyển" : "Navigate"} />
                        <KbdHint keys={["↵"]} label={lang === 'vi' ? "Mở" : "Open"} />
                    </div>
                    <div className="flex items-center space-x-1.5">
                        <CommandIcon className="w-3 h-3 text-muted-foreground opacity-40" />
                        <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">Antigravity AI Engine</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const CommandItem = ({ icon, label, shortcut, onClick }: { icon: React.ReactNode, label: string, shortcut?: string, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer transition-all group"
    >
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <span className="text-xs font-bold text-foreground/80 group-hover:text-foreground">{label}</span>
        </div>
        {shortcut && (
            <span className="text-[9px] font-bold text-muted-foreground opacity-30 group-hover:opacity-60">{shortcut}</span>
        )}
    </div>
);

const KbdHint = ({ keys, label }: { keys: string[], label: string }) => (
    <div className="flex items-center space-x-1.5 opacity-40">
        {keys.map((k, i) => (
            <span key={i} className="text-[10px] font-black text-muted-foreground bg-white/5 border border-white/10 px-1 rounded-sm">{k}</span>
        ))}
        <span className="text-[9px] font-bold uppercase tracking-widest ml-1">{label}</span>
    </div>
);
