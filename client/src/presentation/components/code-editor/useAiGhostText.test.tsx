import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import type { CancellationToken, editor, languages, Position } from 'monaco-editor';
import { useAiGhostText } from './useAiGhostText';

const mocks = vi.hoisted(() => ({
    enabled: true,
    accountId: 'account-1',
    autocompleteModel: 'fixture-model',
    customProviders: [],
    disabledProviders: ['groq', 'cerebras'],
    schemaStats: [],
    editors: [] as editor.IStandaloneCodeEditor[],
    getEditors: vi.fn(),
    getAutocomplete: vi.fn(),
    register: vi.fn(),
    dispose: vi.fn(),
}));

vi.mock('@/core/services/AiService', () => ({ aiService: { getAutocomplete: mocks.getAutocomplete } }));
vi.mock('@/core/services/aiAccountPolicy', () => ({
    isAiEnabled: () => mocks.enabled,
    assertAiEnabled: () => {
        if (!mocks.enabled) throw new Error('AI is disabled for this account.');
    },
}));
vi.mock('@/core/services/store', () => ({
    useAppStore: Object.assign((selector: (state: Record<string, unknown>) => unknown) => selector({
        user: { id: mocks.accountId },
        aiModel: 'fixture-model', nosqlActiveCollection: 'movies', nosqlSchemaStats: mocks.schemaStats,
    }), {
        getState: () => ({ user: { id: mocks.accountId } }),
    }),
}));
vi.mock('@/core/services/aiPreferences', () => ({
    useAiPreferences: () => ({
        enabled: mocks.enabled,
        assistantModel: 'fixture-model',
        autocompleteModel: mocks.autocompleteModel,
        customProviders: mocks.customProviders,
        disabledProviders: mocks.disabledProviders,
        fallbackProvider: 'none',
    }),
    resolveAiSelection: () => ({ model: mocks.autocompleteModel, providerOverride: undefined }),
}));

const monaco = {
    languages: { registerInlineCompletionsProvider: mocks.register },
    editor: { getEditors: mocks.getEditors },
} as unknown as Monaco;

function fixturePosition(lineNumber: number, column: number): Position {
    return {
        lineNumber,
        column,
        with: (line = lineNumber, nextColumn = column) => fixturePosition(line, nextColumn),
        delta: (lineDelta = 0, columnDelta = 0) => fixturePosition(lineNumber + lineDelta, column + columnDelta),
        equals: (other) => lineNumber === other.lineNumber && column === other.column,
        isBefore: (other) => lineNumber < other.lineNumber || (lineNumber === other.lineNumber && column < other.column),
        isBeforeOrEqual: (other) => lineNumber < other.lineNumber || (lineNumber === other.lineNumber && column <= other.column),
        clone: () => fixturePosition(lineNumber, column),
        toString: () => `(${lineNumber},${column})`,
        toJSON: () => ({ lineNumber, column }),
    };
}

function fixtureModel(text = 'select customer ', uri = 'inmemory://ghost.sql') {
    const state = { text, uri, versionId: 1, disposed: false };
    const model = {
        uri: { toString: () => state.uri },
        isDisposed: vi.fn(() => state.disposed),
        getVersionId: vi.fn(() => state.versionId),
        getLineContent: vi.fn(() => state.text),
        getValueInRange: vi.fn((range: { startColumn: number; endColumn: number }) =>
            state.text.slice(range.startColumn - 1, range.endColumn - 1)),
        getLineCount: vi.fn(() => 1),
        getLineMaxColumn: vi.fn(() => state.text.length + 1),
    } as unknown as editor.ITextModel;
    return { model, state };
}

function fixtureEditor(model: editor.ITextModel, position = fixturePosition(1, 17)) {
    const state: { model: editor.ITextModel | null; position: Position | null; focused: boolean } = {
        model, position, focused: true,
    };
    const instance = {
        getModel: vi.fn(() => state.model),
        getPosition: vi.fn(() => state.position),
        hasTextFocus: vi.fn(() => state.focused),
    } as unknown as editor.IStandaloneCodeEditor;
    mocks.editors.push(instance);
    return { instance, state };
}

function fixtureCancellation() {
    let canceled = false;
    let listener: (() => void) | undefined;
    const dispose = vi.fn(() => { listener = undefined; });
    const token = {
        get isCancellationRequested() { return canceled; },
        onCancellationRequested: vi.fn((callback: () => void) => {
            listener = callback;
            return { dispose };
        }),
    } as unknown as CancellationToken;
    return { token, dispose, cancel: () => { canceled = true; listener?.(); } };
}

