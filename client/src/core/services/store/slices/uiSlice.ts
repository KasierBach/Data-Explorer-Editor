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
});
