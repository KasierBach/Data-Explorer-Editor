import type { StateCreator } from 'zustand';

export interface AuthSlice {
    isAuthenticated: boolean;
    accessToken: string | null;
    tokenExp: number | null;
    user: { name: string; email: string } | null;
    login: (token: string, user: { name: string; email: string }) => void;
    logout: () => void;
    updateUser: (user: { name: string; email: string }) => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    isAuthenticated: false,
    accessToken: null,
    tokenExp: null,
    user: null,
    login: (token, user) => {
        let tokenExp: number | null = null;
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            if (payload.exp) tokenExp = payload.exp;
        } catch (e) {
            console.error('Failed to parse JWT exp', e);
        }

        set({
            isAuthenticated: true,
            accessToken: token,
            tokenExp,
            user,
            isConnectionDialogOpen: false,
            // Clear previous user's data to prevent cross-account leaking
            connections: [],
            activeConnectionId: null,
            activeDatabase: null,
            tabs: [],
            activeTabId: null,
            aiChats: [],
            activeAiChatId: null,
            savedQueries: [],
            queryHistory: [],
            expandedNodes: {},
        } as any);
    },
    logout: () => set({
        isAuthenticated: false,
        accessToken: null,
        tokenExp: null,
        user: null,
        // Clear all user-specific data to prevent leaking between accounts
        connections: [],
        activeConnectionId: null,
        activeDatabase: null,
        tabs: [],
        activeTabId: null,
        aiChats: [],
        activeAiChatId: null,
        savedQueries: [],
        queryHistory: [],
        expandedNodes: {},
    } as any),
    updateUser: (user) => set({ user }),
});
