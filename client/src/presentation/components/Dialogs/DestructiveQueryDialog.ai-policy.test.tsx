import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DestructiveQueryDialog } from './DestructiveQueryDialog';

const mocks = vi.hoisted(() => ({
    enabled: true,
    post: vi.fn(),
    getAdapter: vi.fn(),
    closeConfirm: vi.fn(),
}));
vi.mock('@/core/services/api.service', () => ({ apiService: { post: mocks.post } }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => { if (!mocks.enabled) throw new Error('AI is disabled for this account.'); },
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({ enabled: mocks.enabled, customProviders: [], disabledProviders: ['groq'], fallbackProvider: 'none' }),
    resolveAiSelection: () => ({ model: 'fixture-model' }),
}));
vi.mock('@/core/services/ConnectionService', () => ({ connectionService: { getAdapter: mocks.getAdapter } }));
vi.mock('@/core/services/store', () => ({
    useAppStore: () => ({
        lang: 'en', aiModel: 'fixture-model', aiRoutingMode: 'auto',
        activeConnectionId: 'connection-1', activeDatabase: 'fixture-db',
        connections: [{ id: 'connection-1', type: 'postgres', name: 'Fixture' }],
        closeDestructiveConfirm: mocks.closeConfirm,
        destructiveConfirm: { isOpen: true, analysis: {
            severity: 'high', statement: 'DROP DATABASE fixture', keywords: ['DROP'],
            affectedObject: 'fixture', objectType: 'DATABASE', impactScope: 'database', reason: 'destructive_schema_change',
        } },
    }),
}));

let client: QueryClient;
function renderDialog() {
    return render(<QueryClientProvider client={client}><DestructiveQueryDialog /></QueryClientProvider>);
}

describe('DestructiveQueryDialog deeper AI review account policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enabled = true;
        mocks.post.mockResolvedValue({ message: 'Fixture risk review' });
        client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    });
    afterEach(() => client.clear());

    it('blocks a stale AI review before dispatch or additional side effects', async () => {
        renderDialog();
        mocks.enabled = false;
        fireEvent.click(screen.getByRole('button', { name: 'Ask AI for a deeper review' }));
        await waitFor(() => expect(mocks.post).not.toHaveBeenCalled());
        expect(mocks.closeConfirm).not.toHaveBeenCalled();
        expect(screen.queryByText('Fixture risk review')).not.toBeInTheDocument();
    });

    it('disables only the AI review while off, leaving the safety dialog usable', () => {
        mocks.enabled = false;
        renderDialog();
        expect(screen.getByRole('button', { name: 'Ask AI for a deeper review' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(mocks.getAdapter).not.toHaveBeenCalled();
    });

    it('forwards exclusions and strict fallback on an enabled deeper review', async () => {
        renderDialog();
        fireEvent.click(screen.getByRole('button', { name: 'Ask AI for a deeper review' }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/ai/generate-sql', expect.objectContaining({
            disabledProviders: ['groq'], fallbackProvider: 'none',
        })));
        await act(async () => { await Promise.resolve(); });
        expect(screen.getByText('Fixture risk review')).toBeVisible();
    });
});
