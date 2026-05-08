import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { createUISlice, type UISlice } from './slices/uiSlice';
import { createAiChatSlice, type AiChatSlice, type AiChat, type AiMessage } from './slices/aiChatSlice';
import { createConnectionSlice, type ConnectionSlice, type Connection } from './slices/connectionSlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createTabSlice, type TabSlice, type Tab } from './slices/tabSlice';
import { createQuerySlice, type QuerySlice, type SavedQuery, type QueryHistoryEntry } from './slices/querySlice';
import { createNoSqlSlice, type NoSqlSlice } from './slices/nosqlSlice';

// Re-export types that are used across the app
export type { AiChat, AiMessage, Connection, Tab, SavedQuery, QueryHistoryEntry };

// Combine all slice interfaces
export type AppState = UISlice &
    AiChatSlice &
    ConnectionSlice &
    AuthSlice &
    TabSlice &
    QuerySlice &
    NoSqlSlice;

export const useAppStore = create<AppState>()(
    persist(
        (set, get, api) => ({
            ...createUISlice(set, get, api),
            ...createAiChatSlice(set, get, api),
            ...createConnectionSlice(set, get, api),
            ...createAuthSlice(set, get, api),
            ...createTabSlice(set, get, api),
            ...createQuerySlice(set, get, api),
            ...createNoSqlSlice(set, get, api),
        }),
        {
            name: 'data-explorer-storage',
            storage: createJSONStorage(() => localStorage),
            // Sanitize persisted state on rehydration to fix corrupt data
            merge: (persistedState, currentState) => {
                const persisted = (persistedState as Record<string, any>) || {};
                // Fix: expandedNodes may have been saved as {} instead of []
                if (persisted.expandedNodes && !Array.isArray(persisted.expandedNodes)) {
                    persisted.expandedNodes = [];
                }
                delete persisted.isAuthenticated;
                delete persisted.isAuthBootstrapped;
                delete persisted.accessToken;
                delete persisted.tokenExp;
                delete persisted.user;
                if (Array.isArray(persisted.aiChats)) {
                    persisted.aiChats = persisted.aiChats.map((chat: Record<string, any>) => ({
                        ...chat,
                        messages: [],
                    }));
                }
                return { ...currentState, ...persisted } as AppState;
            },
            // Only persist essential state AND sanitize passwords
            partialize: (state) => ({
                connections: state.connections.map(c => {
                    const { password, ...safeConnection } = c;
                    return safeConnection;
                }),
                activeConnectionId: state.activeConnectionId,
                activeDatabase: state.activeDatabase,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                isSidebarOpen: state.isSidebarOpen,
                sidebarWidth: state.sidebarWidth,
                isDesktopModeOnMobile: state.isDesktopModeOnMobile,
                savedQueries: state.savedQueries,
                pinnedQueryIds: state.pinnedQueryIds,
                queryHistory: state.queryHistory,
                aiChats: state.aiChats.map(chat => ({
                    ...chat,
                    messages: [],
                })),
                activeAiChatId: state.activeAiChatId,
                aiModel: state.aiModel,
                aiMode: state.aiMode,
                aiRoutingMode: state.aiRoutingMode,
                isAiPanelOpen: state.isAiPanelOpen,
                expandedNodes: state.expandedNodes,
                pageStates: state.pageStates,
                lang: state.lang,
                isResultPanelOpen: state.isResultPanelOpen,
                nosqlActiveConnectionId: state.nosqlActiveConnectionId,
                nosqlActiveDatabase: state.nosqlActiveDatabase,
                nosqlActiveCollection: state.nosqlActiveCollection,
                nosqlViewMode: state.nosqlViewMode,
                nosqlFilter: state.nosqlFilter,
                nosqlMqlQuery: state.nosqlMqlQuery,
                nosqlPipelineStages: state.nosqlPipelineStages,
                explorerSearchMode: state.explorerSearchMode,
                defaultResultHeight: state.defaultResultHeight,
            }),
        }
    )
);
