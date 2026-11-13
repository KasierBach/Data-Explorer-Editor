import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/services/store";
import { QueryEditor } from "./QueryEditor";

const mocks = vi.hoisted(() => ({
  enabled: true,
  post: vi.fn(),
  executeQuery: vi.fn(),
  onExplain: undefined as undefined | (() => void),
  onRegenerate: undefined as
    undefined | ((prompt?: string) => Promise<void> | void),
}));
vi.mock("@/core/services/api.service", () => ({
  apiService: { post: mocks.post, get: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/core/services/aiAccountPolicy", () => ({
  isAiEnabled: () => mocks.enabled,
  assertAiEnabled: () => {
    if (!mocks.enabled) throw new Error("AI is disabled for this account.");
  },
}));
vi.mock("@/core/services/aiPreferences", () => ({
  useAiPreferences: () => ({
    enabled: mocks.enabled,
    customProviders: [],
    disabledProviders: ["groq"],
    fallbackProvider: "none",
  }),
  resolveAiSelection: () => ({ model: "fixture-model" }),
}));
vi.mock("@/presentation/components/code-editor/SqlEditor", () => ({
  SqlEditor: () => null,
}));
vi.mock("@/core/services/ConnectionService", () => ({
  connectionService: {
    getAdapter: () => ({ executeQuery: mocks.executeQuery }),
  },
}));
vi.mock("@/presentation/hooks/useSchemaInfo", () => ({
  useSchemaInfo: () => ({}),
}));
vi.mock("@/presentation/hooks/useResourcePresence", () => ({
  useResourcePresence: () => ({ entries: [], isLoading: false }),
}));
vi.mock("@/presentation/hooks/useResponsiveLayoutMode", () => ({
  useResponsiveLayoutMode: () => ({
    isCompactMobileLayout: false,
    isSmallMobile: false,
  }),
}));
vi.mock("@/presentation/hooks/useVerticalResizablePanel", () => ({
  useVerticalResizablePanel: () => ({
    height: 300,
    isDragging: false,
    startResizing: vi.fn(),
  }),
}));
vi.mock("./hooks", () => ({
  useQueryDashboard: () => ({ isDashboardDialogOpen: false }),
}));
vi.mock("./components/QueryToolbar", () => ({
  QueryToolbar: ({
    onExplain,
    aiEnabled = true,
    onOpenHistory,
  }: {
    onExplain: () => void;
    aiEnabled?: boolean;
    onOpenHistory: () => void;
  }) => {
    mocks.onExplain = onExplain;
    return (
      <>
        <button disabled={!aiEnabled} onClick={onExplain}>
          Explain SQL
        </button>
        <button onClick={onOpenHistory}>History</button>
      </>
    );
  },
}));
vi.mock("./AiQueryExplanationDialog", () => ({
  AiQueryExplanationDialog: ({
    open,
    onRegenerate,
    explanation,
  }: {
    open: boolean;
    onRegenerate: (prompt?: string) => Promise<void> | void;
    explanation: string | null;
  }) => {
    mocks.onRegenerate = onRegenerate;
    return open ? (
      <div data-testid="ai-explanation">
        {explanation}
        <button onClick={() => void onRegenerate("More detail")}>
          Review again
        </button>
      </div>
    ) : null;
  },
}));
vi.mock("./QueryHistoryDialog", () => ({
  QueryHistoryDialog: ({
    open,
    onExplainQuery,
  }: {
    open: boolean;
    onExplainQuery: (sql: string) => void;
  }) =>
    open ? (
      <button onClick={() => onExplainQuery("SELECT history FROM fixture")}>
        Explain history
      </button>
    ) : null,
}));
vi.mock("./QueryResults", () => ({ QueryResults: () => null }));
vi.mock("./SavedQueriesDialog", () => ({ SavedQueriesDialog: () => null }));
vi.mock("./ActiveQueriesPanel", () => ({ ActiveQueriesPanel: () => null }));
vi.mock("./SqlSequenceDialog", () => ({ SqlSequenceDialog: () => null }));
vi.mock("@/presentation/modules/Dashboard/SaveToDashboardDialog", () => ({
  SaveToDashboardDialog: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const initialState = useAppStore.getInitialState();
let client: QueryClient;

function renderEditor() {
  return render(
    <QueryClientProvider client={client}>
      <QueryEditor tabId="ai-fixture" isActive />
    </QueryClientProvider>,
  );
}

describe("QueryEditor AI Explain account policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.post.mockResolvedValue({ message: "Fixture explanation" });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAppStore.setState(
      {
        ...initialState,
        lang: "en",
        tabs: [
          {
            id: "ai-fixture",
            title: "Fixture",
            type: "query",
            metadata: { sql: "SELECT secret FROM fixture" },
          },
        ],
        activeTabId: "ai-fixture",
        activeConnectionId: "connection-1",
        activeDatabase: "fixture-db",
        connections: [
          {
            id: "connection-1",
            type: "postgres",
            name: "Fixture",
            database: "fixture-db",
          },
        ],
      },
      true,
    );
  });
  afterEach(() => {
    client.clear();
    useAppStore.setState(initialState, true);
  });

  it("blocks a stale Explain handler before opening the AI dialog or dispatching", async () => {
    renderEditor();
    mocks.enabled = false;
    await act(async () => {
      mocks.onExplain?.();
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ai-explanation")).not.toBeInTheDocument();
  });

  it("blocks history Explain while account AI is off", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    mocks.enabled = false;
    fireEvent.click(screen.getByRole("button", { name: "Explain history" }));
    await waitFor(() => expect(mocks.post).not.toHaveBeenCalled());
    expect(screen.queryByTestId("ai-explanation")).not.toBeInTheDocument();
  });

  it("blocks deeper re-explanation without clearing the existing explanation", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Explain SQL" }));
    expect(await screen.findByText("Fixture explanation")).toBeVisible();
    mocks.post.mockClear();
    mocks.enabled = false;
    await act(async () => {
      await mocks.onRegenerate?.("More detail");
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByText("Fixture explanation")).toBeVisible();
  });

  it("disables toolbar AI Explain for an AI-off account", () => {
    mocks.enabled = false;
    renderEditor();
    expect(screen.getByRole("button", { name: "Explain SQL" })).toBeDisabled();
  });

  it("does not execute the SQL editor shortcut from the AI query input", async () => {
    renderEditor();
    const aiInput = document.createElement("textarea");
    aiInput.setAttribute("data-ai-query-input", "");
    document.body.appendChild(aiInput);

    fireEvent.keyDown(aiInput, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(mocks.executeQuery).not.toHaveBeenCalled());

    aiInput.remove();
  });

  it("forwards provider exclusions and strict fallback on enabled Explain", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Explain SQL" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/ai/generate-sql",
        expect.objectContaining({
          disabledProviders: ["groq"],
          fallbackProvider: "none",
        }),
      ),
    );
  });
});
