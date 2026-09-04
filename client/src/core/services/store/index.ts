import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { createUISlice, type UISlice } from './slices/uiSlice';
import { createAiChatSlice, type AiChatSlice, type AiChat, type AiMessage } from './slices/aiChatSlice';
import { createConnectionSlice, type ConnectionSlice, type Connection } from './slices/connectionSlice';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createTabSlice, type TabSlice, type Tab } from './slices/tabSlice';
import { createQuerySlice, type QuerySlice, type SavedQuery, type QueryHistoryEntry } from './slices/querySlice';
import { createNoSqlSlice, type NoSqlSlice } from './slices/nosqlSlice';

export type { AiChat, AiMessage, Connection, Tab, SavedQuery, QueryHistoryEntry };

export type AppState = UISlice &
    AiChatSlice &
    ConnectionSlice &
    AuthSlice &
    TabSlice &
    QuerySlice &
    NoSqlSlice;

type PersistedStoreState = Partial<AppState> & {
    aiChats?: Array<AiChat & { messages?: AiMessage[] }>;
};

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
            merge: (persistedState, currentState) => {
                const persisted = (persistedState as PersistedStoreState) || {};
                if (persisted.expandedNodes && !Array.isArray(persisted.expandedNodes)) {
                    persisted.expandedNodes = [];
                }
                if (Array.isArray(persisted.connections)) {
                    persisted.connections = persisted.connections.map((c) => {
                        const safeConnection = { ...c };
                        delete safeConnection.password;
                        delete safeConnection.sshPrivateKey;
                        delete safeConnection.sshPassphrase;
                        return safeConnection;
                    });
                }
                if ((persisted as { nosqlViewMode?: string }).nosqlViewMode === 'charts') {
                    persisted.nosqlViewMode = 'grid';
                }
                delete persisted.isAuthenticated;
                delete persisted.isAuthBootstrapped;
                delete persisted.accessToken;
                delete persisted.tokenExp;
                delete persisted.user;
                delete persisted.savedQueries;
                delete persisted.queryHistory;
                delete persisted.nosqlResult;
                delete persisted.nosqlSchemaStats;
                if (Array.isArray(persisted.aiChats)) {
                    persisted.aiChats = persisted.aiChats.map((chat) => ({
                        ...chat,
                        messages: [],
                    }));
                }
                const retiredAiModels = new Set([
                    'groq:meta-llama/llama-4-scout-17b-16e-instruct',
                    'groq:mixtral-8x7b-32768',
                    'groq:gemma2-9b-it',
                    'openai/gpt-oss-120b:free',
                    'openrouter/owl-alpha',
                ]);
                if (!persisted.aiModel || retiredAiModels.has(persisted.aiModel)) {
                    persisted.aiModel = 'groq:openai/gpt-oss-120b';
                }
                return { ...currentState, ...persisted } as AppState;
            },
            partialize: (state) => ({
                connections: state.connections.map(c => {
                    const safeConnection = { ...c };
                    delete safeConnection.password;
                    delete safeConnection.sshPrivateKey;
                    delete safeConnection.sshPassphrase;
                    return safeConnection;
                }),
                activeConnectionId: state.activeConnectionId,
                activeDatabase: state.activeDatabase,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                isSidebarOpen: state.isSidebarOpen,
                sidebarWidth: state.sidebarWidth,
                isDesktopModeOnMobile: state.isDesktopModeOnMobile,
                pinnedQueryIds: state.pinnedQueryIds,
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
                isResultPanelOpen: state.isResultPanelOpen,
                nosqlActiveConnectionId: state.nosqlActiveConnectionId,
                nosqlActiveDatabase: state.nosqlActiveDatabase,
                nosqlActiveCollection: state.nosqlActiveCollection,
                nosqlViewMode: state.nosqlViewMode,
                nosqlFilter: state.nosqlFilter,
                nosqlMqlQuery: state.nosqlMqlQuery,
                nosqlPipelineStages: state.nosqlPipelineStages,
                nosqlPageIndex: state.nosqlPageIndex,
                nosqlPageSize: state.nosqlPageSize,
                nosqlWorkspaceStates: state.nosqlWorkspaceStates,
                explorerSearchMode: state.explorerSearchMode,
                defaultResultHeight: state.defaultResultHeight,
            }),
        }
    )
);
