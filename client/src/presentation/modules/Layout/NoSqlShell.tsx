import React from 'react';
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { cn } from "@/lib/utils";
import { useResizablePanel } from '@/presentation/hooks/useResizablePanel';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { useGlobalShortcuts } from '@/presentation/hooks/useGlobalShortcuts';
import { NoSqlSidebar } from '../NoSqlExplorer/NoSqlSidebar';
import { NoSqlMainContent } from '../NoSqlExplorer/NoSqlMainContent';

export function NoSqlShell() {
    useGlobalShortcuts();
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
    const setSidebarOpen = useAppStore(state => state.setSidebarOpen);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
    const lang = useAppStore(state => state.lang);

    const isMobile = useMediaQuery('(max-width: 768px)');

    // Left sidebar drag state
    const leftPanel = useResizablePanel({
        initialWidth: (sidebarWidth && sidebarWidth > 100) ? sidebarWidth : 300,
        minWidth: 250,
        maxWidth: 0.45, // 45vw
        direction: 'left',
        onWidthChange: setSidebarWidth
    });

    React.useEffect(() => {
        if (!leftPanel.isDragging && sidebarWidth !== leftPanel.width && sidebarWidth > 0) {
            leftPanel.setWidth(sidebarWidth);
        }
    }, [sidebarWidth]);

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden relative select-none">
                {/* Mobile Backdrop - Left Sidebar */}
                {isMobile && isSidebarOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Left Sidebar */}
                <aside
                    style={{
                        width: isSidebarOpen ? (isMobile ? '85vw' : `${leftPanel.width}px`) : '0px',
                        zIndex: isMobile ? 50 : 10
                    }}
                    className={cn(
                        "h-full border-r bg-card flex-shrink-0 overflow-hidden",
                        isMobile ? "absolute left-0 shadow-2xl" : "relative",
                        !isSidebarOpen && "border-none",
                        leftPanel.isDragging ? "" : "transition-[width,transform] duration-300 ease-in-out",
                        isMobile && !isSidebarOpen && "-translate-x-full"
                    )}
                >
                    <div style={{ width: isMobile ? '85vw' : `${leftPanel.width}px` }} className="h-full">
                         <NoSqlSidebar />
                    </div>
                </aside>

                {/* Left Sidebar Resize Handle */}
                {isSidebarOpen && !isMobile && (
                    <div
                        onMouseDown={leftPanel.startResizing}
                        className={cn(
                            "absolute top-0 bottom-0 w-3 cursor-col-resize z-50 transition-colors group",
                            "hover:bg-green-500/20 active:bg-green-500/40",
                            leftPanel.isDragging && "bg-green-500/30"
                        )}
                        style={{ left: `${leftPanel.width - 6}px` }}
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
                </main>
            </div>

            <div className="h-6 border-t bg-green-500/10 text-xs flex items-center px-4 text-green-600 dark:text-green-400 shrink-0 font-medium">
                {lang === 'vi' ? 'Không gian NoSQL Độc lập' : 'Isolated NoSQL Workspace'}
            </div>
            <ConnectionDialog />
        </div>
    )
}
