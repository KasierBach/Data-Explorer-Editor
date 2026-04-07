import type { StateCreator } from 'zustand';

export interface AuthSlice {
    isAuthenticated: boolean;
    isAuthBootstrapped: boolean;
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
        bio?: string;
        isOnboarded?: boolean;
        provider?: string;
        username?: string;
        jobRole?: string;
        phoneNumber?: string;
        address?: string;
        theme?: string;
        language?: string;
        emailNotifications?: boolean;
        failedQueryAlerts?: boolean;
        productUpdates?: boolean;
        securityAlerts?: boolean;
        plan?: string;
        billingDate?: string;
        paymentMethod?: string;
    } | null;
    login: (token: string, user: any, tokenExp?: number | null) => void;
    restoreSession: (token: string, user: any, tokenExp?: number | null) => void;
    logout: () => void;
    setAuthBootstrapped: (value: boolean) => void;
    updateUser: (user: any) => void;
}

function parseTokenExp(token?: string | null, fallback?: number | null) {
    if (typeof fallback === 'number') {
        return fallback;
    }

    if (!token) {
        return null;
    }

    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        return payload.exp ?? null;
    } catch (e) {
        console.error('Failed to parse JWT', e);
        return null;
    }
}

function buildSessionState(token: string, user: any, tokenExp?: number | null) {
    const parsedTokenExp = parseTokenExp(token, tokenExp);
    const role = user?.role;

    return {
        isAuthenticated: true,
        isAuthBootstrapped: true,
        accessToken: token,
        tokenExp: parsedTokenExp,
        user: { ...user, role },
    };
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
    isAuthenticated: false,
    isAuthBootstrapped: false,
    accessToken: null,
    tokenExp: null,
    user: null,
    login: (token, user, tokenExp) => {
        set({
            ...buildSessionState(token, user, tokenExp),
            isConnectionDialogOpen: false,
            connections: [],
            tabs: [],
            activeTabId: null,
            aiChats: [],
            activeAiChatId: null,
            savedQueries: [],
            queryHistory: [],
            expandedNodes: [],
        } as any);
    },
    restoreSession: (token, user, tokenExp) => {
        set({
            ...buildSessionState(token, user, tokenExp),
        });
    },
    logout: () =>
        set({
            isAuthenticated: false,
            isAuthBootstrapped: true,
            accessToken: null,
            tokenExp: null,
            user: null,
            connections: [],
            tabs: [],
            activeTabId: null,
            aiChats: [],
            activeAiChatId: null,
            savedQueries: [],
            queryHistory: [],
            expandedNodes: [],
        } as any),
    setAuthBootstrapped: (value) => set({ isAuthBootstrapped: value }),
    updateUser: (userData) =>
        set((state) => ({
            user: state.user ? { ...state.user, ...userData } : (userData as any),
        })),
});
