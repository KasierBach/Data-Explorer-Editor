import type { StateCreator } from 'zustand';

export interface UISlice {
    isSidebarOpen: boolean;
    sidebarWidth: number;
    toggleSidebar: () => void;
    setSidebarOpen: (isOpen: boolean) => void;
    setSidebarWidth: (width: number) => void;
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
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
    isSidebarOpen: true,
    sidebarWidth: 20,
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    setSidebarWidth: (width) => set({ sidebarWidth: width }),
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
    lang: (localStorage.getItem('lang') as any) || 'vi',
    setLang: (lang) => {
        localStorage.setItem('lang', lang);
        set({ lang });
    },
    isResultPanelOpen: true,
    toggleResultPanel: () => set((state) => ({ isResultPanelOpen: !state.isResultPanelOpen })),
});
