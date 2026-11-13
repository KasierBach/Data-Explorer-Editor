import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant } from './AiAssistant';

const mocks = vi.hoisted(() => ({
    enabled: true, isSaving: false,
    setEnabled: vi.fn(),
    updateAiPreferences: vi.fn(),
    fetchAiChats: vi.fn(),
    loadAiChatMessages: vi.fn(),
    createAiChat: vi.fn(),
    success: vi.fn(), error: vi.fn(),
    stop: vi.fn(), edit: vi.fn(), regenerate: vi.fn(),
    bubbleProps: vi.fn(),
}));
const store = {
    lang: 'en', aiModel: 'fixture-model', aiMode: 'fast', aiRoutingMode: 'auto',
    setAiModel: vi.fn(), setAiMode: vi.fn(), setAiRoutingMode: vi.fn(),
    activeConnectionId: 'connection-1', activeDatabase: 'fixture-db',
    connections: [{ id: 'connection-1', type: 'postgres', name: 'Fixture' }],
    tabs: [], activeTabId: undefined,
    aiChats: [{ id: 'chat-1', title: 'Saved chat', messages: [{ id: 'message-1', role: 'ai', content: 'Saved answer' }] }],
    activeAiChatId: 'chat-1', isFetchingAiChats: false,
    fetchAiChats: mocks.fetchAiChats, loadAiChatMessages: mocks.loadAiChatMessages,
    createAiChat: mocks.createAiChat, setActiveAiChat: vi.fn(),
};
vi.mock('@/core/services/store', () => ({ useAppStore: Object.assign(() => store, { getState: () => store }) }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => { if (!mocks.enabled) throw new Error('AI is disabled for this account.'); },
    useAiAccountPolicy: () => ({ enabled: mocks.enabled, isSaving: mocks.isSaving, setEnabled: mocks.setEnabled }),
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({ enabled: mocks.enabled, customProviders: [], disabledProviders: [] }),
    updateAiPreferences: mocks.updateAiPreferences,
}));
vi.mock('@/presentation/hooks/useAiChat', () => ({ useAiChat: () => ({
    input: '', setInput: vi.fn(), isLoading: false, attachments: [], modelStatuses: {},
    messagesEndRef: { current: null }, fileInputRef: { current: null },
    handleFileSelected: vi.fn(), handlePasteQuery: vi.fn(), handleMentionTable: vi.fn(),
    removeAttachment: vi.fn(), handleSend: vi.fn(), handleKeyDown: vi.fn(), handleRegenerate: mocks.regenerate,
    handleEditSubmit: mocks.edit, handleStop: mocks.stop,
}) }));
vi.mock('./AiChatInput', () => ({ AiChatInput: () => null }));
vi.mock('./AiMessageBubble', () => ({ AiMessageBubble: (props: { msg: { content: string } }) => {
    mocks.bubbleProps(props);
    return <div>{props.msg.content}</div>;
} }));
vi.mock('./AiChatList', () => ({ AiChatList: () => <div>Saved chat history</div> }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

function renderAssistant() {
    return render(<AiAssistant onClose={vi.fn()} onInsertQuery={vi.fn()} onRunQuery={vi.fn()} />);
}

describe('AiAssistant account master switch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
        mocks.enabled = true;
        mocks.isSaving = false;
        mocks.setEnabled.mockResolvedValue(undefined);
    });

    it('forwards pending hook edit and retry promises to the bubble without changing their result', async () => {
        let resolve!: (saved: boolean) => void;
        const pending = new Promise<boolean>(done => { resolve = done; });
        mocks.edit.mockReturnValueOnce(pending);
        mocks.regenerate.mockReturnValueOnce(pending);
        renderAssistant();
        const props = mocks.bubbleProps.mock.calls.at(-1)![0];
        const edit = props.onEditSubmit('message-1', 'Edited prompt');
        const retry = props.onRegenerate('message-1');
        expect(edit).toBe(pending);
        expect(retry).toBe(pending);
        expect(mocks.edit).toHaveBeenCalledWith('chat-1', 'message-1', 'Edited prompt');
        expect(mocks.regenerate).toHaveBeenCalledWith('chat-1', 'message-1');
        await act(async () => { resolve(false); });
        expect(await edit).toBe(false);
        expect(await retry).toBe(false);
    });

    it('waits for the account save before showing success or changing the enabled state', async () => {
        let finish!: () => void;
        mocks.setEnabled.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
        renderAssistant();
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        expect(mocks.setEnabled).toHaveBeenCalledWith(false);
        expect(mocks.success).not.toHaveBeenCalled();
        expect(toggle).toBeChecked();
        await act(async () => { finish(); });
        await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
        expect(mocks.updateAiPreferences).not.toHaveBeenCalled();
    });

    it('keeps AI off after a rejected enable save', async () => {
        mocks.enabled = false;
        mocks.setEnabled.mockRejectedValue(new Error('Policy save failed'));
        renderAssistant();
        const toggle = screen.getByRole('switch');
        fireEvent.click(toggle);
        await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Policy save failed'));
        expect(toggle).not.toBeChecked();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.updateAiPreferences).not.toHaveBeenCalled();
    });

    it('disables the switch during a pending account save', () => {
        mocks.isSaving = true;
        renderAssistant();
        expect(screen.getByRole('switch')).toBeDisabled();
    });

    it('allows explicit stored-chat creation while AI is off', () => {
        mocks.enabled = false;
        renderAssistant();
        fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
        expect(mocks.createAiChat).toHaveBeenCalledTimes(1);
    });

    it('allows reading saved chat history while AI is off', () => {
        mocks.enabled = false;
        renderAssistant();
        expect(screen.getByText('Saved answer')).toBeVisible();
        expect(mocks.fetchAiChats).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Chat history' }));
        expect(screen.getByText('Saved chat history')).toBeVisible();
    });
});
