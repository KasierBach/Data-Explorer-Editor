import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { createUISlice, type UISlice } from './slices/uiSlice';
import { createAiChatSlice, type AiChatSlice, type AiChat, type AiMessage } from './slices/aiChatSlice';
import { createConnectionSlice, type ConnectionSlice, type Connection } from './slices/connectionSlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createTabSlice, type TabSlice, type Tab } from './slices/tabSlice';
import { createQuerySlice, type QuerySlice, type SavedQuery, type QueryHistoryEntry } from './slices/querySlice';

// Re-export types that are used across the app
export type { AiChat, AiMessage, Connection, Tab, SavedQuery, QueryHistoryEntry };

// Combine all slice interfaces
export type AppState = UISlice &
    AiChatSlice &
    ConnectionSlice &
    AuthSlice &
    TabSlice &
    QuerySlice;

export const useAppStore = create<AppState>()(
    persist(
        (set, get, api) => ({
            ...createUISlice(set, get, api),
            ...createAiChatSlice(set, get, api),
            ...createConnectionSlice(set, get, api),
            ...createAuthSlice(set, get, api),
            ...createTabSlice(set, get, api),
            ...createQuerySlice(set, get, api),
        }),
        {
            name: 'data-explorer-storage',
            storage: createJSONStorage(() => localStorage),
            // Only persist essential state
            partialize: (state) => ({
                connections: state.connections,
                activeConnectionId: state.activeConnectionId,
                isAuthenticated: state.isAuthenticated,
                accessToken: state.accessToken,
                tokenExp: state.tokenExp,
                user: state.user,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                isSidebarOpen: state.isSidebarOpen,
                sidebarWidth: state.sidebarWidth,
                savedQueries: state.savedQueries,
                queryHistory: state.queryHistory,
                aiChats: state.aiChats,
                activeAiChatId: state.activeAiChatId,
                isAiPanelOpen: state.isAiPanelOpen,
            }),
        }
    )
);
