import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/core/services/store';

/**
 * Hook to handle global keyboard shortcuts and prevent browser default actions
 */
export function useGlobalShortcuts() {
    const { 
        openQueryTab, 
        openTab, 
        closeAllTabs, 
        toggleResultPanel, 
        toggleSidebar,
        toggleAiPanel
    } = useAppStore();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const isMod = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        const code = e.code;

        // 1. New Query (Ctrl+N) - Prevents New Window
        if (isMod && !isShift && code === 'KeyN') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openQueryTab();
            return;
        }

        // 2. AI Assistant (Ctrl+I) - Quick AI access
        if (isMod && !isShift && code === 'KeyI') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleAiPanel();
            return;
        }

        // 3. Duplicate Tab (Ctrl+D) - Prevents Bookmark
        if (isMod && !isShift && code === 'KeyD') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const state = useAppStore.getState();
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (activeTab) {
                openTab({
                    ...activeTab,
                    id: `tab-${Date.now()}`,
                    title: `${activeTab.title} (Copy)`,
                });
            }
            return;
        }

        // 4. Close All Tabs (Ctrl+Shift+W) - Prevents Close Window
        if (isMod && isShift && code === 'KeyW') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            closeAllTabs();
            return;
        }

        // 5. Toggle Result Panel (Ctrl+J) - Prevents Downloads
        if (isMod && !isShift && code === 'KeyJ') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleResultPanel();
            return;
        }

        // 6. Toggle Sidebar (Ctrl+B) - Standard layout action
        if (isMod && !isShift && code === 'KeyB') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleSidebar();
            return;
        }

        // 7. Save (Ctrl+S) - Context aware (prevents browser save)
        if (isMod && !isShift && code === 'KeyS') {
            const state = useAppStore.getState();
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (activeTab && activeTab.type === 'query') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }
    }, [openQueryTab, openTab, closeAllTabs, toggleResultPanel, toggleSidebar, toggleAiPanel]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [handleKeyDown]);
}
