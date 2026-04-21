import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Play, Loader2, Eraser, AlignLeft, Save, FolderOpen, History, Zap, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";

interface QueryToolbarProps {
    isLoading: boolean;
    isCompactMobileLayout: boolean;
    isSmallMobile: boolean;
    limit: string;
    activeConnectionName?: string;
    // blockedReason and hasPersistentGuardrail removed as unused
    onExecute: () => void;
    onClear: () => void;
    onFormat: () => void;
    onSave: () => void;
    onOpenSaved: () => void;
    onOpenHistory: () => void;
    onExplain: () => void;
    onLimitChange: (limit: string) => void;
    lang: string;
    allowQueryExecution?: boolean;
}

export const QueryToolbar: React.FC<QueryToolbarProps> = ({
    isLoading,
    isCompactMobileLayout,
    isSmallMobile,
    limit,
    activeConnectionName,
    onExecute,
    onClear,
    onFormat,
    onSave,
    onOpenSaved,
    onOpenHistory,
    onExplain,
    onLimitChange,
    lang,
    allowQueryExecution,
}) => {
    const isExecutionDisabled = isLoading || allowQueryExecution === false;

    if (!isCompactMobileLayout) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
                <Button
                    variant="default"
                    size="sm"
                    onClick={onExecute}
                    disabled={isExecutionDisabled}
                    className="h-7 gap-1.5 px-3"
                >
                    {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Play className="w-3.5 h-3.5" />
                    )}
                    {lang === 'vi' ? 'Chạy' : 'Run'}
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={onFormat} className="h-7 gap-1 px-2 text-xs">
                    <AlignLeft className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Định dạng' : 'Format'}
                </Button>
                <Button variant="ghost" size="sm" onClick={onClear} className="h-7 gap-1 px-2 text-xs">
                    <Eraser className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Xóa' : 'Clear'}
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={onSave} className="h-7 gap-1 px-2 text-xs" title="Ctrl+S">
                    <Save className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Lưu' : 'Save'}
                </Button>
                <Button variant="ghost" size="sm" onClick={onOpenSaved} className="h-7 gap-1 px-2 text-xs" title="Ctrl+O">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Mở' : 'Open'}
                </Button>
                <Button variant="ghost" size="sm" onClick={onOpenHistory} className="h-7 gap-1 px-2 text-xs" title="Ctrl+H">
                    <History className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Lịch sử' : 'History'}
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExplain}
                    disabled={isExecutionDisabled}
                    className="h-7 gap-1 px-2 text-xs text-orange-500 hover:text-orange-600"
                    title="EXPLAIN ANALYZE"
                >
                    <Zap className="w-3.5 h-3.5" />
                    {lang === 'vi' ? 'Giải thích' : 'Explain'}
                </Button>

                <div className="flex items-center gap-1.5 px-2">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {lang === 'vi' ? 'Giới hạn' : 'Limit'}
                    </span>
                    <Select value={limit} onValueChange={onLimitChange}>
                        <SelectTrigger className="h-7 w-[80px] text-[10px] py-0 border-none bg-muted hover:bg-muted/80 focus:ring-0 shadow-none">
                            <SelectValue placeholder={lang === 'vi' ? 'Giới hạn' : 'Limit'} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="100">100</SelectItem>
                            <SelectItem value="500">500</SelectItem>
                            <SelectItem value="1000">1000</SelectItem>
                            <SelectItem value="5000">5000</SelectItem>
                            <SelectItem value="all">{lang === 'vi' ? 'Không' : 'No Limit'}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {activeConnectionName && !isSmallMobile && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-100 dark:border-blue-900/50 min-w-0 ml-auto">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400 truncate max-w-[150px]">
                            {activeConnectionName}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
            <Button
                variant="default"
                size="sm"
                onClick={onExecute}
                disabled={isExecutionDisabled}
                className="h-8 gap-1.5 px-3"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Play className="w-4 h-4" />
                )}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                        <History className="w-4 h-4" />
                        {lang === 'vi' ? 'Hành động' : 'Actions'}
                        <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem onClick={onFormat}>
                        <AlignLeft className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Định dạng SQL' : 'Format SQL'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onSave}>
                        <Save className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Lưu truy vấn' : 'Save Query'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenSaved}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Mở đã lưu' : 'Open Saved'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenHistory}>
                        <History className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Lịch sử' : 'History'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onExplain} className="text-orange-500" disabled={allowQueryExecution === false}>
                        <Zap className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Giải thích thực thi' : 'Explain Plan'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onClear} className="text-red-600">
                        <Eraser className="mr-2 h-4 w-4" />
                        <span>{lang === 'vi' ? 'Xóa tất cả' : 'Clear All'}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1.5 px-2">
                <Select value={limit} onValueChange={onLimitChange}>
                    <SelectTrigger className="h-7 w-[80px] text-[10px] py-0 border-none bg-muted hover:bg-muted/80 focus:ring-0 shadow-none">
                        <SelectValue placeholder={lang === 'vi' ? 'Giới hạn' : 'Limit'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                        <SelectItem value="5000">5000</SelectItem>
                        <SelectItem value="all">{lang === 'vi' ? 'Không' : 'No Limit'}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
};
