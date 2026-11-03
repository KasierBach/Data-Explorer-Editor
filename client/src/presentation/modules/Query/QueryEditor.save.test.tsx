import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, type SavedQuery, type Tab } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { QueryEditor } from './QueryEditor';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  connect: vi.fn(),
  executeQuery: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

// Keep the real QueryEditor, save dialog, save service, API session guard and
// persisted store. Only replace Monaco and unrelated workspace surfaces.
vi.mock('@/presentation/components/code-editor/SqlEditor', () => ({
  SqlEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="SQL editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('@/core/services/ConnectionService', () => ({
  connectionService: { getAdapter: () => ({ connect: mocks.connect, executeQuery: mocks.executeQuery }) },
}));
vi.mock('@/core/services/aiPreferences', () => ({
  useAiPreferences: () => ({ customProviders: [], disabledProviders: [] }),
  resolveAiSelection: () => ({ model: 'fixture-model' }),
}));
vi.mock('@/presentation/hooks/useSchemaInfo', () => ({ useSchemaInfo: () => ({}) }));
vi.mock('@/presentation/hooks/useResourcePresence', () => ({
  useResourcePresence: () => ({ entries: [], isLoading: false }),
}));
vi.mock('@/presentation/hooks/useResponsiveLayoutMode', () => ({
  useResponsiveLayoutMode: () => ({ isCompactMobileLayout: false, isSmallMobile: false }),
}));
vi.mock('@/presentation/hooks/useVerticalResizablePanel', () => ({
  useVerticalResizablePanel: () => ({ height: 300, isDragging: false, startResizing: vi.fn() }),
}));
vi.mock('./hooks', () => ({ useQueryDashboard: () => ({ isDashboardDialogOpen: false }) }));
vi.mock('./components/QueryToolbar', () => ({
  QueryToolbar: ({ onSave }: { onSave: () => void }) => <button onClick={onSave}>Save draft</button>,
}));
vi.mock('./QueryResults', () => ({ QueryResults: () => null }));
vi.mock('./SavedQueriesDialog', () => ({ SavedQueriesDialog: () => null }));
vi.mock('./QueryHistoryDialog', () => ({ QueryHistoryDialog: () => null }));
vi.mock('./ActiveQueriesPanel', () => ({ ActiveQueriesPanel: () => null }));
vi.mock('./SqlSequenceDialog', () => ({ SqlSequenceDialog: () => null }));
vi.mock('./AiQueryExplanationDialog', () => ({ AiQueryExplanationDialog: () => null }));
vi.mock('@/presentation/modules/Dashboard/SaveToDashboardDialog', () => ({ SaveToDashboardDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const STORAGE_KEY = 'data-explorer-storage';
const TAB_ID = 'query-save-boundary';
const SQL = 'SELECT 42 AS saved_sql';
const NEWER_SQL = 'SELECT 43 AS newer_draft';
const RESULT_METADATA = {
  resultTab: 'messages',
  executedQuery: 'SELECT 1 AS previous_run',
  pageIndex: 2,
  pageSize: 50,
  totalCount: 123,
};
const initialState = useAppStore.getInitialState();
const clients: QueryClient[] = [];
type SavePath = 'create dialog' | 'owner toolbar' | 'owner dialog';

function savedQuery(overrides: Partial<SavedQuery> = {}): SavedQuery {
  return {
    id: 'saved-before', name: 'Saved report', sql: 'SELECT 0 AS old_sql',
    visibility: 'private', tags: [], isOwner: true,
    createdAt: '2026-11-03T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z',
    ...overrides,
  };
}

function metadata() {
  return useAppStore.getState().tabs.find((tab) => tab.id === TAB_ID)?.metadata;
}

function persistedTabs(): Tab[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.tabs;
}

function persistedSql() {
  return persistedTabs().find((tab) => tab.id === TAB_ID)?.metadata?.sql;
}

function Workspace() {
  const { tabs, activeTabId } = useAppStore();
  return tabs.map((tab) => (
    <section key={tab.id} data-testid={tab.id} hidden={tab.id !== activeTabId}>
      <QueryEditor tabId={tab.id} isActive={tab.id === activeTabId} />
    </section>
  ));
}

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><Workspace /></QueryClientProvider>);
}

function editor(tabId = TAB_ID) {
  return within(screen.getByTestId(tabId)).getByLabelText('SQL editor');
}

function prepare(path: SavePath) {
  const existing = savedQuery({ isOwner: path !== 'owner dialog' });
  useAppStore.setState({
    tabs: [{
      id: TAB_ID, title: 'Query 1', type: 'query',
      metadata: { ...RESULT_METADATA, sql: '', ...(path === 'create dialog' ? {} : { savedQueryId: existing.id }) },
    }],
    activeTabId: TAB_ID,
    savedQueries: path === 'create dialog' ? [] : [existing],
  });
  const view = renderWorkspace();
  fireEvent.change(editor(), { target: { value: SQL } });
  return view;
}

function submit(path: SavePath) {
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  if (path === 'owner toolbar') return;
  if (path === 'owner dialog') {
    // Ownership can arrive while the create/copy form is already open.
    act(() => useAppStore.getState().setSavedQueries([savedQuery()]));
  }
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {
    name: path === 'owner dialog' ? 'Update' : 'Save query',
  }));
}

