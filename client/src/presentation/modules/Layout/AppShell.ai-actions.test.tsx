import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { AiMessageBubble } from '../Query/AiMessageBubble';
import { AppShell } from './AppShell';

const mocks = vi.hoisted(() => ({
    enabled: true,
    updateTabMetadata: vi.fn(), openQueryTab: vi.fn(), setPageState: vi.fn(),
    setNosqlMqlQuery: vi.fn(), setNosqlViewMode: vi.fn(), post: vi.fn(),
}));
vi.mock('@/core/services/api.service', () => ({ apiService: { post: mocks.post, get: vi.fn() } }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => { if (!mocks.enabled) throw new Error('AI disabled'); },
}));
vi.mock('@/core/services/aiPreferences', () => ({ useAiPreferences: () => ({ enabled: mocks.enabled }) }));
vi.mock('@/presentation/modules/Query/AiMarkdownContent', () => ({ AiMarkdownContent: () => null }));
vi.mock('@/presentation/modules/Query/AiAssistant', () => ({
    AiAssistant: (props: { onInsertQuery: (sql: string) => void; onRunQuery: (sql: string) => void; runActionLabel?: string }) =>
        <AiMessageBubble msg={{ id: 'answer-1', role: 'ai', content: 'Saved SQL', sql: 'SELECT generated FROM fixture' } as AiMessage} {...props} />,
}));
vi.mock('../Explorer/ExplorerSidebar', () => ({ ExplorerSidebar: () => null }));
vi.mock('./MainContent', () => ({ MainContent: () => null }));
vi.mock('./Navbar', () => ({ Navbar: () => null }));
vi.mock('@/presentation/modules/Connection/ConnectionDialog', () => ({ ConnectionDialog: () => null }));
vi.mock('./MobileWorkspaceBar', () => ({ MobileWorkspaceBar: () => null }));
vi.mock('@/presentation/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));
vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({ useResponsiveLayoutMode: () => ({
    isActualMobile: false, isCompactMobileLayout: false, isSmallMobile: false, isLandscapeMobile: false,
}) }));
vi.mock('@/presentation/hooks/useResizablePanel', () => ({ useResizablePanel: ({ initialWidth }: { initialWidth: number }) => ({
    width: initialWidth, isDragging: false, setWidth: vi.fn(), startResizing: vi.fn(),
}) }));

const initialState = useAppStore.getInitialState();
const generatedSql = 'SELECT generated FROM fixture';
const writeSpies = [mocks.updateTabMetadata, mocks.openQueryTab, mocks.setPageState, mocks.setNosqlMqlQuery, mocks.setNosqlViewMode];

function expectNoActionWrites() {
    for (const spy of writeSpies) expect(spy).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
}

function deferConfirmation() {
    let resolve!: (accepted: boolean) => void;
    vi.spyOn(window, 'confirm').mockImplementation(() => new Promise<boolean>((finish) => { resolve = finish; }) as unknown as boolean);
    return (accepted: boolean) => act(async () => { resolve(accepted); });
}

function changeQueryMetadata(metadata: Record<string, unknown>) {
    useAppStore.setState(state => ({ tabs: state.tabs.map(tab => tab.id === 'query-1'
        ? { ...tab, metadata: { ...tab.metadata, ...metadata } } : tab) }));
}

