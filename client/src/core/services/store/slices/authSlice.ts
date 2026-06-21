import type { StateCreator } from 'zustand';
import type { AiChat } from './aiChatSlice';
import type { Connection } from './connectionSlice';
import type { NoSqlFilterState, NoSqlPipelineStage, NoSqlSchemaFieldStat, NoSqlSlice } from './nosqlSlice';
import type { QueryHistoryEntry, SavedQuery } from './querySlice';
import type { Tab } from './tabSlice';
import type { PageState } from './uiSlice';

const WORKSPACE_RECOVERY_STORAGE_KEY = 'data-explorer-workspace-recovery-v1';

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
    planExpiresAt?: string;
    subscriptionStatus?: string;
    paymentProvider?: string;
}

interface AuthResetState {
    isConnectionDialogOpen: boolean;
    connections: Connection[];
    activeConnectionId: string | null;
    activeDatabase: string | null;
    tabs: Tab[];
    activeTabId: string | null;
    aiChats: AiChat[];
    activeAiChatId: string | null;
    savedQueries: SavedQuery[];
    pinnedQueryIds: string[];
    queryHistory: QueryHistoryEntry[];
    expandedNodes: string[];
    pageStates: Record<string, PageState>;
    nosqlActiveConnectionId: string | null;
    nosqlActiveDatabase: string | null;
    nosqlActiveCollection: string | null;
    nosqlViewMode: 'tree' | 'grid' | 'charts' | 'schema' | 'aggregation';
    nosqlFilter: NoSqlFilterState;
    nosqlMqlQuery: string;
    nosqlResult: NoSqlSlice['nosqlResult'];
    nosqlIsQueryRunning: boolean;
    nosqlPipelineStages: NoSqlPipelineStage[];
    nosqlSchemaStats: NoSqlSchemaFieldStat[] | null;
}

interface LogoutOptions {
    preserveWorkspace?: boolean;
}

interface WorkspaceRecoverySnapshot {
    activeConnectionId: string | null;
    activeDatabase: string | null;
    tabs: Tab[];
    activeTabId: string | null;
}

interface WorkspaceRecoveryPayload {
    userKey: string;
    snapshot: WorkspaceRecoverySnapshot;
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
    logout: (options?: LogoutOptions) => void;
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

function getRecoveryUserKey(user?: AuthUser | null) {
    return user?.id || user?.email || null;
}

function readWorkspaceRecoveryPayload() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(WORKSPACE_RECOVERY_STORAGE_KEY);
        if (!raw) return null;
        const payload = JSON.parse(raw) as Partial<WorkspaceRecoveryPayload>;
        if (
            !payload
            || typeof payload.userKey !== 'string'
            || !payload.snapshot
            || !Array.isArray(payload.snapshot.tabs)
        ) {
            return null;
        }
        return payload as WorkspaceRecoveryPayload;
    } catch {
        return null;
    }
}

function clearWorkspaceRecovery() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(WORKSPACE_RECOVERY_STORAGE_KEY);
}

function buildWorkspaceRecovery(state: AuthSlice & AuthResetState) {
    const queryTabs = state.tabs.filter((tab) => tab.type === 'query');
    if (queryTabs.length === 0) return null;

    const activeTabId = queryTabs.some((tab) => tab.id === state.activeTabId)
        ? state.activeTabId
        : queryTabs[0].id;

    return {
        activeConnectionId: state.activeConnectionId,
        activeDatabase: state.activeDatabase,
        tabs: queryTabs,
        activeTabId,
    } satisfies WorkspaceRecoverySnapshot;
}

function persistWorkspaceRecovery(state: AuthSlice & AuthResetState) {
    if (typeof window === 'undefined') return;

    const userKey = getRecoveryUserKey(state.user);
    const snapshot = buildWorkspaceRecovery(state);
    if (!userKey || !snapshot) {
        clearWorkspaceRecovery();
        return;
    }

    window.localStorage.setItem(
        WORKSPACE_RECOVERY_STORAGE_KEY,
        JSON.stringify({ userKey, snapshot } satisfies WorkspaceRecoveryPayload),
    );
}

function takeWorkspaceRecovery(user: AuthUser) {
    const payload = readWorkspaceRecoveryPayload();
    const userKey = getRecoveryUserKey(user);
    if (!payload || !userKey || payload.userKey !== userKey) {
        return null;
    }

    clearWorkspaceRecovery();
    return payload.snapshot;
}

const defaultNoSqlFilter: NoSqlFilterState = {
    action: 'find',
    filter: '{\n  \n}',
    options: '{\n  "limit": 50\n}',
};

const defaultNoSqlMqlQuery = JSON.stringify({
    action: 'find',
    collection: 'yourCollection',
    filter: {},
    options: {},
    limit: 50,
}, null, 2);

const defaultNoSqlPipelineStages: NoSqlPipelineStage[] = [
    { id: '1', type: '$match', value: '{\n  \n}', enabled: true },
];

const resetSessionState: AuthResetState = {
    isConnectionDialogOpen: false,
    connections: [],
    activeConnectionId: null,
    activeDatabase: null,
    tabs: [],
    activeTabId: null,
    aiChats: [],
    activeAiChatId: null,
    savedQueries: [],
    pinnedQueryIds: [],
    queryHistory: [],
    expandedNodes: [],
    pageStates: {},
    nosqlActiveConnectionId: null,
    nosqlActiveDatabase: null,
    nosqlActiveCollection: null,
    nosqlViewMode: 'tree',
    nosqlFilter: defaultNoSqlFilter,
    nosqlMqlQuery: defaultNoSqlMqlQuery,
    nosqlResult: null,
    nosqlIsQueryRunning: false,
    nosqlPipelineStages: defaultNoSqlPipelineStages,
    nosqlSchemaStats: null,
};

export const createAuthSlice: StateCreator<AuthSlice & AuthResetState, [], [], AuthSlice> = (set) => ({
    isAuthenticated: false,
    isAuthBootstrapped: false,
    accessToken: null,
    tokenExp: null,
    user: null,
    login: (token, user, tokenExp) => {
        const recoveredWorkspace = takeWorkspaceRecovery(user);
        set({
            ...buildSessionState(token, user, tokenExp),
            ...resetSessionState,
            ...recoveredWorkspace,
        });
    },
    restoreSession: (token, user, tokenExp) => {
        set({
            ...buildSessionState(token, user, tokenExp),
        });
    },
    logout: (options) =>
        set((state) => {
            if (options?.preserveWorkspace) {
                persistWorkspaceRecovery(state);
            } else {
                clearWorkspaceRecovery();
            }

            return {
                isAuthenticated: false,
                isAuthBootstrapped: true,
                accessToken: null,
                tokenExp: null,
                user: null,
                ...resetSessionState,
            };
        }),
    setAuthBootstrapped: (value) => set({ isAuthBootstrapped: value }),
    updateUser: (userData) =>
        set((state) => ({
            user: state.user ? { ...state.user, ...userData } : null,
        })),
});
