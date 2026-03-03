import React from 'react';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { X, Database, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { Button } from '@/presentation/components/ui/button';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';

export const TabsBar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();
    const isMobile = useMediaQuery('(max-width: 768px)');

    if (tabs.length === 0) return null;

    return (
        <div className="flex items-center border-b bg-muted/20 h-9 shrink-0">
            <div className="flex-1 flex items-center overflow-x-auto hide-scrollbar scroll-smooth">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={cn(
                            "group flex items-center gap-2 px-3 h-full border-r text-sm cursor-pointer select-none transition-colors",
                            isMobile ? "min-w-[100px] max-w-[150px]" : "min-w-[120px] max-w-[200px]",
                            activeTabId === tab.id
                                ? "bg-background font-medium border-b-2 border-b-primary shadow-sm"
                                : "hover:bg-muted/50 text-muted-foreground border-b border-b-transparent"
                        )}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <Database className="w-3 h-3 text-blue-500 opacity-70 shrink-0" />
                        <span className="truncate flex-1">{tab.title}</span>
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
                            <span className="truncate flex-1">{tab.title}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