function pendingSave() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => { resolve = resolvePromise; });
  const requests: Array<{ method?: string; sql: string; tabSql?: string; storedSql?: string }> = [];
  mocks.fetch.mockImplementation((url: string, options: RequestInit) => {
    if (options.method === 'GET' && url.endsWith('/organizations')) {
      return Promise.resolve(new Response('[]', { headers: { 'content-type': 'application/json' } }));
    }
    const payload = JSON.parse(options.body as string) as { sql: string };
    requests.push({ method: options.method, sql: payload.sql, tabSql: metadata()?.sql, storedSql: persistedSql() });
    return promise;
  });
  return {
    requests,
    async finish(status = 200) {
      await act(async () => {
        resolve(new Response(JSON.stringify(status === 200 ? savedQuery({ id: 'saved-after', sql: SQL }) : { message: 'Save failed' }), {
          status, headers: { 'content-type': 'application/json' },
        }));
        await promise;
      });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'));
  vi.clearAllMocks();
  localStorage.clear();
  useAppStore.setState({
    ...initialState, lang: 'en', accessToken: 'session-a', user: { id: 'user-a', email: 'a@example.test' },
    connections: [{ id: 'connection-a', type: 'postgres', name: 'Fixture database', database: 'db-a' }],
    activeConnectionId: 'connection-a', activeDatabase: 'db-a',
  }, true);
  apiService.endLogout();
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  apiService.endLogout();
  useAppStore.setState(initialState, true);
  localStorage.clear();
});

describe('QueryEditor save persistence boundary', () => {
  it.each<SavePath>(['create dialog', 'owner toolbar', 'owner dialog'])(
    'persists SQL before the %s request and survives completion/reload without 500ms elapsing',
    async (path) => {
      const pending = pendingSave();
      const view = prepare(path);
      const startedAt = Date.now();
      submit(path);

      expect(pending.requests).toEqual([{
        method: path === 'create dialog' ? 'POST' : 'PATCH', sql: SQL, tabSql: SQL, storedSql: SQL,
      }]);
      expect(metadata()).toMatchObject(RESULT_METADATA);
      await pending.finish();
      expect(Date.now()).toBe(startedAt);
      expect(metadata()?.sql).toBe(SQL);
      expect(persistedSql()).toBe(SQL);
      expect(useAppStore.getState().savedQueries[0]?.sql).toBe(SQL);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      if (path === 'create dialog') expect(metadata()?.savedQueryId).toBe('saved-after');

      // Rehydrate the real persistence layer, then mount a fresh editor: no
      // pending debounce or saved-query list is available to repair the draft.
      const stored = localStorage.getItem(STORAGE_KEY)!;
      view.unmount();
      useAppStore.setState(initialState, true);
      localStorage.setItem(STORAGE_KEY, stored);
      await act(async () => { await useAppStore.persist.rehydrate(); });
      renderWorkspace();
      expect(editor()).toHaveValue(SQL);
      expect(metadata()).toMatchObject(RESULT_METADATA);
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.executeQuery).not.toHaveBeenCalled();
    },
  );

  it.each<SavePath>(['create dialog', 'owner toolbar'])(
    'keeps newer edits and the original tab/scope while %s is in flight',
    async (path) => {
      const pending = pendingSave();
      prepare(path);
      submit(path);
      fireEvent.change(editor(), { target: { value: NEWER_SQL } });
      act(() => {
        useAppStore.getState().openTab({ id: 'query-other', title: 'Query 2', type: 'query', metadata: { sql: 'SELECT 99 AS other_tab' } });
        useAppStore.setState({ activeConnectionId: 'connection-other', activeDatabase: 'db-other' });
      });
      await act(async () => { await vi.advanceTimersByTimeAsync(499); });
      await pending.finish();

      expect(editor()).toHaveValue(NEWER_SQL);
      expect(editor('query-other')).toHaveValue('SELECT 99 AS other_tab');
      expect(useAppStore.getState().activeTabId).toBe('query-other');
      expect(metadata()?.sql).toBe(SQL);
      expect(metadata()).toMatchObject(RESULT_METADATA);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(metadata()?.sql).toBe(NEWER_SQL);
      expect(persistedSql()).toBe(NEWER_SQL);
      expect(persistedTabs().find((tab) => tab.id === 'query-other')?.metadata).toEqual({ sql: 'SELECT 99 AS other_tab' });
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.executeQuery).not.toHaveBeenCalled();
    },
  );

  it.each<SavePath>(['create dialog', 'owner toolbar'])(
    'does not apply an old %s response to a replacement session',
    async (path) => {
      const pending = pendingSave();
      prepare(path);
      submit(path);
      act(() => {
        apiService.beginLogout();
        useAppStore.getState().logout();
        apiService.endLogout();
        useAppStore.getState().login('session-b', { id: 'user-b', email: 'b@example.test' }, 2_000_000_000);
        useAppStore.getState().openTab({ id: TAB_ID, title: 'Replacement query', type: 'query', metadata: { sql: NEWER_SQL } });
      });
      await pending.finish();
      expect(useAppStore.getState().user?.id).toBe('user-b');
      expect(useAppStore.getState().savedQueries).toEqual([]);
      expect(metadata()).toEqual({ sql: NEWER_SQL });
      expect(persistedSql()).toBe(NEWER_SQL);
      expect(editor()).toHaveValue(NEWER_SQL);
      expect(mocks.success).not.toHaveBeenCalled();
      expect(mocks.connect).not.toHaveBeenCalled();
      expect(mocks.executeQuery).not.toHaveBeenCalled();
    },
  );

  it('retains the 500ms debounce for ordinary editing and result metadata', async () => {
    prepare('create dialog');
    await act(async () => { await vi.advanceTimersByTimeAsync(499); });
    expect(metadata()?.sql).toBe('');
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(metadata()).toMatchObject({ ...RESULT_METADATA, sql: SQL });
    expect(persistedSql()).toBe(SQL);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.executeQuery).not.toHaveBeenCalled();
  });
});
