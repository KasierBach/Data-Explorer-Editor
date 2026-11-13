import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiMessage } from '@/core/services/store';
import { AiMessageBubble } from './AiMessageBubble';

const mocks = vi.hoisted(() => ({
    enabled: true,
    insert: vi.fn(), run: vi.fn(), regenerate: vi.fn(), edit: vi.fn(),
    copy: vi.fn(), deleteMessage: vi.fn(),
}));
const store = {
    lang: 'en', user: { id: 'account-1', email: 'fixture@example.test' },
    activeConnectionId: 'connection-1', activeAiChatId: 'chat-1',
    connections: [{ id: 'connection-1', type: 'postgres' }],
    deleteAiMessage: mocks.deleteMessage,
};
vi.mock('@/core/services/store', () => ({ useAppStore: () => store }));
vi.mock('@/core/services/aiPreferences', () => ({ useAiPreferences: () => ({ enabled: mocks.enabled }) }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => { if (!mocks.enabled) throw new Error('AI disabled'); },
}));
vi.mock('./AiMarkdownContent', () => ({ AiMarkdownContent: ({ content }: { content: string }) => <div>{content}</div> }));

const message = {
    id: 'message-1', role: 'ai', content: 'Saved answer', sql: 'SELECT 1',
    recommendations: [{ type: 'query_fix', title: 'Correction', summary: 'Saved correction', sql: 'SELECT 2' }],
} as AiMessage;

function renderBubble(runActionLabel?: string) {
    return render(<AiMessageBubble msg={message} onInsertQuery={mocks.insert} onRunQuery={mocks.run}
        onRegenerate={mocks.regenerate} onEditSubmit={mocks.edit} runActionLabel={runActionLabel} />);
}

