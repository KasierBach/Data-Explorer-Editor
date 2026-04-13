import React from 'react';
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { cn } from "@/lib/utils";
import { useResizablePanel } from '@/presentation/hooks/useResizablePanel';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { useGlobalShortcuts } from '@/presentation/hooks/useGlobalShortcuts';
import { NoSqlSidebar } from '../NoSqlExplorer/NoSqlSidebar';
import { NoSqlMainContent } from '../NoSqlExplorer/NoSqlMainContent';
import { AiAssistant } from '@/presentation/modules/Query/AiAssistant';
import { MobileWorkspaceBar } from './MobileWorkspaceBar';

export function NoSqlShell() {
    useGlobalShortcuts();
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
    const isAiPanelOpen = useAppStore(state => state.isAiPanelOpen);
    const setAiPanelOpen = useAppStore(state => state.setAiPanelOpen);
    const isDesktopModeOnMobile = useAppStore(state => state.isDesktopModeOnMobile);
    const toggleDesktopModeOnMobile = useAppStore(state => state.toggleDesktopModeOnMobile);
    const lang = useAppStore(state => state.lang);

    const { isActualMobile, isCompactMobileLayout, isSmallMobile, isLandscapeMobile } = useResponsiveLayoutMode();

    const handleToggleSidebar = React.useCallback(() => {
        if (isCompactMobileLayout && !isSidebarOpen) {
            setAiPanelOpen(false);
        }
        setSidebarOpen(!isSidebarOpen);
    }, [isCompactMobileLayout, isSidebarOpen, setAiPanelOpen, setSidebarOpen]);

    const handleToggleAiPanel = React.useCallback(() => {
        if (isCompactMobileLayout && !isAiPanelOpen) {
            setSidebarOpen(false);
        }
        setAiPanelOpen(!isAiPanelOpen);
    }, [isAiPanelOpen, isCompactMobileLayout, setAiPanelOpen, setSidebarOpen]);

    // Left sidebar drag state
    const leftPanel = useResizablePanel({
        initialWidth: (sidebarWidth && sidebarWidth > 100) ? sidebarWidth : 300,
        minWidth: 250,
        maxWidth: 0.45, // 45vw
        direction: 'left',
        onWidthChange: setSidebarWidth
    });

    // Right AI panel drag state
    const rightPanel = useResizablePanel({
        initialWidth: 380,
        minWidth: 300,
        maxWidth: 0.5, // 50vw
        direction: 'right'
    });

    React.useEffect(() => {
        if (!leftPanel.isDragging && sidebarWidth !== leftPanel.width && sidebarWidth > 0) {
            leftPanel.setWidth(sidebarWidth);
        }
    }, [sidebarWidth]);

    React.useEffect(() => {
        if (!isCompactMobileLayout) return;
        const targetSidebarWidth = Math.round(window.innerWidth * (isSmallMobile ? 1 : isLandscapeMobile ? 0.76 : 0.9));
        const targetAiWidth = Math.round(window.innerWidth * (isSmallMobile ? 1 : isLandscapeMobile ? 0.78 : 0.92));

        if (!leftPanel.isDragging) {
            leftPanel.setWidth(Math.max(280, targetSidebarWidth));
        }
        if (!rightPanel.isDragging) {
            rightPanel.setWidth(Math.max(300, targetAiWidth));
        }
    }, [isCompactMobileLayout, isLandscapeMobile, isSmallMobile, leftPanel, rightPanel]);

    const anyDragging = leftPanel.isDragging || rightPanel.isDragging;

    return (
        <div className="h-dvh w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden relative select-none">
                {/* Mobile Backdrop - Left Sidebar */}
                {isCompactMobileLayout && isSidebarOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar */}
                <aside
                    style={{
                        width: isSidebarOpen ? `${leftPanel.width}px` : '0px',
                        zIndex: isCompactMobileLayout ? 50 : 10
                    }}
                    className={cn(
                        "h-full border-r bg-card flex-shrink-0 overflow-hidden",
                        isCompactMobileLayout ? "absolute left-0 shadow-2xl" : "relative",
                        !isSidebarOpen && "border-none",
                        leftPanel.isDragging ? "" : "transition-[width,transform] duration-300 ease-in-out",
                        isCompactMobileLayout && !isSidebarOpen && "-translate-x-full"
                    )}
                >
                    <div style={{ width: `${leftPanel.width}px` }} className="h-full">
                         <NoSqlSidebar />
                    </div>
                </aside>

                {isSidebarOpen && (
                    <div
                        onPointerDown={leftPanel.startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 cursor-col-resize z-50 transition-colors group touch-none",
                            "hover:bg-green-500/20 active:bg-green-500/40",
                            leftPanel.isDragging && "bg-green-500/30",
                            isCompactMobileLayout ? "w-5" : "w-3"
                        )}
                        style={{ left: `${leftPanel.width - (isCompactMobileLayout ? 10 : 6)}px` }}
                    >
                        <div className={cn(
                            "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-border transition-colors",
                            "group-hover:bg-green-500/50 group-active:bg-green-500",
                            leftPanel.isDragging && "bg-green-500"
                        )} />
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 h-full min-w-0 bg-background relative z-10 border-t border-muted">
                     <NoSqlMainContent />
                     {anyDragging && <div className="absolute inset-0 z-20" />}
                </main>

                {/* Mobile Backdrop - AI Panel */}
                {isCompactMobileLayout && isAiPanelOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
                        onClick={() => setAiPanelOpen(false)}
                    />
                )}

                {isAiPanelOpen && (
                    <div
                        onPointerDown={rightPanel.startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 cursor-col-resize z-50 transition-colors group touch-none",
                            "hover:bg-violet-500/20 active:bg-violet-500/40",
                            rightPanel.isDragging && "bg-violet-500/30",
                            isCompactMobileLayout ? "w-5" : "w-3"
                        )}
                        style={{ right: `${rightPanel.width - (isCompactMobileLayout ? 10 : 6)}px` }}
                    >
                        <div className={cn(
                            "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-border transition-colors",
                            "group-hover:bg-violet-500/50 group-active:bg-violet-500",
                            rightPanel.isDragging && "bg-violet-500"
                        )} />
                    </div>
                )}

                {/* AI Chat Panel — Global Right Sidebar */}
                <aside
                    className={cn(
                        "h-full border-l bg-card flex-shrink-0 overflow-hidden border-t border-muted",
                        isCompactMobileLayout ? "absolute right-0 shadow-2xl" : "relative",
                        !isAiPanelOpen && "border-none",
                        rightPanel.isDragging ? "" : "transition-[width,transform] duration-300 ease-in-out",
                        isCompactMobileLayout && !isAiPanelOpen && "translate-x-full",
                        isCompactMobileLayout ? "z-50" : "z-10"
                    )}
                    style={{
                        width: isAiPanelOpen ? `${rightPanel.width}px` : '0px'
                    }}
                >
                    <div style={{ width: `${rightPanel.width}px` }} className="h-full">
                        <AiAssistant
                            onInsertQuery={(sql) => {
                                const store = useAppStore.getState();
                                store.setNosqlMqlQuery(sql);
                                if (store.nosqlViewMode === 'grid') store.setNosqlViewMode('tree');
                            }}
                            onRunQuery={(sql) => {
                                const store = useAppStore.getState();
                                store.setNosqlMqlQuery(sql);
                            }}
                            onClose={() => setAiPanelOpen(false)}
                        />
                    </div>
                </aside>
            </div>

            {isActualMobile && (
                <MobileWorkspaceBar
                    sidebarOpen={isSidebarOpen}
                    aiOpen={isAiPanelOpen}
                    desktopModeOnMobile={isDesktopModeOnMobile}
                    onToggleSidebar={handleToggleSidebar}
                    onToggleAi={handleToggleAiPanel}
                    onToggleDesktopMode={toggleDesktopModeOnMobile}
                />
            )}

            <div className="h-6 border-t bg-green-500/10 text-xs flex items-center px-4 text-green-600 dark:text-green-400 shrink-0 font-medium">
                {lang === 'vi' ? 'Không gian NoSQL Độc lập' : 'Isolated NoSQL Workspace'}
            </div>
            <ConnectionDialog />
        </div>
    )
}
