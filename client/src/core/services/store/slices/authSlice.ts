import type { StateCreator } from 'zustand';
import type { AiChat } from './aiChatSlice';
import type { Connection } from './connectionSlice';
import type { QueryHistoryEntry, SavedQuery } from './querySlice';
import type { Tab } from './tabSlice';

export interface AuthUser {
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
}

interface AuthResetState {
    isConnectionDialogOpen: boolean;
    connections: Connection[];
    tabs: Tab[];
    activeTabId: string | null;
    aiChats: AiChat[];
    activeAiChatId: string | null;
    savedQueries: SavedQuery[];
    queryHistory: QueryHistoryEntry[];
    expandedNodes: string[];
}

interface JwtPayload {
    exp?: number;
}

export interface AuthSlice {
    isAuthenticated: boolean;
    isAuthBootstrapped: boolean;
    accessToken: string | null;
    tokenExp: number | null;
    user: AuthUser | null;
    login: (token: string, user: AuthUser, tokenExp?: number | null) => void;
    restoreSession: (token: string, user: AuthUser, tokenExp?: number | null) => void;
    logout: () => void;
    setAuthBootstrapped: (value: boolean) => void;
    updateUser: (user: Partial<AuthUser>) => void;
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
        const payload = JSON.parse(window.atob(base64)) as JwtPayload;
        return payload.exp ?? null;
    } catch (e) {
        console.error('Failed to parse JWT', e);
        return null;
    }
}

function buildSessionState(token: string, user: AuthUser, tokenExp?: number | null) {
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

const resetSessionState: AuthResetState = {
    isConnectionDialogOpen: false,
    connections: [],
    tabs: [],
    activeTabId: null,
    aiChats: [],
    activeAiChatId: null,
    savedQueries: [],
    queryHistory: [],
    expandedNodes: [],
};

export const createAuthSlice: StateCreator<AuthSlice & AuthResetState, [], [], AuthSlice> = (set) => ({
    isAuthenticated: false,
    isAuthBootstrapped: false,
    accessToken: null,
    tokenExp: null,
    user: null,
    login: (token, user, tokenExp) => {
        set({
            ...buildSessionState(token, user, tokenExp),
            ...resetSessionState,
        });
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
            ...resetSessionState,
        }),
    setAuthBootstrapped: (value) => set({ isAuthBootstrapped: value }),
    updateUser: (userData) =>
        set((state) => ({
            user: state.user ? { ...state.user, ...userData } : null,
        })),
});
