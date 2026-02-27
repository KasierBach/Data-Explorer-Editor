import React from 'react';
import { ExplorerSidebar } from "../Explorer/ExplorerSidebar"
import { MainContent } from "./MainContent"
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { AiAssistant } from '@/presentation/modules/Query/AiAssistant';
import { cn } from "@/lib/utils";
import { useResizablePanel } from '@/presentation/hooks/useResizablePanel';

export function AppShell() {
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
    const isAiPanelOpen = useAppStore(state => state.isAiPanelOpen);
    const setAiPanelOpen = useAppStore(state => state.setAiPanelOpen);

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

    // Sync external sidebar width changes (e.g. from store reset)
    React.useEffect(() => {
        if (!leftPanel.isDragging && sidebarWidth !== leftPanel.width && sidebarWidth > 0) {
            leftPanel.setWidth(sidebarWidth);
        }
    }, [sidebarWidth, leftPanel]);

    const anyDragging = leftPanel.isDragging || rightPanel.isDragging;

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden relative select-none">
                {/* Left Sidebar */}
                <aside
                    style={{ width: isSidebarOpen ? `${leftPanel.width}px` : '0px' }}
                    className={cn(
                        "h-full border-r bg-card relative flex-shrink-0 overflow-hidden",
                        !isSidebarOpen && "border-none",
                        leftPanel.isDragging ? "" : "transition-[width] duration-300 ease-in-out"
                    )}
                >
                    <div style={{ width: `${leftPanel.width}px` }} className="h-full">
                        <ExplorerSidebar />
                    </div>
                </aside>

                {/* Left Sidebar Resize Handle */}
                {isSidebarOpen && (
                    <div
                        onMouseDown={leftPanel.startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 transition-colors group",
                            "hover:bg-blue-500/20 active:bg-blue-500/40",
                            leftPanel.isDragging && "bg-blue-500/30"
                        )}
                        style={{ left: `${leftPanel.width - 6}px` }}
                    >
                        <div className={cn(
                            "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-border transition-colors",
                            "group-hover:bg-blue-500/50 group-active:bg-blue-500",
                            leftPanel.isDragging && "bg-blue-500"
                        )} />
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 h-full min-w-0 bg-background relative z-10">
                    <MainContent />
                    {anyDragging && <div className="absolute inset-0 z-20" />}
                </main>

                {/* AI Panel Resize Handle */}
                {isAiPanelOpen && (
                    <div
                        onMouseDown={rightPanel.startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 transition-colors group",
                            "hover:bg-violet-500/20 active:bg-violet-500/40",
                            rightPanel.isDragging && "bg-violet-500/30"
                        )}
                        style={{ right: `${rightPanel.width - 6}px` }}
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
                        "h-full border-l bg-card flex-shrink-0 overflow-hidden",
                        !isAiPanelOpen && "border-none",
                        rightPanel.isDragging ? "" : "transition-[width] duration-300 ease-in-out"
                    )}
                    style={{ width: isAiPanelOpen ? `${rightPanel.width}px` : '0px' }}
                >
                    <div style={{ width: `${rightPanel.width}px` }} className="h-full">
                        <AiAssistant
                            onInsertSql={(sql) => {
                                const store = useAppStore.getState();
                                const activeTab = store.tabs.find(t => t.id === store.activeTabId);
                                if (activeTab && activeTab.type === 'query') {
                                    store.updateTabMetadata(activeTab.id, { sql });
                                } else {
                                    store.openQueryTab();
                                    setTimeout(() => {
                                        const newTab = useAppStore.getState().tabs.find(t => t.id === useAppStore.getState().activeTabId);
                                        if (newTab) useAppStore.getState().updateTabMetadata(newTab.id, { sql });
                                    }, 100);
                                }
                            }}
                            onRunSql={(sql) => {
                                const store = useAppStore.getState();
                                const activeTab = store.tabs.find(t => t.id === store.activeTabId);
                                if (activeTab && activeTab.type === 'query') {
                                    store.updateTabMetadata(activeTab.id, { sql });
                                } else {
                                    store.openQueryTab();
                                    setTimeout(() => {
                                        const newTab = useAppStore.getState().tabs.find(t => t.id === useAppStore.getState().activeTabId);
                                        if (newTab) useAppStore.getState().updateTabMetadata(newTab.id, { sql });
                                    }, 100);
                                }
                            }}
                            onClose={() => setAiPanelOpen(false)}
                        />
                    </div>
                </aside>
            </div>

            <div className="h-6 border-t bg-muted/40 text-xs flex items-center px-4 text-muted-foreground shrink-0">
                Ready
            </div>
            <ConnectionDialog />
        </div>
    )
}
