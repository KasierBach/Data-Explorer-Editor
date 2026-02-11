import React from 'react';
import { useAppStore } from '@/core/services/store';
import { cn } from '@/lib/utils';
import { X, Database } from 'lucide-react';

export const TabsBar: React.FC = () => {
    const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore();

    if (tabs.length === 0) return null;

    return (
        <div className="flex items-center overflow-x-auto border-b bg-muted/20 hide-scrollbar h-9">
            {tabs.map(tab => (
                <div
                    key={tab.id}
                    className={cn(
                        "group flex items-center gap-2 px-3 h-full border-r text-sm cursor-pointer select-none transition-colors min-w-[120px] max-w-[200px]",
                        activeTabId === tab.id
                            ? "bg-background font-medium border-b-2 border-b-primary"
                            : "hover:bg-muted/50 text-muted-foreground border-b border-b-transparent"
                    )}
                    onClick={() => setActiveTab(tab.id)}
                >
                    <Database className="w-3 h-3 text-blue-500 opacity-70" />
                    <span className="truncate flex-1">{tab.title}</span>
                    <button
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground"
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
    );
};
