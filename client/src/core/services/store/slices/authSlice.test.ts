import { beforeEach, describe, expect, it } from 'vitest';
import { createAuthSlice, type AuthUser } from './authSlice';
import type { Tab } from './tabSlice';

const userA: AuthUser = {
    id: 'user-a',
    email: 'ada@example.com',
};

const userB: AuthUser = {
    id: 'user-b',
    email: 'grace@example.com',
};

const queryTab: Tab = {
    id: 'query-1',
    title: 'Query 1',
    type: 'query',
    metadata: { sql: 'select * from users;' },
};

const tableTab: Tab = {
    id: 'table-1',
    title: 'users',
    type: 'table',
    metadata: { tableId: 'table:users' },
};

function createTestStore() {
    let state: Record<string, unknown> = {
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
        nosqlFilter: { action: 'find', filter: '{\n  \n}', options: '{\n  "limit": 50\n}' },
        nosqlMqlQuery: JSON.stringify({
            action: 'find',
            collection: 'yourCollection',
            filter: {},
            options: {},
            limit: 50,
        }, null, 2),
        nosqlResult: null,
        nosqlIsQueryRunning: false,
        nosqlPipelineStages: [{ id: '1', type: '$match', value: '{\n  \n}', enabled: true }],
        nosqlSchemaStats: null,
    };

    const store = {
        ...state,
        ...createAuthSlice(
            ((partial: unknown) => {
                const next = typeof partial === 'function'
                    ? partial(state)
                    : partial;
                state = { ...state, ...(next as Record<string, unknown>) };
                Object.assign(store, state);
            }) as never,
            undefined as never,
            undefined as never,
        ),
    };

    state = { ...state, ...store };

    return {
        store,
        getState: () => state,
        setState: (partial: Record<string, unknown>) => {
            state = { ...state, ...partial };
            Object.assign(store, state);
        },
    };
}

describe('authSlice workspace recovery', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('restores query tabs after a session-expiry logout for the same user', () => {
        const { store, getState, setState } = createTestStore();

        setState({
            isAuthenticated: true,
            user: userA,
            activeConnectionId: 'conn-1',
            activeDatabase: 'app',
            tabs: [queryTab, tableTab],
            activeTabId: queryTab.id,
        });

        store.logout({ preserveWorkspace: true });
        expect(getState().tabs).toEqual([]);

        store.login('token', userA, 123);

        expect(getState().tabs).toEqual([queryTab]);
        expect(getState().activeTabId).toBe(queryTab.id);
        expect(getState().activeConnectionId).toBe('conn-1');
        expect(getState().activeDatabase).toBe('app');
    });

    it('does not restore another user workspace after a session-expiry logout', () => {
        const { store, getState, setState } = createTestStore();

        setState({
            isAuthenticated: true,
            user: userA,
            tabs: [queryTab],
            activeTabId: queryTab.id,
        });

        store.logout({ preserveWorkspace: true });
        store.login('token', userB, 123);

        expect(getState().tabs).toEqual([]);
        expect(getState().activeTabId).toBeNull();
    });

    it('does not restore query tabs after an explicit sign out', () => {
        const { store, getState, setState } = createTestStore();

        setState({
            isAuthenticated: true,
            user: userA,
            tabs: [queryTab],
            activeTabId: queryTab.id,
        });

        store.logout({ preserveWorkspace: false });
        store.login('token', userA, 123);

        expect(getState().tabs).toEqual([]);
        expect(getState().activeTabId).toBeNull();
    });
});
