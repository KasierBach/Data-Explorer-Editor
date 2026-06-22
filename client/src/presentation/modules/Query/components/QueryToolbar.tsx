import React from 'react';
import {
    AlignLeft,
    ChevronDown,
    Eraser,
    FolderOpen,
    History,
    Layers,
    Loader2,
    Play,
    RefreshCw,
    Save,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/presentation/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/presentation/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/presentation/components/ui/select';
import { cn } from '@/lib/utils';
import { AiQueryBox } from './AiQueryBox';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface QueryToolbarProps {
    isLoading: boolean;
    isExplaining?: boolean;
    allowQueryExecution?: boolean;
    isCompactMobileLayout: boolean;
    isSmallMobile: boolean;
    lang: 'vi' | 'en';
    limit: string;
    activeConnectionId: string | null | undefined;
    activeDatabase?: string | null;
    rightSlot?: React.ReactNode;
    showSqlSequence?: boolean;
    onRun: () => void;
    onGenerateSql: (sql: string) => void;
    onRefreshSchema: () => void | Promise<void>;
    onFormat: () => void;
    onClear: () => void;
    onSave: () => void;
    onOpenSaved: () => void;
    onOpenHistory: () => void;
    onExplain: () => void;
    onOpenSqlSequence?: () => void;
    onLimitChange: (limit: string) => void;
}

export const QueryToolbar: React.FC<QueryToolbarProps> = ({
    isLoading,
    isExplaining = false,
    allowQueryExecution,
    isCompactMobileLayout,
    isSmallMobile,
    lang,
    limit,
    activeConnectionId,
    activeDatabase,
    rightSlot,
    showSqlSequence,
    onRun,
    onGenerateSql,
    onRefreshSchema,
    onFormat,
    onClear,
    onSave,
    onOpenSaved,
    onOpenHistory,
    onExplain,
    onOpenSqlSequence,
    onLimitChange,
}) => {
    const isExecutionDisabled = isLoading || allowQueryExecution === false;
    const text = getWorkspaceText(lang).queryToolbar;
    const explainLabel = text.explain;
    const runLabel = isCompactMobileLayout ? text.runCompact : text.runFull;

    return (
        <div className="p-1 px-1.5 border-b flex items-center justify-between gap-2 bg-muted/30 min-h-[40px] overflow-hidden flex-nowrap">
            <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-x-auto hide-scrollbar py-0.5 flex-nowrap">
                <Button
                    size="sm"
                    onClick={onRun}
                    disabled={isExecutionDisabled}
                    className={cn(
                        'h-8 gap-1.5 px-3 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm transition-all shrink-0',
                        isCompactMobileLayout && 'px-2'
                    )}
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    <span className="font-bold">
                        {runLabel}
                    </span>
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1 shrink-0" />

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 px-3 shrink-0 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 transition-all shadow-none"
                        >
                            <Sparkles className="w-3.5 h-3.5 fill-blue-500/20" />
                            <span className="font-medium">{isSmallMobile ? text.aiShort : text.aiSql}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[min(450px,calc(100vw-1rem))] p-0 border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden"
                        align="start"
                        side="bottom"
                        sideOffset={8}
                        collisionPadding={12}
                    >
                        <AiQueryBox
                            currentConnectionId={activeConnectionId || ''}
                            currentDatabase={activeDatabase || undefined}
                            onGenerate={onGenerateSql}
                        />
                    </PopoverContent>
                </Popover>

                {showSqlSequence && onOpenSqlSequence && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenSqlSequence}
                        className="h-8 gap-1.5 px-3 shrink-0 border-border/60 bg-background/80 shadow-none"
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span className="font-medium">{isSmallMobile ? 'SQL' : text.sqlSequence}</span>
                    </Button>
                )}

                {!isCompactMobileLayout && (
                    <>
                        <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />
                        <Button variant="ghost" size="sm" onClick={onRefreshSchema} className="h-7 gap-1 px-1.5 text-xs shrink-0" title={text.refreshSidebar}>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.refresh}</span>
                        </Button>
                        <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />
                    </>
                )}

                {!isCompactMobileLayout ? (
                    <>
                        <Button variant="ghost" size="sm" onClick={onFormat} className="h-7 gap-1 px-1.5 text-xs shrink-0">
                            <AlignLeft className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.format}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 gap-1 px-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0">
                            <Eraser className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.clear}</span>
                        </Button>
                        <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />
                        <Button variant="ghost" size="sm" onClick={onSave} className="h-7 gap-1 px-1.5 text-xs shrink-0" title="Ctrl+S">
                            <Save className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.save}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onOpenSaved} className="h-7 gap-1 px-1.5 text-xs shrink-0" title="Ctrl+O">
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.open}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onOpenHistory} className="h-7 gap-1 px-1.5 text-xs shrink-0" title="Ctrl+H">
                            <History className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">{text.history}</span>
                        </Button>
                        <div className="h-4 w-[1px] bg-border mx-0.5 shrink-0" />
                        <Button variant="ghost" size="sm" onClick={onExplain} disabled={isExplaining || !activeConnectionId} className="h-7 gap-1 px-1.5 text-xs text-orange-500 hover:text-orange-600 shrink-0" title={explainLabel}>
                            {isExplaining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            <span className="whitespace-nowrap">{explainLabel}</span>
                        </Button>
                    </>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs shrink-0">
                                <History className="w-4 h-4" />
                                {text.actions}
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={onFormat}>
                                <AlignLeft className="mr-2 h-4 w-4" />
                                <span>{text.formatSql}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onSave}>
                                <Save className="mr-2 h-4 w-4" />
                                <span>{text.saveQuery}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onOpenSaved}>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                <span>{text.openSaved}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onOpenHistory}>
                                <History className="mr-2 h-4 w-4" />
                                <span>{text.history}</span>
                            </DropdownMenuItem>
                            {showSqlSequence && onOpenSqlSequence && (
                                <DropdownMenuItem onClick={onOpenSqlSequence}>
                                    <Layers className="mr-2 h-4 w-4" />
                                    <span>{text.sqlSequence}</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onExplain} className="text-orange-500" disabled={isExplaining || !activeConnectionId}>
                                {isExplaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                <span>{explainLabel}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onClear} className="text-red-600">
                                <Eraser className="mr-2 h-4 w-4" />
                                <span>{text.clearAll}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                <div className="flex items-center gap-1 px-1 shrink-0">
                    {!isCompactMobileLayout && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{text.limit}</span>}
                    <Select value={limit} onValueChange={onLimitChange}>
                        <SelectTrigger className="h-7 w-[80px] text-[10px] py-0 border-none bg-muted hover:bg-muted/80 focus:ring-0 shadow-none shrink-0">
                            <SelectValue placeholder={text.limit} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                            <SelectItem value="5000">5000</SelectItem>
                            <SelectItem value="all">{text.max50k}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {rightSlot && (
                <div className="flex items-center gap-3 min-w-0 shrink-0">
                    {rightSlot}
                </div>
            )}
        </div>
    );
};
