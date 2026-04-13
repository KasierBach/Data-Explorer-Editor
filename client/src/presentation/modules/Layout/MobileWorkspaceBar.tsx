import React from 'react';
import { PanelLeftClose, PanelLeftOpen, Sparkles, MonitorSmartphone, Rows3 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileWorkspaceBarProps {
    sidebarOpen: boolean;
    aiOpen: boolean;
    desktopModeOnMobile: boolean;
    onToggleSidebar: () => void;
    onToggleAi: () => void;
    onToggleDesktopMode: () => void;
    onToggleResults?: () => void;
    resultsOpen?: boolean;
}

export const MobileWorkspaceBar: React.FC<MobileWorkspaceBarProps> = ({
    sidebarOpen,
    aiOpen,
    desktopModeOnMobile,
    onToggleSidebar,
    onToggleAi,
    onToggleDesktopMode,
    onToggleResults,
    resultsOpen,
}) => {
    return (
        <div className="h-12 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 px-2 flex items-center justify-between gap-2 shrink-0">
            <Button
                variant={sidebarOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-9 gap-1.5 text-xs"
                onClick={onToggleSidebar}
            >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                {sidebarOpen ? 'Hide' : 'Explorer'}
            </Button>

            {onToggleResults && (
                <Button
                    variant={resultsOpen ? 'secondary' : 'ghost'}
                    size="sm"
                    className="flex-1 h-9 gap-1.5 text-xs"
                    onClick={onToggleResults}
                >
                    <Rows3 className="w-4 h-4" />
                    {resultsOpen ? 'Hide' : 'Results'}
                </Button>
            )}

            <Button
                variant={desktopModeOnMobile ? 'secondary' : 'ghost'}
                size="sm"
                className={cn("h-9 gap-1.5 text-xs", onToggleResults ? "px-2" : "flex-1")}
                onClick={onToggleDesktopMode}
            >
                <MonitorSmartphone className="w-4 h-4" />
                {!onToggleResults && 'Desktop'}
            </Button>

            <Button
                variant={aiOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="flex-1 h-9 gap-1.5 text-xs"
                onClick={onToggleAi}
            >
                <Sparkles className="w-4 h-4" />
                {aiOpen ? 'Hide' : 'AI'}
            </Button>
        </div>
    );
};
