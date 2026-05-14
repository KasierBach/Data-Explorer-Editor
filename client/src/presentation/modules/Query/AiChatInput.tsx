import React, { useRef } from 'react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import {
    Plus, Image, FileCode2, Table2, ChevronUp, Send, X, TriangleAlert, Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/presentation/hooks/useAiChat';

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
    activeTab: { type: string; metadata?: any } | undefined;
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
    contextMenuRef, isNoSql, activeTab, activeConnection, activeDatabase
}) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="p-3 border-t bg-background">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.csv,.tsv,.xlsx,.xls,.ods,.json,.xml,.yaml,.yml,.txt,.md,.log,.sql,.py,.js,.ts,.tsx,.jsx,.html,.css,.go,.rs,.java,.cpp,.c,.h,.php,.rb,.sh,.toml,.ini,.env"
                className="hidden"
                onChange={handleFileSelected}
            />

            <div className="bg-muted/30 border border-border/50 rounded-xl focus-within:ring-1 focus-within:ring-violet-500/30 focus-within:border-violet-500/50 transition-all flex flex-col">

                {/* Attachments preview */}
                {attachments.length > 0 && (
                    <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
                        {attachments.map((att, i) => (
                                <div
                                key={att.id || att.label + i}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium group",
                                    att.type === 'image' && "bg-pink-500/10 text-pink-400 border border-pink-500/20",
                                    att.type === 'sql' && "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
                                    att.type === 'table' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                    att.type === 'file' && "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
                                )}
                            >
                                {att.type === 'image' && (
                                    <>
                                        {att.preview && <img src={att.preview} className="w-5 h-5 rounded object-cover" alt={att.label || "attachment preview"} />}
                                        <Image className="w-3 h-3" />
                                    </>
                                )}
                                {att.type === 'sql' && <FileCode2 className="w-3 h-3 min-w-3" />}
                                {att.type === 'table' && <Table2 className="w-3 h-3 min-w-3" />}
                                <span className="max-w-[150px] truncate" title={att.preview || att.label}>{att.label}</span>
                                <button
                                    onClick={() => removeAttachment(i)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                                    aria-label="Remove attachment"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={activeConnection ? "Hỏi bất cứ điều gì..." : "Kết nối database trước..."}
                    disabled={isLoading || !activeConnection}
                    className="w-full bg-transparent border-none text-xs p-3 resize-none focus:outline-none min-h-[60px] max-h-[200px]"
                    rows={1}
                    style={{ fieldSizing: "content" } as any}
                />

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between p-2 pt-0 gap-y-2 gap-x-1">
                    <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none scroll-smooth">
                        {/* Paperclip */}
                        <div className="relative" ref={contextMenuRef}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground shrink-0"
                                onClick={() => setShowContextMenu(!showContextMenu)}
                                title="Đính kèm context"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                            {showContextMenu && (
                                <div className="absolute bottom-[calc(100%+8px)] left-0 w-52 bg-popover border border-border rounded-lg shadow-xl py-1 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-150">
                                    <div className="px-2 py-1">
                                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Đính kèm context</span>
                                    </div>
                                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left" onClick={() => { setShowContextMenu(false); fileInputRef.current?.click(); }}>
                                        <Image className="w-4 h-4 text-pink-400" />
                                        <div>
                                            <div className="font-medium">Tệp / Hình ảnh</div>
                                            <div className="text-[9px] text-muted-foreground">PDF, Excel, CSV, code, ảnh...</div>
                                        </div>
                                    </button>
                                    <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!isNoSql && (!activeTab || activeTab.type !== 'query' || !activeTab.metadata?.sql)) && "opacity-40 pointer-events-none")} onClick={() => { setShowContextMenu(false); handlePasteQuery(); }}>
                                        <FileCode2 className="w-4 h-4 text-cyan-400" />
                                        <div>
                                            <div className="font-medium">{isNoSql ? 'MQL từ Editor' : 'SQL từ Editor'}</div>
                                            <div className="text-[9px] text-muted-foreground">{isNoSql ? 'Đính kèm JSON query' : 'Đính kèm SQL đang mở'}</div>
                                        </div>
                                    </button>
                                    <button className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left", (!activeConnection || !activeDatabase) && "opacity-40 pointer-events-none")} onClick={() => { setShowContextMenu(false); handleMentionTable(); }}>
                                        <Table2 className="w-4 h-4 text-emerald-400" />
                                        <div>
                                            <div className="font-medium">Database Context</div>
                                            <div className="text-[9px] text-muted-foreground">Thêm thông tin DB đang kết nối</div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Selector components... */}
                        {/* Routing Selector */}
                        <DropdownMenu
                            open={showRoutingMenu}
                            onOpenChange={(open) => {
                                setShowRoutingMenu(open);
                                if (open) {
                                    setShowModelMenu(false);
                                    setShowModeMenu(false);
                                    setShowContextMenu(false);
                                }
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                    <ChevronUp className="w-3 h-3 opacity-50 shrink-0" />
                                    <span>{ROUTING_MODES.find(m => m.id === aiRoutingMode)?.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[18rem] max-w-[calc(100vw-2rem)] max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1c1c1c] border-border/10 rounded-xl shadow-2xl p-1.5 text-foreground">
                                <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground mb-1">Routing mode</div>
                                <div className="flex flex-col gap-0.5">
                                    {ROUTING_MODES.map(m => (
                                        <button
                                            key={m.id}
                                            className={cn("w-full flex flex-col items-start px-2.5 py-2 hover:bg-white/5 rounded-lg transition-colors text-left", aiRoutingMode === m.id && "bg-white/5")}
                                            onClick={() => { setAiRoutingMode(m.id); setShowRoutingMenu(false); }}
                                        >
                                            <span className="text-xs font-semibold mb-0.5">{m.label}</span>
                                            <span className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Mode Selector */}
                        <DropdownMenu
                            open={showModeMenu}
                            onOpenChange={(open) => {
                                setShowModeMenu(open);
                                if (open) {
                                    setShowModelMenu(false);
                                    setShowRoutingMenu(false);
                                    setShowContextMenu(false);
                                }
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
                                    <ChevronUp className="w-3 h-3 opacity-50 shrink-0" />
                                    <span>{MODES.find(m => m.id === aiMode)?.label}</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[17rem] max-w-[calc(100vw-2rem)] max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1c1c1c] border-border/10 rounded-xl shadow-2xl p-1.5 text-foreground">
                                <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground mb-1">Conversation mode</div>
                                <div className="flex flex-col gap-0.5">
                                    {MODES.map(m => (
                                        <button
                                            key={m.id}
                                            className={cn("w-full flex flex-col items-start px-2.5 py-2 hover:bg-white/5 rounded-lg transition-colors text-left", aiMode === m.id && "bg-white/5")}
                                            onClick={() => { setAiMode(m.id); setShowModeMenu(false); }}
                                        >
                                            <span className="text-xs font-semibold mb-0.5">{m.label}</span>
                                            <span className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Model Selector */}
                        <DropdownMenu
                            open={showModelMenu}
                            onOpenChange={(open) => {
                                setShowModelMenu(open);
                                if (open) {
                                    setShowModeMenu(false);
                                    setShowRoutingMenu(false);
                                    setShowContextMenu(false);
                                }
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1 overflow-hidden">
                                    <ChevronUp className="w-3 h-3 opacity-50 shrink-0" />
                                    <span className="truncate">
                                        {MODELS.flatMap(g => g.items).find(m => m.id === aiModel)?.label ?? 'Select Model'}
                                    </span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-64 max-w-[calc(100vw-2rem)] max-h-[350px] overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1c1c1c] border-border/10 rounded-xl shadow-2xl p-1.5 text-foreground">
                                <div className="px-2.5 py-1.5 text-[10.5px] font-semibold text-muted-foreground mb-1">Select AI Model</div>
                                <div className="flex flex-col gap-0.5">
                                    {MODELS.map((group, gi) => (
                                        <React.Fragment key={group.group}>
                                            {gi > 0 && <div className="h-px bg-border/20 my-1" />}
                                            <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{group.group}</div>
                                            {group.items.map(m => (
                                                <button
                                                    key={m.id}
                                                    className="w-full flex items-center justify-between px-2.5 py-2 text-xs hover:bg-white/5 rounded-lg transition-colors text-left"
                                                    onClick={() => { setAiModel(m.id); setShowModelMenu(false); }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className={aiModel === m.id ? "font-semibold" : "font-medium"}>{m.label}</span>
                                                        {m.warning && <TriangleAlert className="w-3.5 h-3.5 text-yellow-500" />}
                                                    </div>
                                                    {m.isNew && <span className="bg-white/10 text-muted-foreground font-semibold text-[9px] px-2 py-0.5 rounded-full">New</span>}
                                                </button>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {isLoading ? (
                            <Button
                                size="icon"
                                className="h-7 w-7 rounded-full bg-red-500 hover:bg-red-600 shrink-0 text-white animate-pulse"
                                onClick={handleStop}
                                title="Dừng AI"
                            >
                                <Square className="w-3 h-3 fill-white" />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                className="h-7 w-7 rounded-full bg-blue-500 hover:bg-blue-600 shrink-0 text-white"
                                onClick={handleSend}
                                disabled={(!input.trim() && attachments.length === 0) || !activeConnection}
                                title="Gửi (Enter)"
                            >
                                <Send className="w-3.5 h-3.5 ml-0.5" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="px-3 pb-1">
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                        {aiRoutingMode === 'gemini-only'
                            ? 'Always uses your selected Gemini model.'
                            : <>Simple requests may use cheaper models first. <span className="text-foreground/80">Gemini is kept for harder tasks.</span></>}
                    </div>
                </div>
            </div>
        </div>
    );
});