describe('AppShell AI Apply/Run integrity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enabled = true;
        mocks.updateTabMetadata.mockImplementation(initialState.updateTabMetadata);
        mocks.openQueryTab.mockImplementation(initialState.openQueryTab);
        mocks.setPageState.mockImplementation(initialState.setPageState);
        mocks.setNosqlMqlQuery.mockImplementation(initialState.setNosqlMqlQuery);
        mocks.setNosqlViewMode.mockImplementation(initialState.setNosqlViewMode);
        useAppStore.setState({
            ...initialState, lang: 'en', sidebarWidth: 300,
            isAuthenticated: true, isAuthBootstrapped: true,
            user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: true },
            activeConnectionId: 'connection-1', activeDatabase: 'fixture-db',
            connections: [
                { id: 'connection-1', name: 'Fixture', type: 'postgres', database: 'fixture-db', allowQueryExecution: true },
                { id: 'connection-2', name: 'Other', type: 'postgres', database: 'other-db' },
            ],
            tabs: [
                { id: 'query-1', title: 'Query 1', type: 'query', metadata: { sql: 'SELECT existing FROM fixture', runRequestedAt: null } },
                { id: 'table-1', title: 'Fixture table', type: 'table' },
            ],
            activeTabId: 'query-1', activeAiChatId: 'chat-1',
            pageStates: { 'ai-chat-draft-chat-1': { input: 'Keep my draft', aiDraftRevision: 1 } },
            updateTabMetadata: mocks.updateTabMetadata, openQueryTab: mocks.openQueryTab,
            setPageState: mocks.setPageState, setNosqlMqlQuery: mocks.setNosqlMqlQuery, setNosqlViewMode: mocks.setNosqlViewMode,
        }, true);
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        useAppStore.setState(initialState, true);
    });

    it('keeps stored Apply available while AI is off without requesting execution', () => {
        mocks.enabled = false;
        useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: false } });
        const confirm = vi.spyOn(window, 'confirm');
        render(<AppShell />);
        fireEvent.click(screen.getByTitle('Insert into editor'));
        expect(mocks.updateTabMetadata).toHaveBeenCalledExactlyOnceWith('query-1', { sql: generatedSql, runRequestedAt: null });
        expect(confirm).not.toHaveBeenCalled();
        expect(mocks.openQueryTab).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(useAppStore.getState().pageStates['ai-chat-draft-chat-1'].input).toBe('Keep my draft');
    });

    it.each(['query-1', 'table-1'])('does not write or open a tab before confirmation, and preserves %s on decline', async (tabId) => {
        useAppStore.setState({ activeTabId: tabId });
        const tabs = useAppStore.getState().tabs;
        const draft = useAppStore.getState().pageStates;
        const finish = deferConfirmation();
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expect(window.confirm).toHaveBeenCalledExactlyOnceWith(`Run now?\n\n${generatedSql}`);
        expectNoActionWrites();
        expect(useAppStore.getState().tabs).toBe(tabs);
        await finish(false);
        expectNoActionWrites();
        expect(useAppStore.getState().tabs).toBe(tabs);
        expect(useAppStore.getState().activeTabId).toBe(tabId);
        expect(useAppStore.getState().pageStates).toBe(draft);
    });

    it.each([true, false])('dispatches exactly once after affirmative confirmation with unchanged policy=%s', async (enabled) => {
        mocks.enabled = enabled;
        useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: enabled } });
        vi.spyOn(window, 'confirm').mockImplementation(() => { expectNoActionWrites(); return true; });
        vi.spyOn(Date, 'now').mockReturnValue(123456789);
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        await waitFor(() => expect(mocks.updateTabMetadata).toHaveBeenCalledExactlyOnceWith('query-1', { sql: generatedSql, runRequestedAt: 123456789 }));
        expect(mocks.openQueryTab).not.toHaveBeenCalled();
        expect(mocks.setPageState).not.toHaveBeenCalled();
        expect(mocks.setNosqlMqlQuery).not.toHaveBeenCalled();
        expect(mocks.post).not.toHaveBeenCalled();
        expect(useAppStore.getState().tabs[0].metadata).not.toHaveProperty('confirmed');
    });

    it('opens one query tab only after acceptance when the source tab is not a query', async () => {
        useAppStore.setState({ activeTabId: 'table-1' });
        const finish = deferConfirmation();
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expectNoActionWrites();
        await finish(true);
        expect(mocks.openQueryTab).toHaveBeenCalledTimes(1);
        expect(mocks.updateTabMetadata).toHaveBeenCalledTimes(1);
        const state = useAppStore.getState();
        expect(state.tabs.find(tab => tab.id === state.activeTabId)?.metadata).toMatchObject({ sql: generatedSql, runRequestedAt: expect.any(Number) });
        expect(state.tabs).toHaveLength(3);
        expect(state.pageStates['ai-chat-draft-chat-1'].input).toBe('Keep my draft');
    });

    it('coalesces repeat Run clicks while the same confirmation is pending', async () => {
        const finish = deferConfirmation();
        render(<AppShell />);
        const run = screen.getByRole('button', { name: 'Run now' });
        fireEvent.click(run);
        fireEvent.click(run);
        expect(window.confirm).toHaveBeenCalledTimes(1);
        expectNoActionWrites();
        await finish(true);
        expect(mocks.updateTabMetadata).toHaveBeenCalledTimes(1);
        expect(mocks.openQueryTab).not.toHaveBeenCalled();
    });

    it.each([
        ['active tab', () => useAppStore.setState({ activeTabId: 'table-1' })],
        ['editor SQL', () => changeQueryMetadata({ sql: 'SELECT edited FROM fixture' })],
        ['queued execution', () => changeQueryMetadata({ runRequestedAt: 99 })],
        ['closed tab', () => useAppStore.setState(state => ({ tabs: state.tabs.filter(tab => tab.id !== 'query-1') }))],
        ['connection', () => useAppStore.setState({ activeConnectionId: 'connection-2' })],
        ['database', () => useAppStore.setState({ activeDatabase: 'other-db' })],
        ['query authority', () => useAppStore.setState(state => ({ connections: state.connections.map(connection => ({ ...connection, allowQueryExecution: false })) }))],
        ['connection configuration', () => useAppStore.setState(state => ({ connections: state.connections.map(connection => ({ ...connection, database: 'reconfigured-db' })) }))],
        ['account', () => useAppStore.setState({ user: { id: 'account-2', email: 'other@example.test', aiEnabled: true } })],
        ['logout', () => useAppStore.setState({ isAuthenticated: false, user: null })],
        ['auth bootstrap', () => useAppStore.setState({ isAuthBootstrapped: false })],
        ['account policy', () => { mocks.enabled = false; useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: false } }); }],
        ['pending policy save', () => { mocks.enabled = false; }],
        ['source chat', () => useAppStore.setState({ activeAiChatId: 'chat-2' })],
    ] as const)('rejects accepted stale confirmation after %s changes with no extra action writes', async (_label, change) => {
        const finish = deferConfirmation();
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expectNoActionWrites();
        act(() => { change(); });
        const stateAfterChange = useAppStore.getState();
        await finish(true);
        expectNoActionWrites();
        expect(useAppStore.getState()).toBe(stateAfterChange);
    });

    it('invalidates off-to-on acceptance instead of running under a different policy', async () => {
        mocks.enabled = false;
        useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: false } });
        const finish = deferConfirmation();
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        act(() => {
            mocks.enabled = true;
            useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: true } });
        });
        await finish(true);
        expectNoActionWrites();
    });

    it.each([
        ['no connection', { activeConnectionId: null }],
        ['unauthenticated', { isAuthenticated: false }],
        ['unbootstrapped', { isAuthBootstrapped: false }],
        ['missing account', { user: null }],
        ['query execution disabled', { connections: [{ id: 'connection-1', name: 'Fixture', type: 'postgres' as const, allowQueryExecution: false }] }],
    ])('does not confirm or mutate without %s authority', (_label, patch) => {
        useAppStore.setState(patch);
        const confirm = vi.spyOn(window, 'confirm');
        render(<AppShell />);
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expect(confirm).not.toHaveBeenCalled();
        expectNoActionWrites();
    });

    it('requires an explicit true decision, not a truthy value', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue('true' as unknown as boolean);
        render(<AppShell />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run now' })); });
        expectNoActionWrites();
    });
});
