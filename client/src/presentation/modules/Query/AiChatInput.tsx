import React, { useRef } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/presentation/components/ui/dropdown-menu';
import {
    Plus, Image, FileCode2, Table2, ChevronUp, Send, X, Square,
    Paperclip, Sparkles, Zap, Brain, Shield, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/presentation/hooks/useAiChat';
import { motion, AnimatePresence } from 'framer-motion';

type FieldSizingStyle = React.CSSProperties & {
    fieldSizing?: 'content';
};

interface AiChatInputProps {
    input: string;
    setInput: (val: string) => void;
    isLoading: boolean;
    attachments: Attachment[];
    removeAttachment: (index: number) => void;
    handleSend: () => void;
    handleStop: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handlePasteQuery: () => void;
    handleMentionTable: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;

    // Config states
    aiModel: string;
    setAiModel: (val: string) => void;
    aiMode: string;
    setAiMode: (val: string) => void;
    aiRoutingMode: string;
    setAiRoutingMode: (val: string) => void;

    // Config data
    MODELS: Array<{ group: string; items: Array<{ id: string; label: string; isNew?: boolean; warning?: boolean }> }>;
    MODES: Array<{ id: string; label: string; description: string }>;
    ROUTING_MODES: Array<{ id: string; label: string; description: string }>;

    // UI states
    showContextMenu: boolean;
    setShowContextMenu: (val: boolean) => void;
    showRoutingMenu: boolean;
    setShowRoutingMenu: (val: boolean) => void;
    showModeMenu: boolean;
    setShowModeMenu: (val: boolean) => void;
    showModelMenu: boolean;
    setShowModelMenu: (val: boolean) => void;

    contextMenuRef: React.RefObject<HTMLDivElement | null>;
    isNoSql: boolean;
    activeTab: { type: string; metadata?: { sql?: string } } | undefined;
    activeConnection: { type: string } | undefined;
    activeDatabase: string | null | undefined;
}

export const AiChatInput: React.FC<AiChatInputProps> = React.memo(({
    input, setInput, isLoading, attachments, removeAttachment, handleSend, handleStop, handleKeyDown,
    handleFileSelected, handlePasteQuery, handleMentionTable, fileInputRef,
    aiModel, setAiModel, aiMode, setAiMode, aiRoutingMode, setAiRoutingMode,
    MODELS, MODES, ROUTING_MODES,
    showContextMenu, setShowContextMenu,
    showRoutingMenu, setShowRoutingMenu,
    showModeMenu, setShowModeMenu,
    showModelMenu, setShowModelMenu,
    isNoSql, activeTab, activeConnection, activeDatabase
}) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const getModelIcon = (modelId: string) => {
        if (modelId.includes('gemini')) return <Sparkles className="w-3 h-3 text-violet-400" />;
        if (modelId.includes('deepseek')) return <Brain className="w-3 h-3 text-cyan-400" />;
        if (modelId.includes('glm')) return <Zap className="w-3 h-3 text-yellow-400" />;
        if (modelId.includes('llama')) return <Shield className="w-3 h-3 text-orange-400" />;
        return <Brain className="w-3 h-3 text-blue-400" />;
    };

    return (
        <div className="p-4 border-t bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.csv,.tsv,.xlsx,.ls,.ods,.json,.xml,.yaml,.yml,.txt,.md,.log,.sql,.py,.js,.ts,.tsx,.jsx,.html,.css,.go,.rs,.java,.cpp,.c,.h,.php,.rb,.sh,.toml,.ini,.env"
                className="hidden"
                onChange={handleFileSelected}
            />

            <div className="relative bg-muted/20 border border-border/50 rounded-2xl focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500/40 transition-all duration-300 flex flex-col shadow-sm">
                
                {/* Attachments preview */}
                <AnimatePresence>
                    {attachments.length > 0 && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-4 pt-4 pb-2 flex flex-wrap gap-2 overflow-hidden"
                        >
                            {attachments.map((att, i) => (
                                <motion.div
                                    layout
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    key={att.id || att.label + i}
                                    className={cn(
                                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold group border transition-colors shadow-sm",
                                        att.type === 'image' && "bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20",
                                        att.type === 'sql' && "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20",
                                        att.type === 'table' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
                                        att.type === 'file' && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20",
                                    )}
                                >
                                    {att.type === 'image' && (
                                        <>
                                            {att.preview && (
                                                <div className="relative group">
                                                    <img src={att.preview} className="w-6 h-6 rounded-md object-cover ring-1 ring-border/20 shadow-sm" alt={att.label || "attachment preview"} />
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {att.type === 'sql' && <FileCode2 className="w-3.5 h-3.5 min-w-3.5 text-cyan-400" />}
                                    {att.type === 'table' && <Table2 className="w-3.5 h-3.5 min-w-3.5 text-emerald-400" />}
                                    {att.type === 'file' && <Paperclip className="w-3.5 h-3.5 min-w-3.5 text-indigo-400" />}
                                    
                                    <span className="max-w-[140px] truncate" title={att.preview || att.label}>{att.label}</span>
                                    
                                    <button
                                        onClick={() => removeAttachment(i)}
                                        className="ml-1 opacity-50 group-hover:opacity-100 hover:text-red-400 transition-all p-0.5 rounded-full hover:bg-red-400/10"
                                        aria-label="Remove attachment"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={activeConnection ? "Hỏi bất cứ điều gì..." : "Kết nối database trước..."}
                    disabled={isLoading || !activeConnection}
                    className="w-full bg-transparent border-none text-sm p-4 resize-none focus:outline-none min-h-[70px] max-h-[250px] placeholder:text-muted-foreground/50 leading-relaxed scrollbar-none"
                    rows={1}
                    style={{ fieldSizing: "content" } satisfies FieldSizingStyle}
                />

                {/* Toolbar */}
                <div className="flex items-center justify-between p-2 pt-0 gap-1.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none">
                        
                        {/* Attachments Dropdown */}
                        <DropdownMenu open={showContextMenu} onOpenChange={setShowContextMenu}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 transition-colors shrink-0"
                                    title="Đính kèm context"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-56 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl p-1.5 animate-in slide-in-from-bottom-2 duration-300 z-[110]">
                                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Đính kèm</DropdownMenuLabel>
                                <DropdownMenuItem className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-accent/50 group" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                                        <Image className="w-4 h-4 text-pink-400" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold">Tệp / Hình ảnh</div>
                                        <div className="text-[9px] text-muted-foreground">Ảnh, PDF, Excel, Code...</div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group", (!isNoSql && (!activeTab || activeTab.type !== 'query' || !activeTab.metadata?.sql)) && "opacity-40 grayscale pointer-events-none")} 
                                    onClick={handlePasteQuery}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                                        <FileCode2 className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold">{isNoSql ? 'MQL từ Editor' : 'SQL từ Editor'}</div>
                                        <div className="text-[9px] text-muted-foreground">Dùng code đang mở</div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group", (!activeConnection || !activeDatabase) && "opacity-40 grayscale pointer-events-none")} 
                                    onClick={handleMentionTable}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                        <Table2 className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold">Schema Context</div>
                                        <div className="text-[9px] text-muted-foreground">Cấu trúc DB đang chọn</div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="h-4 w-px bg-border/20 mx-0.5 shrink-0" />

                        {/* Routing Selector */}
                        <DropdownMenu open={showRoutingMenu} onOpenChange={setShowRoutingMenu}>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-muted/50 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95 group" title="Routing Mode">
                                    <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                                        {aiRoutingMode === 'auto' ? <Sparkles className="w-3.5 h-3.5" /> : <ChevronUp className="w-3 h-3" />}
                                    </span>
                                    <span className="hidden sm:inline lg:hidden xl:inline">{ROUTING_MODES.find(m => m.id === aiRoutingMode)?.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[18rem] bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-3xl p-1.5 z-[110]">
                                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Routing Mode</DropdownMenuLabel>
                                {ROUTING_MODES.map(m => (
                                    <DropdownMenuItem
                                        key={m.id}
                                        className={cn("flex flex-col items-start px-3 py-3 hover:bg-white/5 rounded-xl cursor-pointer mb-0.5", aiRoutingMode === m.id && "bg-white/5 ring-1 ring-white/10")}
                                        onClick={() => setAiRoutingMode(m.id)}
                                    >
                                        <span className="text-xs font-bold mb-1">{m.label}</span>
                                        <span className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Mode Selector */}
                        <DropdownMenu open={showModeMenu} onOpenChange={setShowModeMenu}>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-muted/50 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95 group" title="Conversation Mode">
                                    <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Brain className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="hidden sm:inline lg:hidden xl:inline">{MODES.find(m => m.id === aiMode)?.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[16rem] bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-3xl p-1.5 z-[110]">
                                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Mode</DropdownMenuLabel>
                                {MODES.map(m => (
                                    <DropdownMenuItem
                                        key={m.id}
                                        className={cn("flex flex-col items-start px-3 py-3 hover:bg-white/5 rounded-xl cursor-pointer mb-0.5", aiMode === m.id && "bg-white/5 ring-1 ring-white/10")}
                                        onClick={() => setAiMode(m.id)}
                                    >
                                        <span className="text-xs font-bold mb-1">{m.label}</span>
                                        <span className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Model Selector */}
                        <DropdownMenu open={showModelMenu} onOpenChange={setShowModelMenu}>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted/50 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all min-w-0 flex-1 overflow-hidden group">
                                    <div className="shrink-0 transition-transform group-hover:scale-110 duration-300">
                                        {getModelIcon(aiModel)}
                                    </div>
                                    <span className="truncate hidden sm:inline lg:hidden xl:inline">
                                        {MODELS.flatMap(g => g.items).find(m => m.id === aiModel)?.label ?? 'Model'}
                                    </span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[18rem] max-h-[400px] overflow-y-auto custom-scrollbar bg-[#1a1a1a]/98 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-4xl p-1.5 z-[110]">
                                <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Model</DropdownMenuLabel>
                                {MODELS.map((group, gi) => (
                                    <React.Fragment key={group.group}>
                                        {gi > 0 && <DropdownMenuSeparator className="bg-white/5 my-1.5" />}
                                        <div className="px-3 py-1.5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.15em]">{group.group}</div>
                                        {group.items.map(m => (
                                            <DropdownMenuItem
                                                key={m.id}
                                                className={cn("flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer mb-0.5 group", aiModel === m.id && "bg-white/10 ring-1 ring-white/10")}
                                                onClick={() => setAiModel(m.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("transition-all", aiModel === m.id ? "scale-110 opacity-100" : "scale-100 opacity-60 group-hover:opacity-100")}>
                                                        {getModelIcon(m.id)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={cn("text-[11px] transition-colors", aiModel === m.id ? "font-bold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground")}>{m.label}</span>
                                                        {m.warning && <div className="flex items-center gap-1 text-[8px] text-yellow-500/80 mt-0.5"><Info className="w-2.5 h-2.5" /> High latency</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {m.isNew && <span className="text-[8px] bg-violet-500/20 text-violet-400 font-black px-1.5 py-0.5 rounded-sm tracking-tighter shadow-sm ring-1 ring-violet-500/30 uppercase">NEW</span>}
                                                    {aiModel === m.id && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-pulse" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {isLoading ? (
                            <Button
                                size="icon"
                                className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 shrink-0 text-white shadow-lg shadow-red-500/20 focus:ring-red-500/30 animate-pulse border-none"
                                onClick={handleStop}
                            >
                                <Square className="w-3 h-3 fill-white stroke-none" />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                className={cn(
                                    "h-8 w-8 rounded-full shrink-0 text-white transition-all duration-300 border-none",
                                    (!input.trim() && attachments.length === 0) || !activeConnection
                                        ? "bg-muted-foreground/10 text-muted-foreground/30"
                                        : "bg-gradient-to-tr from-violet-600 to-indigo-500 hover:scale-105 active:scale-95 shadow-lg shadow-violet-500/25"
                                )}
                                onClick={handleSend}
                                disabled={(!input.trim() && attachments.length === 0) || !activeConnection}
                            >
                                <Send className={cn("w-3.5 h-3.5 ml-0.5 transition-transform", input.trim() && "translate-x-0.5 -translate-y-px")} />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-3 pb-1.5">
                    <div className="flex items-center justify-between text-[8px] text-muted-foreground/50 font-medium">
                        <div className="flex items-center gap-1 truncate max-w-[70%]">
                            {aiRoutingMode === 'gemini-only'
                                ? 'Gemini only.'
                                : 'Auto routing enabled.'}
                        </div>
                        {activeDatabase && (
                            <div className="flex items-center gap-1 opacity-60 shrink-0">
                                <Table2 className="w-2 h-2 opacity-50" />
                                <span>{activeDatabase}</span>
                            </div>
                        )}
                </div>
            </div>
        </div>
    </div>
);
});
