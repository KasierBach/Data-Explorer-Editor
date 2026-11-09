import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, type AiMessage } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { NoSqlShell } from './NoSqlShell';

const mocks = vi.hoisted(() => ({
    enabled: true, setEnabled: vi.fn(), post: vi.fn(),
    setNosqlMqlQuery: vi.fn(), setNosqlViewMode: vi.fn(),
    updateTabMetadata: vi.fn(), openQueryTab: vi.fn(), setPageState: vi.fn(),
    send: vi.fn(), regenerate: vi.fn(),
}));
vi.mock('@/core/services/api.service', () => ({ apiService: { post: mocks.post, get: vi.fn() } }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => { if (!mocks.enabled) throw new Error('AI disabled'); },
    useAiAccountPolicy: () => ({ enabled: mocks.enabled, isSaving: false, setEnabled: mocks.setEnabled }),
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({ enabled: mocks.enabled, customProviders: [], disabledProviders: [] }),
    updateAiPreferences: vi.fn(),
}));
vi.mock('@/presentation/hooks/useAiChat', () => ({ useAiChat: () => ({
    input: 'Keep my draft', setInput: vi.fn(), isLoading: false, attachments: [], modelStatuses: {},
    messagesEndRef: { current: null }, fileInputRef: { current: null },
    handleFileSelected: vi.fn(), handlePasteQuery: vi.fn(), handleMentionTable: vi.fn(),
    removeAttachment: vi.fn(), handleSend: mocks.send, handleKeyDown: vi.fn(), handleRegenerate: mocks.regenerate,
    handleEditSubmit: vi.fn(), handleStop: vi.fn(),
}) }));
vi.mock('@/presentation/modules/Query/AiChatInput', () => ({ AiChatInput: () => null }));
vi.mock('@/presentation/modules/Query/AiChatList', () => ({ AiChatList: () => null }));
vi.mock('@/presentation/modules/Query/AiMarkdownContent', () => ({ AiMarkdownContent: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock('../NoSqlExplorer/NoSqlSidebar', () => ({ NoSqlSidebar: () => null }));
vi.mock('../NoSqlExplorer/NoSqlMainContent', () => ({ NoSqlMainContent: () => null }));
vi.mock('./Navbar', () => ({ Navbar: () => null }));
vi.mock('@/presentation/modules/Connection/ConnectionDialog', () => ({ ConnectionDialog: () => null }));
vi.mock('./MobileWorkspaceBar', () => ({ MobileWorkspaceBar: () => null }));
vi.mock('@/lib/monaco', () => ({}));
vi.mock('@/presentation/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: () => undefined }));
vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({ useResponsiveLayoutMode: () => ({
    isActualMobile: false, isCompactMobileLayout: false, isSmallMobile: false, isLandscapeMobile: false,
}) }));
vi.mock('@/presentation/hooks/useResizablePanel', () => ({ useResizablePanel: ({ initialWidth }: { initialWidth: number }) => ({
    width: initialWidth, isDragging: false, setWidth: vi.fn(), startResizing: vi.fn(),
}) }));

const initialState = useAppStore.getInitialState();
const mql = 'db.fixture.find({ active: true })';
const pipeline = '[{ "$match": { "active": true } }]';

function expectDraftOnly() {
    expect(mocks.updateTabMetadata).not.toHaveBeenCalled();
    expect(mocks.openQueryTab).not.toHaveBeenCalled();
    expect(mocks.setPageState).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(useAppStore.getState().pageStates['ai-chat-draft-chat-1'].input).toBe('Keep my draft');
}

describe('NoSqlShell truthful AI draft actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
        mocks.enabled = true;
        mocks.setNosqlMqlQuery.mockImplementation(initialState.setNosqlMqlQuery);
        mocks.setNosqlViewMode.mockImplementation(initialState.setNosqlViewMode);
        useAppStore.setState({
            ...initialState, lang: 'en', sidebarWidth: 300,
            isAuthenticated: true, isAuthBootstrapped: true,
            user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: true },
            activeConnectionId: 'connection-1', activeDatabase: 'fixture-db',
            connections: [{ id: 'connection-1', name: 'Fixture', type: 'mongodb', database: 'fixture-db' }],
            nosqlMqlQuery: 'db.fixture.find({ existing: true })', nosqlViewMode: 'grid',
            aiChats: [{ id: 'chat-1', title: 'Saved chat', createdAt: 1, updatedAt: 1, messages: [{
                id: 'message-1', role: 'ai', content: 'Saved NoSQL draft', sql: mql,
                recommendations: [{ type: 'query_fix', title: 'Pipeline', summary: 'Saved pipeline', sql: pipeline }],
            } as AiMessage] }],
            activeAiChatId: 'chat-1', isFetchingAiChats: false,
            fetchAiChats: vi.fn(), loadAiChatMessages: vi.fn(), createAiChat: vi.fn(),
            pageStates: { 'ai-chat-draft-chat-1': { input: 'Keep my draft' } },
            setNosqlMqlQuery: mocks.setNosqlMqlQuery, setNosqlViewMode: mocks.setNosqlViewMode,
            updateTabMetadata: mocks.updateTabMetadata, openQueryTab: mocks.openQueryTab, setPageState: mocks.setPageState,
        }, true);
        vi.spyOn(window, 'confirm');
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        useAppStore.setState(initialState, true);
    });

    it.each(['en', 'vi'] as const)('forwards a localized Insert label through the real assistant for %s', (lang) => {
        useAppStore.setState({ lang });
        render(<NoSqlShell />);
        const text = getWorkspaceText(lang).aiMessageBubble;
        expect(screen.queryByTitle(text.runNow)).not.toBeInTheDocument();
        expect(screen.queryByTitle(text.runSuggestion)).not.toBeInTheDocument();
        expect(screen.getAllByTitle(text.insertToEditor)).toHaveLength(3);
        expectDraftOnly();
    });

    it.each([true, false])('applies the formerly Run action exactly once, without execution, with AI enabled=%s', (enabled) => {
        mocks.enabled = enabled;
        useAppStore.setState({ user: { id: 'account-1', email: 'fixture@example.test', aiEnabled: enabled } });
        render(<NoSqlShell />);
        fireEvent.click(screen.getAllByTitle('Insert into editor')[1]);
        expect(mocks.setNosqlMqlQuery).toHaveBeenCalledExactlyOnceWith(mql);
        expect(mocks.setNosqlViewMode).toHaveBeenCalledExactlyOnceWith('tree');
        expect(useAppStore.getState().nosqlMqlQuery).toBe(mql);
        expect(useAppStore.getState().nosqlViewMode).toBe('tree');
        expectDraftOnly();
    });

    it('keeps explicit Insert draft-only for mongodb+srv while AI is off', () => {
        mocks.enabled = false;
        useAppStore.setState({ connections: [{ id: 'connection-1', name: 'Fixture', type: 'mongodb+srv' }] });
        render(<NoSqlShell />);
        fireEvent.click(screen.getAllByTitle('Insert into editor')[0]);
        expect(mocks.setNosqlMqlQuery).toHaveBeenCalledExactlyOnceWith(mql);
        expect(mocks.setNosqlViewMode).toHaveBeenCalledExactlyOnceWith('tree');
        expectDraftOnly();
    });

    it('applies a suggested pipeline once as editor text without an execute claim', () => {
        render(<NoSqlShell />);
        fireEvent.click(screen.getAllByTitle('Insert into editor')[2]);
        expect(mocks.setNosqlMqlQuery).toHaveBeenCalledExactlyOnceWith(pipeline);
        expect(useAppStore.getState().nosqlMqlQuery).toBe(pipeline);
        expectDraftOnly();
    });

    it('does not write the view mode again when the draft editor is already visible', () => {
        useAppStore.setState({ nosqlViewMode: 'tree' });
        render(<NoSqlShell />);
        fireEvent.click(screen.getAllByTitle('Insert into editor')[1]);
        expect(mocks.setNosqlMqlQuery).toHaveBeenCalledExactlyOnceWith(mql);
        expect(mocks.setNosqlViewMode).not.toHaveBeenCalled();
        expectDraftOnly();
    });

    it('rejects a draft callback after the active connection changes to SQL', () => {
        render(<NoSqlShell />);
        const apply = screen.getAllByTitle('Insert into editor')[1];
        act(() => { useAppStore.setState({ connections: [{ id: 'connection-1', name: 'Fixture', type: 'postgres' }] }); });
        fireEvent.click(apply);
        expect(mocks.setNosqlMqlQuery).not.toHaveBeenCalled();
        expect(mocks.setNosqlViewMode).not.toHaveBeenCalled();
        expectDraftOnly();
    });
});
