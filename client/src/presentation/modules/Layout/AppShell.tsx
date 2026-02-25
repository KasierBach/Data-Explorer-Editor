import React, { useState, useCallback, useEffect } from 'react';
import { ExplorerSidebar } from "../Explorer/ExplorerSidebar"
import { MainContent } from "./MainContent"
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { AiAssistant } from '@/presentation/modules/Query/AiAssistant';
import { cn } from "@/lib/utils";

export function AppShell() {
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
    const isAiPanelOpen = useAppStore(state => state.isAiPanelOpen);
    const setAiPanelOpen = useAppStore(state => state.setAiPanelOpen);

    // Left sidebar drag state
    const [isDragging, setIsDragging] = useState(false);
    const initialWidth = (sidebarWidth && sidebarWidth > 100) ? sidebarWidth : 300;
    const [currentWidth, setCurrentWidth] = useState(initialWidth);

    // Right AI panel drag state
    const [isAiDragging, setIsAiDragging] = useState(false);
    const [aiPanelWidth, setAiPanelWidth] = useState(380);

    // --- Left sidebar resize ---
    const startResizing = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
    }, []);

    const stopResizing = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = 'default';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isDragging) {
            const newWidth = Math.max(250, Math.min(e.clientX, window.innerWidth * 0.45));
            setCurrentWidth(newWidth);
        }
    }, [isDragging]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isDragging, resize, stopResizing]);

    useEffect(() => {
        if (!isDragging && currentWidth !== sidebarWidth) {
            setSidebarWidth(currentWidth);
        }
    }, [isDragging, currentWidth, setSidebarWidth, sidebarWidth]);

    // --- Right AI panel resize ---
    const startAiResizing = useCallback((e: React.MouseEvent) => {
        setIsAiDragging(true);
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
    }, []);

    const stopAiResizing = useCallback(() => {
        setIsAiDragging(false);
        document.body.style.cursor = 'default';
    }, []);

    const resizeAi = useCallback((e: MouseEvent) => {
        if (isAiDragging) {
            const newWidth = Math.max(300, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.5));
            setAiPanelWidth(newWidth);
        }
    }, [isAiDragging]);

    useEffect(() => {
        if (isAiDragging) {
            window.addEventListener('mousemove', resizeAi);
            window.addEventListener('mouseup', stopAiResizing);
        } else {
            window.removeEventListener('mousemove', resizeAi);
            window.removeEventListener('mouseup', stopAiResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resizeAi);
            window.removeEventListener('mouseup', stopAiResizing);
        };
    }, [isAiDragging, resizeAi, stopAiResizing]);

    const anyDragging = isDragging || isAiDragging;

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden relative select-none">
                {/* Left Sidebar */}
                <aside
                    style={{ width: isSidebarOpen ? `${currentWidth}px` : '0px' }}
                    className={cn(
                        "h-full border-r bg-card relative flex-shrink-0 overflow-hidden",
                        !isSidebarOpen && "border-none",
                        isDragging ? "" : "transition-[width] duration-300 ease-in-out"
                    )}
                >
                    <div style={{ width: `${currentWidth}px` }} className="h-full">
                        <ExplorerSidebar />
                    </div>
                </aside>

                {/* Left Sidebar Resize Handle */}
                {isSidebarOpen && (
                    <div
                        onMouseDown={startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 transition-colors group",
                            "hover:bg-blue-500/20 active:bg-blue-500/40",
                            isDragging && "bg-blue-500/30"
                        )}
                        style={{ left: `${currentWidth - 6}px` }}
                    >
                        <div className={cn(
                            "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-border transition-colors",
                            "group-hover:bg-blue-500/50 group-active:bg-blue-500",
                            isDragging && "bg-blue-500"
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
                        onMouseDown={startAiResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 transition-colors group",
                            "hover:bg-violet-500/20 active:bg-violet-500/40",
                            isAiDragging && "bg-violet-500/30"
                        )}
                        style={{ right: `${aiPanelWidth - 6}px` }}
                    >
                        <div className={cn(
                            "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-border transition-colors",
                            "group-hover:bg-violet-500/50 group-active:bg-violet-500",
                            isAiDragging && "bg-violet-500"
                        )} />
                    </div>
                )}

                {/* AI Chat Panel — Global Right Sidebar */}
                <aside
                    className={cn(
                        "h-full border-l bg-card flex-shrink-0 overflow-hidden",
                        !isAiPanelOpen && "border-none",
                        isAiDragging ? "" : "transition-[width] duration-300 ease-in-out"
                    )}
                    style={{ width: isAiPanelOpen ? `${aiPanelWidth}px` : '0px' }}
                >
                    <div style={{ width: `${aiPanelWidth}px` }} className="h-full">
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