describe('AiMessageBubble stored-query actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enabled = true;
        store.lang = 'en';
        store.connections[0].type = 'postgres';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } });
    });

    it.each([true, false])('dispatches SQL Run only to its owner with AI enabled=%s', (enabled) => {
        mocks.enabled = enabled;
        renderBubble();
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expect(mocks.run).toHaveBeenCalledExactlyOnceWith('SELECT 1');
        expect(mocks.insert).not.toHaveBeenCalled();
        expect(mocks.regenerate).not.toHaveBeenCalled();
    });

    it.each([true, false])('dispatches recommendation Run only to its owner with AI enabled=%s', (enabled) => {
        mocks.enabled = enabled;
        renderBubble();
        fireEvent.click(screen.getByRole('button', { name: 'Run suggestion' }));
        expect(mocks.run).toHaveBeenCalledExactlyOnceWith('SELECT 2');
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it.each([
        ['Insert into editor', 'SELECT 1'],
        ['Insert suggestion', 'SELECT 2'],
    ])('keeps %s draft-only while AI is off', (label, sql) => {
        mocks.enabled = false;
        renderBubble();
        fireEvent.click(screen.getByTitle(label));
        expect(mocks.insert).toHaveBeenCalledExactlyOnceWith(sql);
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.regenerate).not.toHaveBeenCalled();
        expect(mocks.edit).not.toHaveBeenCalled();
    });

    it('never pre-inserts while the owning Run callback is pending or declines', async () => {
        let decline!: () => void;
        mocks.run.mockReturnValueOnce(new Promise<void>((resolve) => { decline = resolve; }));
        renderBubble();
        fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
        expect(mocks.insert).not.toHaveBeenCalled();
        await act(async () => { decline(); });
        expect(mocks.insert).not.toHaveBeenCalled();
        expect(mocks.run).toHaveBeenCalledTimes(1);
        expect(screen.getByText('SELECT 1')).toBeVisible();
    });

    it('uses the explicit draft-action label for SQL and recommendation actions', () => {
        store.connections[0].type = 'mongodb';
        renderBubble('Insert into editor');
        expect(screen.queryByTitle('Run now')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Run suggestion')).not.toBeInTheDocument();
        const insertActions = screen.getAllByTitle('Insert into editor');
        fireEvent.click(insertActions[1]);
        expect(mocks.run).toHaveBeenCalledExactlyOnceWith('SELECT 1');
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it.each([
        ['en', 'pending', 'Saving…'], ['vi', 'pending', 'Đang lưu…'],
        ['en', 'failed', 'Not saved'], ['vi', 'failed', 'Chưa lưu'],
        ['en', 'interrupted', 'Interrupted'], ['vi', 'interrupted', 'Đã dừng'],
    ] as const)('shows truthful %s %s delivery chrome', (lang, delivery, label) => {
        store.lang = lang;
        render(<AiMessageBubble msg={{ ...message, delivery }} onInsertQuery={mocks.insert} onRunQuery={mocks.run} />);
        expect(screen.getByText(label)).toBeVisible();
        expect(screen.queryByText(lang === 'vi' ? 'Đã lưu' : 'Saved')).not.toBeInTheDocument();
    });

    it('never claims saved when deliveryError remains and exposes retry save separately from Run', async () => {
        mocks.regenerate.mockResolvedValueOnce(true);
        render(<AiMessageBubble msg={{ ...message, delivery: 'saved', deliveryError: { message: 'Offline save' } }}
            onInsertQuery={mocks.insert} onRunQuery={mocks.run} onRegenerate={mocks.regenerate} />);
        expect(screen.getByText('Not saved')).toBeVisible();
        expect(screen.getByText('Offline save')).toBeVisible();
        expect(screen.queryByText('Saved')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
        await waitFor(() => expect(mocks.regenerate).toHaveBeenCalledWith(message.id));
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.insert).not.toHaveBeenCalled();
    });

    it('keeps pending edit text until save settles and preserves it on failure', async () => {
        let resolve!: (saved: boolean) => void;
        mocks.edit.mockReturnValueOnce(new Promise<boolean>(done => { resolve = done; }));
        render(<AiMessageBubble msg={{ ...message, role: 'user', content: 'Original prompt', sql: undefined, recommendations: undefined }}
            onInsertQuery={mocks.insert} onRunQuery={mocks.run} onEditSubmit={mocks.edit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Edit message' }), { target: { value: 'Keep edited draft' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save & Send' }));
        expect(screen.getByRole('textbox')).toHaveValue('Keep edited draft');
        expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        await act(async () => { resolve(false); });
        expect(screen.getByRole('textbox')).toHaveValue('Keep edited draft');
        expect(screen.getByText('Could not save edit. History is unchanged.')).toBeVisible();
        expect(mocks.edit).toHaveBeenCalledExactlyOnceWith(message.id, 'Keep edited draft');
        expect(mocks.run).not.toHaveBeenCalled();
    });

    it('catches rejected edit callbacks without closing or losing the edit draft', async () => {
        mocks.edit.mockRejectedValueOnce(new Error('Atomic edit conflict'));
        render(<AiMessageBubble msg={{ ...message, role: 'user', content: 'Original prompt', delivery: 'saved', sql: undefined, recommendations: undefined }}
            onInsertQuery={mocks.insert} onRunQuery={mocks.run} onEditSubmit={mocks.edit} />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep edited draft' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save & Send' }));
        await waitFor(() => expect(screen.getByText('Atomic edit conflict')).toBeVisible());
        expect(screen.queryByText('Saved')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('Keep edited draft');
    });

    it('preserves A01 provider gates and local copying while AI is off', async () => {
        mocks.enabled = false;
        renderBubble();
        expect(screen.getByRole('button', { name: 'Regenerate message' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Regenerate message' }));
        fireEvent.click(screen.getByRole('button', { name: 'Copy SQL' }));
        await waitFor(() => expect(mocks.copy).toHaveBeenCalledExactlyOnceWith('SELECT 1'));
        expect(mocks.regenerate).not.toHaveBeenCalled();
        expect(mocks.edit).not.toHaveBeenCalled();
    });
});
