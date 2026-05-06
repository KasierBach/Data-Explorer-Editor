import type { StateCreator } from 'zustand';

export interface UISlice {
    isSidebarOpen: boolean;
    sidebarWidth: number;
    isDesktopModeOnMobile: boolean;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setSidebarWidth: (width: number) => void;
    toggleDesktopModeOnMobile: () => void;
    setDesktopModeOnMobile: (enabled: boolean) => void;
    isAiPanelOpen: boolean;
    toggleAiPanel: () => void;
    setAiPanelOpen: (isOpen: boolean) => void;
    expandedNodes: string[];
    toggleNodeExpansion: (nodeId: string) => void;
    pageStates: Record<string, any>;
    setPageState: (pageId: string, pageState: any) => void;
    lang: 'vi' | 'en';
    setLang: (lang: 'vi' | 'en') => void;
    isResultPanelOpen: boolean;
    toggleResultPanel: () => void;
    explorerSearchMode: 'local' | 'global';
    setExplorerSearchMode: (mode: 'local' | 'global') => void;
    isCommandPaletteOpen: boolean;
    toggleCommandPalette: () => void;
    setCommandPaletteOpen: (isOpen: boolean) => void;
    defaultResultHeight: number;
    setDefaultResultHeight: (height: number) => void;
    destructiveConfirm: { isOpen: boolean; analysis: any; resolve: ((val: boolean) => void) | null } | null;
    requestDestructiveConfirm: (analysis: any) => Promise<boolean>;
    closeDestructiveConfirm: (confirmed: boolean) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
    isSidebarOpen: true,
    sidebarWidth: 20,
    isDesktopModeOnMobile: false,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
    toggleDesktopModeOnMobile: () => set((state) => ({ isDesktopModeOnMobile: !state.isDesktopModeOnMobile })),
    setDesktopModeOnMobile: (enabled) => set({ isDesktopModeOnMobile: enabled }),
    isAiPanelOpen: false,
    toggleAiPanel: () => set((state) => ({ isAiPanelOpen: !state.isAiPanelOpen })),
    setAiPanelOpen: (isOpen) => set({ isAiPanelOpen: isOpen }),
    expandedNodes: [],
    toggleNodeExpansion: (nodeId) => set((state) => ({
        expandedNodes: state.expandedNodes.includes(nodeId)
            ? state.expandedNodes.filter(id => id !== nodeId)
            : [...state.expandedNodes, nodeId]
    })),
    pageStates: {},
    setPageState: (pageId, pageState) => set((state) => ({
        pageStates: {
            ...state.pageStates,
            [pageId]: { ...(state.pageStates[pageId] || {}), ...pageState }
        }
    })),
    lang: (localStorage.getItem('lang') === 'vi' || localStorage.getItem('lang') === 'en') ? localStorage.getItem('lang') as 'vi' | 'en' : 'vi',
    setLang: (lang) => {
        localStorage.setItem('lang', lang);
        set({ lang });
    },
    isResultPanelOpen: true,
    toggleResultPanel: () => set((state) => ({ isResultPanelOpen: !state.isResultPanelOpen })),
    explorerSearchMode: 'local',
    setExplorerSearchMode: (mode) => set({ explorerSearchMode: mode }),
    isCommandPaletteOpen: false,
    toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
    setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
    defaultResultHeight: 300,
    setDefaultResultHeight: (height) => set({ defaultResultHeight: height }),
    destructiveConfirm: null,
    requestDestructiveConfirm: (analysis) => {
        return new Promise<boolean>((resolve) => {
            set({ destructiveConfirm: { isOpen: true, analysis, resolve } });
        });
    },
    closeDestructiveConfirm: (confirmed) => set((state) => {
        if (state.destructiveConfirm?.resolve) {
            state.destructiveConfirm.resolve(confirmed);
        }
        return { destructiveConfirm: null };
    }),
});
