import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { X, Database, ChevronDown, GripVertical } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { Button } from '@/presentation/components/ui/button';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';

/** Translates default tab titles to the active language. */
function getTabDisplayTitle(tab: { type: string; title: string }, lang: string): string {
    if (tab.type === 'query' && /^Query \d+$/.test(tab.title)) {
        return lang === 'vi' ? `Truy vấn ${tab.title.split(' ')[1]}` : tab.title;
    }
    // Legacy support for old "New Query" tabs
    if (tab.type === 'query' && tab.title === 'New Query') {
        return lang === 'vi' ? 'Truy vấn mới' : 'New Query';
    }
    if (tab.type === 'visualize' && tab.title === 'Visualizer Hub') {
        return lang === 'vi' ? 'Trạm trực quan' : 'Visualizer Hub';
    }
    return tab.title;
}

export const TabsBar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs, lang } = useAppStore();
    const { isCompactMobileLayout } = useResponsiveLayoutMode();

    // ── Drag & Drop State ──
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    const dragNodeRef = useRef<HTMLDivElement | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        // Make the drag ghost slightly transparent
        if (e.currentTarget) {
            dragNodeRef.current = e.currentTarget;
            requestAnimationFrame(() => {
                if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.4';
            });
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
        setDragIndex(null);
        setDropTargetIndex(null);
        dragNodeRef.current = null;
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTargetIndex(index);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
        e.preventDefault();
        const fromIndex = dragIndex;
        if (fromIndex !== null && fromIndex !== toIndex) {
            reorderTabs(fromIndex, toIndex);
        }
        handleDragEnd();
    }, [dragIndex, reorderTabs, handleDragEnd]);

    if (tabs.length === 0) return null;

    return (
        <div className="flex items-center border-b bg-muted/20 h-9 shrink-0">
            <div className="flex-1 flex items-center overflow-x-auto hide-scrollbar scroll-smooth">
                {tabs.map((tab, index) => (
                    <div
                        key={tab.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={cn(
                            "group flex items-center gap-1.5 px-3 h-full border-r text-sm cursor-pointer select-none transition-all duration-200",
                            isCompactMobileLayout ? "min-w-[100px] max-w-[150px]" : "min-w-[120px] max-w-[200px]",
                            activeTabId === tab.id
                                ? "bg-background font-medium border-b-2 border-b-primary shadow-sm"
                                : "hover:bg-muted/50 text-muted-foreground border-b border-b-transparent",
                            dragIndex === index && "opacity-40",
                            dropTargetIndex === index && dragIndex !== index && "border-l-2 border-l-primary"
                        )}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {/* Drag Handle */}
                        <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />

                        <Database className="w-3 h-3 text-blue-500 opacity-70 shrink-0" />

                        <span className="truncate flex-1">
                            {getTabDisplayTitle(tab, lang)}
                        </span>

                        <button
                            className={cn(
                                "p-0.5 hover:bg-muted rounded text-muted-foreground transition-opacity",
                                activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.id);
                            }}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-full w-9 border-l rounded-none hover:bg-muted/50">
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
                    {tabs.map(tab => (
                        <DropdownMenuItem
                            key={`menu-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(activeTabId === tab.id && "bg-muted font-medium")}
                        >
                            <Database className="w-3.5 h-3.5 mr-2 text-blue-500" />
                            <span className="truncate flex-1">
                                {getTabDisplayTitle(tab, lang)}
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