function requestCompletion(options: {
    model?: editor.ITextModel;
    requestEditor?: ReturnType<typeof fixtureEditor>;
    cancellation?: ReturnType<typeof fixtureCancellation>;
    providerIndex?: number;
    position?: Position;
} = {}) {
    const provider = mocks.register.mock.calls[options.providerIndex ?? 0][1] as languages.InlineCompletionsProvider;
    const model = options.model ?? fixtureModel().model;
    const requestEditor = options.requestEditor ?? fixtureEditor(model);
    const cancellation = options.cancellation ?? fixtureCancellation();
    const position = options.position ?? requestEditor.state.position ?? fixturePosition(1, 17);
    const result = provider.provideInlineCompletions(model, position, {} as languages.InlineCompletionContext, cancellation.token);
    return { model, requestEditor, cancellation, result: Promise.resolve(result) };
}

function deferCompletion() {
    let resolve!: (completion: string) => void;
    const result = new Promise<string>((next) => { resolve = next; });
    mocks.getAutocomplete.mockReturnValueOnce(result);
    return { resolve };
}

function requestSignal(index = 0): AbortSignal {
    return mocks.getAutocomplete.mock.calls[index][1] as AbortSignal;
}

async function advanceDebounce() {
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
}

describe('useAiGhostText account policy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mocks.enabled = true;
        mocks.accountId = 'account-1';
        mocks.autocompleteModel = 'fixture-model';
        mocks.editors = [];
        mocks.getEditors.mockImplementation(() => mocks.editors);
        mocks.register.mockReturnValue({ dispose: mocks.dispose });
        mocks.getAutocomplete.mockReset().mockResolvedValue('name');
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it.each(['sql', 'json'])('does not register an inline provider when AI is off for %s', (language) => {
        mocks.enabled = false;
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', language));
        expect(mocks.register).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
    });

    it('unregisters the provider when the account switches off', () => {
        const { rerender } = renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        expect(mocks.register).toHaveBeenCalledTimes(1);
        mocks.enabled = false;
        rerender();
        expect(mocks.dispose).toHaveBeenCalledTimes(1);
        expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    it('drops a completion queued before disable without dispatching', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const { result } = requestCompletion();
        mocks.enabled = false;
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        expect(await result).toBeUndefined();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
    });

    it('does not capture editor text through a stale provider after disable', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        mocks.enabled = false;
        const { model, result } = requestCompletion();
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        await result;
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
        expect(model.getLineContent).not.toHaveBeenCalled();
        expect(model.getValueInRange).not.toHaveBeenCalled();
    });

    it('passes provider exclusions and strict fallback for enabled autocomplete', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const { result } = requestCompletion();
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        expect(await result).toEqual(expect.objectContaining({ items: expect.any(Array) }));
        expect(mocks.getAutocomplete).toHaveBeenCalledWith(expect.objectContaining({
            disabledProviders: ['groq', 'cerebras'], fallbackProvider: 'none',
        }), expect.any(AbortSignal));
        expect(requestSignal().aborted).toBe(false);
    });

    it('does not capture text or dispatch for an already canceled token', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const cancellation = fixtureCancellation();
        cancellation.cancel();
        const request = requestCompletion({ cancellation });
        expect(await request.result).toBeUndefined();
        expect(request.model.getLineContent).not.toHaveBeenCalled();
        expect(request.model.getValueInRange).not.toHaveBeenCalled();
        expect(cancellation.token.onCancellationRequested).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('settles cancellation during the debounce without capturing text or waiting 350ms', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const request = requestCompletion();
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        request.cancellation.cancel();
        expect(await request.result).toBeUndefined();
        expect(request.model.getLineContent).not.toHaveBeenCalled();
        expect(request.model.getValueInRange).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('aborts the service signal and disposes the token listener during a fetch', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const pending = deferCompletion();
        const request = requestCompletion();
        await advanceDebounce();
        expect(requestSignal().aborted).toBe(false);
        request.cancellation.cancel();
        expect(requestSignal().aborted).toBe(true);
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
        pending.resolve('late_name');
        expect(await request.result).toBeUndefined();
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
    });

    it('aborts ALL active fetches and debounces on cleanup and rejects a disposed provider', async () => {
        const hook = renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const firstPending = deferCompletion();
        const secondPending = deferCompletion();
        const first = requestCompletion();
        const second = requestCompletion();
        await advanceDebounce();
        const queued = requestCompletion();
        hook.unmount();
        expect(requestSignal(0).aborted).toBe(true);
        expect(requestSignal(1).aborted).toBe(true);
        for (const request of [first, second, queued]) {
            expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
        }
        expect(vi.getTimerCount()).toBe(0);
        expect(await queued.result).toBeUndefined();
        expect(queued.model.getLineContent).not.toHaveBeenCalled();
        expect(queued.model.getValueInRange).not.toHaveBeenCalled();
        firstPending.resolve('name');
        secondPending.resolve('name');
        expect(await first.result).toBeUndefined();
        expect(await second.result).toBeUndefined();
        const stale = requestCompletion();
        expect(await stale.result).toBeUndefined();
        expect(stale.model.getLineContent).not.toHaveBeenCalled();
        expect(stale.model.getValueInRange).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).toHaveBeenCalledTimes(2);
        expect(mocks.dispose).toHaveBeenCalledTimes(1);
    });

    it.each(['connection', 'database', 'autocomplete model', 'account', 'owning model', 'disabled'])('invalidates an in-flight completion after a %s change', async (change) => {
        const fixture = fixtureModel();
        const hook = renderHook(({ connection, database, owningModel }) =>
            useAiGhostText(monaco, connection, database, 'sql', owningModel), {
            initialProps: { connection: 'connection-1', database: 'fixture-db', owningModel: fixture.model },
        });
        const pending = deferCompletion();
        const request = requestCompletion({ model: fixture.model });
        await advanceDebounce();
        if (change === 'account') mocks.accountId = 'account-2';
        if (change === 'autocomplete model') mocks.autocompleteModel = 'other-model';
        if (change === 'disabled') mocks.enabled = false;
        hook.rerender({
            connection: change === 'connection' ? 'connection-2' : 'connection-1',
            database: change === 'database' ? 'other-db' : 'fixture-db',
            owningModel: change === 'owning model' ? fixtureModel().model : fixture.model,
        });
        expect(requestSignal().aborted).toBe(true);
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
        pending.resolve('name');
        expect(await request.result).toBeUndefined();
    });

    it('rejects an enabled-to-enabled account switch even before the hook rerenders', async () => {
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db'));
        const pending = deferCompletion();
        const request = requestCompletion();
        await advanceDebounce();
        mocks.accountId = 'account-2';
        pending.resolve('name');
        expect(await request.result).toBeUndefined();
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
    });

    it('rejects a model edit during the debounce without capturing changed text', async () => {
        const fixture = fixtureModel();
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', fixture.model));
        const request = requestCompletion({ model: fixture.model });
        fixture.state.versionId++;
        fixture.state.text = 'select private_data ';
        await advanceDebounce();
        expect(await request.result).toBeUndefined();
        expect(fixture.model.getLineContent).not.toHaveBeenCalled();
        expect(fixture.model.getValueInRange).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
    });

    it.each(['version', 'uri', 'cursor', 'editor model', 'disposed model'])('rejects a response after the captured %s changes', async (change) => {
        const fixture = fixtureModel();
        const requestEditor = fixtureEditor(fixture.model);
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', fixture.model));
        const pending = deferCompletion();
        const request = requestCompletion({ model: fixture.model, requestEditor });
        await advanceDebounce();
        if (change === 'version') fixture.state.versionId++;
        if (change === 'uri') fixture.state.uri = 'inmemory://different.sql';
        if (change === 'cursor') requestEditor.state.position = fixturePosition(1, 16);
        if (change === 'editor model') requestEditor.state.model = fixtureModel().model;
        if (change === 'disposed model') fixture.state.disposed = true;
        pending.resolve('name');
        expect(await request.result).toBeUndefined();
        expect(request.cancellation.dispose).toHaveBeenCalledTimes(1);
    });

    it('defers global provider registration while the owning model is null', () => {
        const hook = renderHook(({ model }: { model: editor.ITextModel | null }) =>
            useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', model), {
            initialProps: { model: null as editor.ITextModel | null },
        });
        expect(mocks.register).not.toHaveBeenCalled();
        hook.rerender({ model: fixtureModel().model });
        expect(mocks.register).toHaveBeenCalledTimes(1);
    });

    it('rejects an editor/cursor mismatch before capturing text', async () => {
        const fixture = fixtureModel();
        const requestEditor = fixtureEditor(fixture.model, fixturePosition(1, 16));
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', fixture.model));
        const request = requestCompletion({ model: fixture.model, requestEditor, position: fixturePosition(1, 17) });
        expect(await request.result).toBeUndefined();
        expect(fixture.model.getLineContent).not.toHaveBeenCalled();
        expect(fixture.model.getValueInRange).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
    });

    it('isolates two language-global hooks by owning model identity, even with matching URIs', async () => {
        const firstModel = fixtureModel().model;
        const secondModel = fixtureModel().model;
        const firstEditor = fixtureEditor(firstModel);
        const secondEditor = fixtureEditor(secondModel);
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'first-db', 'sql', firstModel));
        renderHook(() => useAiGhostText(monaco, 'connection-2', 'second-db', 'sql', secondModel));
        const foreignFirst = requestCompletion({ model: secondModel, requestEditor: secondEditor, providerIndex: 0 });
        const foreignSecond = requestCompletion({ model: firstModel, requestEditor: firstEditor, providerIndex: 1 });
        expect(await foreignFirst.result).toBeUndefined();
        expect(await foreignSecond.result).toBeUndefined();
        expect(firstModel.getLineContent).not.toHaveBeenCalled();
        expect(secondModel.getValueInRange).not.toHaveBeenCalled();
        expect(mocks.getAutocomplete).not.toHaveBeenCalled();
        const first = requestCompletion({ model: firstModel, requestEditor: firstEditor, providerIndex: 0 });
        const second = requestCompletion({ model: secondModel, requestEditor: secondEditor, providerIndex: 1 });
        await advanceDebounce();
        expect((await first.result)?.items[0].insertText).toBe('name');
        expect((await second.result)?.items[0].insertText).toBe('name');
        expect(mocks.getAutocomplete.mock.calls[0][0]).toEqual(expect.objectContaining({ connectionId: 'connection-1', database: 'first-db' }));
        expect(mocks.getAutocomplete.mock.calls[1][0]).toEqual(expect.objectContaining({ connectionId: 'connection-2', database: 'second-db' }));
        expect(requestSignal(0)).not.toBe(requestSignal(1));
        expect(requestSignal(0).aborted).toBe(false);
        expect(requestSignal(1).aborted).toBe(false);
    });

    it('cancels the previous debounce when a new request targets the same model', async () => {
        const model = fixtureModel().model;
        const requestEditor = fixtureEditor(model);
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', model));
        const first = requestCompletion({ model, requestEditor });
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        const second = requestCompletion({ model, requestEditor });
        expect(await first.result).toBeUndefined();
        expect(first.cancellation.dispose).toHaveBeenCalledTimes(1);
        expect(model.getLineContent).not.toHaveBeenCalled();
        await advanceDebounce();
        expect((await second.result)?.items[0].insertText).toBe('name');
        expect(mocks.getAutocomplete).toHaveBeenCalledTimes(1);
    });

    it.each([false, true])('cancels a previous same-model fetch across separate hooks=%s', async (separateHooks) => {
        const model = fixtureModel().model;
        const requestEditor = fixtureEditor(model);
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', model));
        if (separateHooks) renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', model));
        const pending = deferCompletion();
        const first = requestCompletion({ model, requestEditor });
        await advanceDebounce();
        const second = requestCompletion({ model, requestEditor, providerIndex: separateHooks ? 1 : 0 });
        expect(requestSignal().aborted).toBe(true);
        expect(first.cancellation.dispose).toHaveBeenCalledTimes(1);
        pending.resolve('old_name');
        expect(await first.result).toBeUndefined();
        await advanceDebounce();
        expect((await second.result)?.items[0].insertText).toBe('name');
        expect(requestSignal(1).aborted).toBe(false);
        expect(second.cancellation.dispose).toHaveBeenCalledTimes(1);
    });

    it('caps before/after context at the existing server limits of 1500/300 characters', async () => {
        const before = 'b'.repeat(1750);
        const after = ';' + 'a'.repeat(350);
        const fixture = fixtureModel(before + after);
        const requestEditor = fixtureEditor(fixture.model, fixturePosition(1, before.length + 1));
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', fixture.model));
        const request = requestCompletion({ model: fixture.model, requestEditor });
        await advanceDebounce();
        expect((await request.result)?.items).toHaveLength(1);
        expect(mocks.getAutocomplete).toHaveBeenCalledWith(expect.objectContaining({
            beforeCursor: before.slice(-1500), afterCursor: after.slice(0, 300),
        }), expect.any(AbortSignal));
    });

    it.each([
        { text: 'select ', column: 8, completion: 'name', expected: undefined },
        { text: 'select customer ', column: 4, completion: 'name', expected: undefined },
        { text: 'select customer', column: 16, completion: 'name', expected: ' name' },
        { text: 'select customer;', column: 17, completion: ';name', expected: 'name' },
        { text: 'select customer ;', column: 17, completion: '; name', expected: 'name' },
        { text: 'select customer  name', column: 17, completion: 'name', expected: undefined },
    ])('keeps popup, spacing, semicolon and duplicate rules for $text at $column', async ({ text, column, completion, expected }) => {
        const fixture = fixtureModel(text);
        const requestEditor = fixtureEditor(fixture.model, fixturePosition(1, column));
        mocks.getAutocomplete.mockResolvedValue(completion);
        renderHook(() => useAiGhostText(monaco, 'connection-1', 'fixture-db', 'sql', fixture.model));
        const request = requestCompletion({ model: fixture.model, requestEditor });
        await advanceDebounce();
        expect((await request.result)?.items[0].insertText).toBe(expected);
    });
});
