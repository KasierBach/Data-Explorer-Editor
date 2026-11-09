import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createAiChatSlice, findAiMessage, type AiChatSlice, type AiMessage } from './aiChatSlice';
import type { AiMessagePersistenceResult } from '../../AiChatService';

const aiChatServiceMocks = vi.hoisted(() => ({
  fetchChats: vi.fn(), loadMessages: vi.fn(), createChat: vi.fn(), deleteChat: vi.fn(),
  saveMessage: vi.fn(), updateChat: vi.fn(), deleteMessage: vi.fn(),
  deleteMessagesAfter: vi.fn(), updateMessage: vi.fn(), editMessageAndTruncate: vi.fn(),
}));
vi.mock('../../AiChatService', () => ({ AiChatService: aiChatServiceMocks }));

const version = '2026-11-09T12:00:00.123Z';
const nextVersion = '2026-11-09T12:00:00.124Z';
const clientId = '123e4567-e89b-42d3-a456-426614174000';
const aiId = '123e4567-e89b-42d3-a456-426614174001';
const persisted = (id = clientId, chatUpdatedAt = nextVersion): AiMessagePersistenceResult => ({
  id, updatedAt: chatUpdatedAt, chatUpdatedAt, persistence: { state: 'saved' },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const message = (id = clientId, role: AiMessage['role'] = 'user'): AiMessage => ({ id, role, content: 'hello', timestamp: 1 });
function makeStore(messages: AiMessage[] = []) {
  const store = createStore<AiChatSlice>()(createAiChatSlice);
  store.setState({ aiChats: [{ id: 'chat-1', title: 'Chat', createdAt: 1, updatedAt: Date.parse(version), serverUpdatedAt: version, messages }], activeAiChatId: 'chat-1' });
  return store;
}

function editResult(content = 'edited', id = clientId) {
  return { ...persisted(id), deletedCount: 1, message: { ...message(id), content, delivery: 'saved' as const } };
}

describe('aiChatSlice persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    aiChatServiceMocks.saveMessage.mockImplementation(async (_chatId, input) => persisted(input.id));
    aiChatServiceMocks.updateMessage.mockImplementation(async (_chatId, id) => persisted(id));
    aiChatServiceMocks.updateChat.mockResolvedValue({ updatedAt: nextVersion });
    aiChatServiceMocks.deleteMessage.mockResolvedValue({ success: true, chatUpdatedAt: nextVersion });
    aiChatServiceMocks.deleteChat.mockResolvedValue(undefined);
  });

  it('uses a currently available default model', () => {
    expect(makeStore().getState().aiModel).toBe('groq:openai/gpt-oss-120b');
  });

  it('preserves final A02 provenance through updates, sync and reload', async () => {
    const store = makeStore();
    await store.getState().addAiMessage('chat-1', { ...message(aiId, 'ai'), content: '' });
    const finalMessage: AiMessage = { ...message(aiId, 'ai'), content: 'Final answer',
      sources: ['https://example.com/reference'], usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
      warnings: ['Coverage is limited'], generationId: 'server-generation-1', contractVersion: 1,
      modelInfo: { provider: 'gemini', model: 'fixture-model', routingMode: 'best' },
    };
    store.getState().updateAiMessage('chat-1', aiId, finalMessage);
    expect(store.getState().aiChats[0].messages[0]).toMatchObject(finalMessage);
    const saved = await store.getState().syncAiMessage('chat-1', finalMessage);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledWith('chat-1', expect.objectContaining(finalMessage), { expectedUpdatedAt: version });
    aiChatServiceMocks.loadMessages.mockResolvedValue({ messages: [saved], serverUpdatedAt: nextVersion });
    await store.getState().loadAiChatMessages('chat-1');
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ ...finalMessage, delivery: 'saved' });
  });

  it('reconciles a server ID and retains stable generation references', async () => {
    const store = makeStore();
    aiChatServiceMocks.saveMessage.mockResolvedValue(persisted('server-id'));
    const saved = await store.getState().addAiMessage('chat-1', message('legacy-local-id'));
    expect(saved).toMatchObject({ id: 'server-id', clientId: 'legacy-local-id', delivery: 'saved' });
    store.getState().updateAiMessage('chat-1', 'legacy-local-id', { content: 'late generation update', id: 'legacy-local-id' });
    expect(findAiMessage(store.getState().aiChats[0], 'legacy-local-id')).toMatchObject({ id: 'server-id', content: 'late generation update' });
    expect(store.getState().aiChats[0]).toMatchObject({ serverUpdatedAt: nextVersion });
  });

  it('awaits pending saves before PATCHing with the canonical ID and latest version', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const sync = store.getState().syncAiMessage('chat-1', { ...message(), content: 'updated' });
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    expect(aiChatServiceMocks.updateMessage).not.toHaveBeenCalled();
    saving.resolve(persisted('canonical-id'));
    await Promise.all([add, sync]);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledWith('chat-1', 'canonical-id', expect.objectContaining({ content: 'updated' }), { expectedUpdatedAt: nextVersion });
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ id: 'canonical-id', clientId, content: 'updated', delivery: 'saved' });
  });

  it('deduplicates repeated saves and PATCHes changed saved content', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const sync = store.getState().syncAiMessage('chat-1', message());
    saving.resolve(persisted());
    await Promise.all([add, sync]);
    await store.getState().syncAiMessage('chat-1', message());
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateMessage).not.toHaveBeenCalled();
    store.getState().updateAiMessage('chat-1', clientId, { content: 'changed' });
    await store.getState().syncAiMessage('chat-1', { ...message(), content: 'changed' });
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
  });

  it.each([
    { usageCoverage: 'partial', attemptCount: 3, measuredAttemptCount: 1, costCoverage: 'unavailable',
      usage: null, observedUsage: { promptTokens: 4, completionTokens: null, totalTokens: null } },
    { usageCoverage: 'complete', attemptCount: 1, measuredAttemptCount: 1, costCoverage: 'unavailable',
      usage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 }, observedUsage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 } },
    { usageCoverage: 'unavailable', attemptCount: 2, measuredAttemptCount: 0, costCoverage: 'unavailable', usage: null, observedUsage: null },
  ])('retains execution metadata through final sync and a fresh-store reload: %j', async (metadata) => {
    const store = makeStore();
    await store.getState().addAiMessage('chat-1', { ...message(aiId, 'ai'), content: '' });
    const finalMessage = { ...message(aiId, 'ai'), content: 'Final answer', generationId: 'received-generation', ...metadata } as AiMessage;
    store.getState().updateAiMessage('chat-1', aiId, finalMessage);
    const saved = await store.getState().syncAiMessage('chat-1', finalMessage);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledWith('chat-1', expect.objectContaining(finalMessage), { expectedUpdatedAt: version });
    aiChatServiceMocks.loadMessages.mockResolvedValue({ messages: [JSON.parse(JSON.stringify(saved))], serverUpdatedAt: nextVersion });
    const reloaded = makeStore();
    await reloaded.getState().loadAiChatMessages('chat-1');
    expect(reloaded.getState().aiChats[0].messages[0]).toMatchObject({ ...finalMessage, delivery: 'saved' });
  });

  it.each([
    { name: 'usage coverage', before: {}, after: { usageCoverage: 'partial' } },
    { name: 'attempt count', before: {}, after: { attemptCount: 2 } },
    { name: 'measured attempt count', before: {}, after: { measuredAttemptCount: 1 } },
    { name: 'cost coverage', before: {}, after: { costCoverage: 'unavailable' } },
    { name: 'observed usage', before: {}, after: { observedUsage: { promptTokens: 0 } } },
    { name: 'observed prompt', before: { observedUsage: { promptTokens: 0 } }, after: { observedUsage: { promptTokens: null } } },
    { name: 'observed output', before: { observedUsage: { completionTokens: 0 } }, after: { observedUsage: { completionTokens: null } } },
    { name: 'observed total', before: { observedUsage: { totalTokens: 0 } }, after: { observedUsage: { totalTokens: null } } },
    { name: 'usage absent to null', before: {}, after: { usage: null } },
    { name: 'usage null to absent', before: { usage: null }, after: { usage: undefined } },
    { name: 'observed usage absent to null', before: {}, after: { observedUsage: null } },
    { name: 'observed usage null to absent', before: { observedUsage: null }, after: { observedUsage: undefined } },
  ])('PATCHes only changed $name metadata and deduplicates the next identical sync', async ({ before, after }) => {
    const store = makeStore();
    const initial = { ...message(aiId, 'ai'), generationId: 'same-generation', ...before } as AiMessage;
    await store.getState().addAiMessage('chat-1', initial);
    await store.getState().syncAiMessage('chat-1', initial);
    const changed = { ...initial, ...after } as AiMessage;
    store.getState().updateAiMessage('chat-1', aiId, changed);
    await store.getState().syncAiMessage('chat-1', changed);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledWith('chat-1', aiId, expect.objectContaining(changed), { expectedUpdatedAt: nextVersion });
    await store.getState().syncAiMessage('chat-1', changed);
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledTimes(1);
    expect(store.getState().aiChats[0].messages).toHaveLength(1);
  });

  it('waits for a pending POST before PATCHing metadata-only updates with the canonical ID', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValueOnce(saving.promise);
    const initial = { ...message(aiId, 'ai'), generationId: 'same-generation' };
    await store.getState().addAiMessage('chat-1', initial);
    const first = store.getState().syncAiMessage('chat-1', initial);
    const updated = { ...initial, usage: null, usageCoverage: 'partial', attemptCount: 2, measuredAttemptCount: 1,
      costCoverage: 'unavailable', observedUsage: { promptTokens: 0, completionTokens: null, totalTokens: null } } as AiMessage;
    const second = store.getState().syncAiMessage('chat-1', updated);
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    expect(aiChatServiceMocks.updateMessage).not.toHaveBeenCalled();
    saving.resolve(persisted('canonical-id'));
    await Promise.all([first, second]);
    expect(aiChatServiceMocks.updateMessage).toHaveBeenCalledWith('chat-1', 'canonical-id', expect.objectContaining({ ...updated, id: 'canonical-id' }), { expectedUpdatedAt: nextVersion });
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ ...updated, id: 'canonical-id', clientId: aiId, delivery: 'saved' });
  });

  it('rejects failed saves, retains history and exposes delivery errors', async () => {
    const store = makeStore([message(aiId, 'ai')]);
    const failure = Object.assign(new Error('Chat changed'), { statusCode: 409, reason: 'conflict' });
    aiChatServiceMocks.saveMessage.mockRejectedValue(failure);
    await expect(store.getState().addAiMessage('chat-1', message())).rejects.toBe(failure);
    expect(store.getState().aiChats[0].messages).toHaveLength(2);
    expect(store.getState().aiChats[0].messages[1]).toMatchObject({ content: 'hello', delivery: 'failed', deliveryError: { message: 'Chat changed', statusCode: 409, reason: 'conflict' } });
    expect(aiChatServiceMocks.updateChat).not.toHaveBeenCalled();
    await expect(store.getState().waitForAiMessagePersistence('chat-1', clientId)).rejects.toThrow('Chat changed');
  });

  it('does not retry POST implicitly when a preceding pending save fails', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const sync = store.getState().syncAiMessage('chat-1', { ...message(), content: 'updated' });
    const addFailure = expect(add).rejects.toThrow('offline');
    const syncFailure = expect(sync).rejects.toThrow('offline');
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    saving.reject(new Error('offline'));
    await Promise.all([addFailure, syncFailure]);
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateMessage).not.toHaveBeenCalled();
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ content: 'updated', delivery: 'failed' });
  });

  it('allows a failed save retry without adding another local message', async () => {
    const store = makeStore();
    aiChatServiceMocks.saveMessage.mockRejectedValueOnce(new Error('offline'));
    await expect(store.getState().addAiMessage('chat-1', message())).rejects.toThrow('offline');
    await store.getState().syncAiMessage('chat-1', message());
    expect(store.getState().aiChats[0].messages).toHaveLength(1);
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ delivery: 'saved', deliveryError: undefined });
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(2);
  });

  it('returns the persisted message from the explicit await seam', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const wait = store.getState().waitForAiMessagePersistence('chat-1', clientId);
    saving.resolve(persisted('canonical-id'));
    await add;
    expect(await wait).toMatchObject({ id: 'canonical-id', clientId, delivery: 'saved' });
  });

  it('saves local AI messages only on explicit final sync', async () => {
    const store = makeStore();
    expect(await store.getState().addAiMessage('chat-1', { ...message(aiId, 'ai'), content: '' })).toMatchObject({ delivery: 'local' });
    await store.getState().syncAiMessage('chat-1', { ...message(aiId, 'ai'), content: '' });
    expect(aiChatServiceMocks.saveMessage).not.toHaveBeenCalled();
    store.getState().updateAiMessage('chat-1', aiId, { delivery: 'interrupted', deliveryError: { message: 'Stopped' } });
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ delivery: 'interrupted' });
  });

  it('retains exact server versions and failed local history during load', async () => {
    const failed: AiMessage = { ...message(aiId, 'ai'), delivery: 'failed', deliveryError: { message: 'offline' } };
    const store = makeStore([failed]);
    aiChatServiceMocks.loadMessages.mockResolvedValue({ messages: [message()], serverUpdatedAt: nextVersion });
    await store.getState().loadAiChatMessages('chat-1');
    expect(aiChatServiceMocks.loadMessages).toHaveBeenCalledWith('chat-1', true);
    expect(store.getState().aiChats[0]).toMatchObject({ serverUpdatedAt: nextVersion, updatedAt: Date.parse(nextVersion) });
    expect(store.getState().aiChats[0].messages).toEqual([expect.objectContaining({ id: clientId, delivery: 'saved' }), failed]);
  });

  it('preserves the client alias after reloading its canonical server ID', async () => {
    const store = makeStore();
    aiChatServiceMocks.saveMessage.mockResolvedValue(persisted('canonical-id'));
    await store.getState().addAiMessage('chat-1', message('legacy-local-id'));
    aiChatServiceMocks.loadMessages.mockResolvedValue({ messages: [message('canonical-id')], serverUpdatedAt: nextVersion });
    await store.getState().loadAiChatMessages('chat-1');
    expect(findAiMessage(store.getState().aiChats[0], 'legacy-local-id')).toMatchObject({ id: 'canonical-id', clientId: 'legacy-local-id' });
  });

  it('performs one atomic edit before changing or truncating local history', async () => {
    const original = [message(), message(aiId, 'ai')];
    const store = makeStore(original);
    const editing = deferred<ReturnType<typeof editResult>>();
    aiChatServiceMocks.editMessageAndTruncate.mockReturnValue(editing.promise);
    const edit = store.getState().editAiMessage('chat-1', clientId, 'edited');
    await vi.waitFor(() => expect(aiChatServiceMocks.editMessageAndTruncate).toHaveBeenCalledTimes(1));
    expect(store.getState().aiChats[0].messages).toEqual(original);
    editing.resolve(editResult('server-normalized', 'canonical-id'));
    await edit;
    expect(aiChatServiceMocks.editMessageAndTruncate).toHaveBeenCalledWith('chat-1', clientId, expect.objectContaining({ content: 'edited' }), { expectedUpdatedAt: version });
    expect(store.getState().aiChats[0].messages).toEqual([expect.objectContaining({ id: 'canonical-id', clientId, content: 'server-normalized', delivery: 'saved' })]);
    expect(store.getState().aiChats[0].serverUpdatedAt).toBe(nextVersion);
    expect(aiChatServiceMocks.deleteMessagesAfter).not.toHaveBeenCalled();
    expect(aiChatServiceMocks.updateMessage).not.toHaveBeenCalled();
    expect(aiChatServiceMocks.saveMessage).not.toHaveBeenCalled();
  });

  it('leaves all local edit history unchanged on atomic failure', async () => {
    const store = makeStore([message(), message(aiId, 'ai')]);
    const before = store.getState().aiChats;
    aiChatServiceMocks.editMessageAndTruncate.mockRejectedValue(new Error('conflict'));
    await expect(store.getState().editAiMessage('chat-1', clientId, 'edited')).rejects.toThrow('conflict');
    expect(store.getState().aiChats).toBe(before);
    expect(aiChatServiceMocks.deleteMessagesAfter).not.toHaveBeenCalled();
  });

  it('awaits save before an atomic edit and never PATCHes an unsaved local ID', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    aiChatServiceMocks.editMessageAndTruncate.mockResolvedValue(editResult('edited', 'canonical-id'));
    const add = store.getState().addAiMessage('chat-1', message('local-id'));
    const edit = store.getState().editAiMessage('chat-1', 'local-id', 'edited');
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    expect(aiChatServiceMocks.editMessageAndTruncate).not.toHaveBeenCalled();
    saving.resolve(persisted('canonical-id'));
    await Promise.all([add, edit]);
    expect(aiChatServiceMocks.editMessageAndTruncate).toHaveBeenCalledWith('chat-1', 'canonical-id', expect.any(Object), { expectedUpdatedAt: nextVersion });
  });

  it('ignores late saves after chat deletion and issues no title follow-up', async () => {
    const store = makeStore();
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const rejected = expect(add).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    await store.getState().deleteAiChat('chat-1');
    saving.resolve(persisted());
    await rejected;
    expect(store.getState().aiChats).toEqual([]);
    expect(aiChatServiceMocks.updateChat).not.toHaveBeenCalled();
  });

  it('guards in-flight writes when logout resets state directly', async () => {
    const base = makeStore();
    const store = base as unknown as StoreApi<AiChatSlice & { isAuthenticated: boolean; user: { id: string } | null }>;
    store.setState({ isAuthenticated: true, user: { id: 'actor-a' } });
    const saving = deferred<AiMessagePersistenceResult>();
    aiChatServiceMocks.saveMessage.mockReturnValue(saving.promise);
    const add = store.getState().addAiMessage('chat-1', message());
    const rejected = expect(add).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1));
    store.setState({ isAuthenticated: false, user: null, aiChats: [], activeAiChatId: null });
    store.setState({ isAuthenticated: true, user: { id: 'actor-b' }, aiChats: [{ id: 'chat-1', title: 'Other actor', createdAt: 1, updatedAt: 1, messages: [message()] }] });
    saving.resolve(persisted('old-actor-id'));
    await rejected;
    expect(store.getState().aiChats[0].messages[0].id).toBe(clientId);
    expect(aiChatServiceMocks.updateChat).not.toHaveBeenCalled();
  });

  it('clearAiChats invalidates deferred create and fetch responses', async () => {
    const store = makeStore();
    const creating = deferred<{ id: string; title: string; createdAt: string; updatedAt: string }>();
    const fetching = deferred<AiChatSlice['aiChats']>();
    aiChatServiceMocks.createChat.mockReturnValue(creating.promise);
    aiChatServiceMocks.fetchChats.mockReturnValue(fetching.promise);
    const create = store.getState().createAiChat();
    const fetch = store.getState().fetchAiChats();
    store.getState().clearAiChats();
    creating.resolve({ id: 'late', title: 'late', createdAt: version, updatedAt: version });
    fetching.resolve([{ id: 'late', title: 'late', createdAt: 1, updatedAt: 1, messages: [] }]);
    expect(await create).toBeNull();
    await fetch;
    expect(store.getState().aiChats).toEqual([]);
    expect(store.getState().isFetchingAiChats).toBe(false);
  });

  it('requires reload rather than blindly retrying an ambiguous legacy non-UUID save', async () => {
    const store = makeStore();
    aiChatServiceMocks.saveMessage.mockRejectedValueOnce(new Error('connection lost'));
    await expect(store.getState().addAiMessage('chat-1', message('legacy-local-id'))).rejects.toThrow('connection lost');
    await expect(store.getState().syncAiMessage('chat-1', message('legacy-local-id'))).rejects.toThrow('Reload before retrying');
    expect(aiChatServiceMocks.saveMessage).toHaveBeenCalledTimes(1);
    expect(store.getState().aiChats[0].messages[0]).toMatchObject({ delivery: 'failed', content: 'hello' });
  });

  it('uses the version from the loaded snapshot even if the prior local version is newer', async () => {
    const store = makeStore();
    const loadedVersion = '2026-11-09T12:00:00.100Z';
    aiChatServiceMocks.loadMessages.mockResolvedValue({ messages: [message()], serverUpdatedAt: loadedVersion });
    await store.getState().loadAiChatMessages('chat-1');
    expect(store.getState().aiChats[0].serverUpdatedAt).toBe(loadedVersion);
    expect(store.getState().aiChats[0].updatedAt).toBe(Date.parse(loadedVersion));
  });

  it('supports stored CRUD while AI generation is disabled', async () => {
    const store = makeStore([message()]);
    store.setState({ aiEnabled: false } as Partial<AiChatSlice>);
    aiChatServiceMocks.editMessageAndTruncate.mockResolvedValue(editResult());
    await store.getState().editAiMessage('chat-1', clientId, 'edited');
    await store.getState().updateAiChatTitle('chat-1', 'renamed');
    await store.getState().deleteAiMessage('chat-1', clientId);
    await store.getState().deleteAiChat('chat-1');
    expect(aiChatServiceMocks.editMessageAndTruncate).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.updateChat).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.deleteMessage).toHaveBeenCalledTimes(1);
    expect(aiChatServiceMocks.deleteChat).toHaveBeenCalledTimes(1);
  });
});
