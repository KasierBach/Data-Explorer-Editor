import React, { useState, useCallback, useEffect } from 'react';
import { ExplorerSidebar } from "../Explorer/ExplorerSidebar"
import { MainContent } from "./MainContent"
import { useAppStore } from "@/core/services/store"
import { Navbar } from './Navbar';
import { ConnectionDialog } from '@/presentation/modules/Connection/ConnectionDialog';
import { cn } from "@/lib/utils";

export function AppShell() {
    const isSidebarOpen = useAppStore(state => state.isSidebarOpen);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);

    // Internal state for dragging
    const [isDragging, setIsDragging] = useState(false);

    // Migration logic: If stored width is too small (from old percentage system or error), 
    // force it to a healthy pixel value (300px)
    const initialWidth = (sidebarWidth && sidebarWidth > 100) ? sidebarWidth : 300;
    const [currentWidth, setCurrentWidth] = useState(initialWidth);

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
            // Keep within healthy bounds (min 250px, max 40% of screen)
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

    // Save width to store when dragging stops
    useEffect(() => {
        if (!isDragging && currentWidth !== sidebarWidth) {
            setSidebarWidth(currentWidth);
        }
    }, [isDragging, currentWidth, setSidebarWidth, sidebarWidth]);

    return (
        <div className="h-screen w-full bg-background overflow-hidden flex flex-col">
            <Navbar />

            <div className="flex-1 flex overflow-hidden relative select-none">
                {/* Sidebar */}
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

                {/* Manual Resize Handle - Wider hit area for better UX */}
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
                        {/* The visual line */}
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
                    {/* Overlay to prevent iframe/editor from stealing mouse events during drag */}
                    {isDragging && <div className="absolute inset-0 z-20" />}
                </main>
            </div>

            <div className="h-6 border-t bg-muted/40 text-xs flex items-center px-4 text-muted-foreground shrink-0">
                Ready
            </div>
            <ConnectionDialog />
        </div>
    )
}
