import type { StateCreator } from 'zustand';

export interface AuthSlice {
    isAuthenticated: boolean;
    accessToken: string | null;
    tokenExp: number | null;
    user: { 
        id?: string;
        name?: string; 
        firstName?: string;
        lastName?: string;
        email: string; 
        role?: string;
        avatarUrl?: string;
        isOnboarded?: boolean;
        username?: string;
        jobRole?: string;
    } | null;
    login: (token: string, user: { 
        id?: string;
        name?: string; 
        firstName?: string;
        lastName?: string;
        email: string; 
        role?: string;
        avatarUrl?: string;
        isOnboarded?: boolean;
        username?: string;
        jobRole?: string;
    }) => void;
    logout: () => void;
    updateUser: (user: { 
        id?: string;
        name?: string; 
        firstName?: string;
        lastName?: string;
        email: string; 
        role?: string;
        avatarUrl?: string;
        isOnboarded?: boolean;
        username?: string;
        jobRole?: string;
    }) => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    isAuthenticated: false,
    accessToken: null,
    tokenExp: null,
    user: null,
    login: (token, user) => {
        let tokenExp: number | null = null;
        let role = user.role;

        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            if (payload.exp) tokenExp = payload.exp;
            if (!role && payload.role) role = payload.role;
        } catch (e) {
            console.error('Failed to parse JWT', e);
        }

        set({
            isAuthenticated: true,
            accessToken: token,
            tokenExp,
            user: { ...user, role },
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
            expandedNodes: [],
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
        expandedNodes: [],
    } as any),
    updateUser: (userData) => set((state) => ({ 
        user: state.user ? { ...state.user, ...userData } : userData as any
    })),
});
