import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionDialog } from './ConnectionDialog';
import { useAppStore } from '@/core/services/store';

// The dialog reads open state and connection list from the app store.
vi.mock('@/core/services/store', async () => {
    const actual = await vi.importActual<typeof import('@/core/services/store')>(
        '@/core/services/store',
    );
    return { ...actual, useAppStore: vi.fn() };
});

const mockedUseAppStore = vi.mocked(useAppStore);

function setupStore(overrides: Record<string, unknown> = {}) {
    const state = {
        isConnectionDialogOpen: true,
        closeConnectionDialog: vi.fn(),
        addConnection: vi.fn(),
        connections: [],
        user: { id: 'u1', name: 'Test', email: 't@t.dev', role: 'USER' },
        lang: 'en',
        ...overrides,
    };
    // The component may call useAppStore with a selector or without one.
    mockedUseAppStore.mockImplementation(((selector?: (s: unknown) => unknown) =>
        selector ? selector(state) : state) as never);
    return state;
}

describe('ConnectionDialog render', () => {
    it('renders the engine picker with all nine engines without crashing', () => {
        setupStore();
        render(<ConnectionDialog />);

        const labels = [
            'PostgreSQL',
            'CockroachDB',
            'MySQL',
            'MariaDB',
            'SQL Server',
            'ClickHouse',
            'SQLite',
            'MongoDB',
            'Atlas (SRV)',
        ];
        for (const label of labels) {
            expect(screen.getByTitle(label)).toBeDefined();
        }
    });
});
