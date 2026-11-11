import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiPreferences } from "@/core/services/aiPreferences";
import { INHERIT_ASSISTANT_MODEL } from "@/core/services/aiPreferences";
import { AiConfigTab } from "./AiConfigTab";
import {
  filterSearchableGroups,
  normalizeProviderBaseUrl,
} from "./AiConfigTab.utils";

const aiConfigTabMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  setAiModel: vi.fn(),
  updateAiPreferences: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  enabled: true,
  isSaving: false,
  setEnabled: vi.fn(),
}));

let mockPreferences: AiPreferences;
const mockUpdateAiPreferences = aiConfigTabMocks.updateAiPreferences;

vi.mock("@/core/services/aiAccountPolicy", () => ({
  isAiEnabled: () => aiConfigTabMocks.enabled,
  assertAiEnabled: () => {
    if (!aiConfigTabMocks.enabled) throw new Error("AI is disabled for this account.");
  },
  useAiAccountPolicy: () => ({
    enabled: aiConfigTabMocks.enabled,
    isSaving: aiConfigTabMocks.isSaving,
    setEnabled: aiConfigTabMocks.setEnabled,
  }),
}));

vi.mock("@/core/services/api.service", () => ({
  apiService: {
    get: aiConfigTabMocks.get,
    post: aiConfigTabMocks.post,
    patch: aiConfigTabMocks.patch,
    delete: aiConfigTabMocks.delete,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: aiConfigTabMocks.toastSuccess,
    error: aiConfigTabMocks.toastError,
  },
}));

vi.mock("@/core/services/store", () => ({
  useAppStore: () => ({
    lang: "vi",
    aiModel: "gemini-2.5-flash",
    setAiModel: aiConfigTabMocks.setAiModel,
  }),
}));

vi.mock("@/core/services/aiPreferences", async () => {
  const actual = await import("@/core/services/aiPreferences");
  return {
    ...actual,
    useAiPreferences: () => ({ ...mockPreferences, enabled: aiConfigTabMocks.enabled }),
    updateAiPreferences: aiConfigTabMocks.updateAiPreferences,
  };
});

// The usage card fetches via react-query and is not part of these form
// tests; stub it so the tests do not need a QueryClientProvider wrapper.
vi.mock("@/presentation/components/shared/AiUsageCard", () => ({
  AiUsageCard: () => null,
}));

describe("filterSearchableGroups", () => {
  it("filters model groups case-insensitively by label or value", () => {
    expect(
      filterSearchableGroups(
        [
          {
            label: "Built-in",
            options: [
              { value: "gpt-oss-120b", label: "GPT OSS 120B" },
              {
                value: "anthropic/claude-sonnet-4.5",
                label: "Claude Sonnet 4.5",
              },
            ],
          },
        ],
        "claude",
      ),
    ).toEqual([
      {
        label: "Built-in",
        options: [
          { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
        ],
      },
    ]);
  });

  it("normalizes provider URLs without a trailing-slash regex", () => {
    expect(
      normalizeProviderBaseUrl("  https://provider.example.com/v1///  "),
    ).toBe("https://provider.example.com/v1");
  });
});

describe("AiConfigTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiConfigTabMocks.enabled = true;
    aiConfigTabMocks.isSaving = false;
    aiConfigTabMocks.setEnabled.mockResolvedValue(undefined);
    aiConfigTabMocks.get.mockResolvedValue([
      {
        id: "provider-1",
        name: "gido",
        type: "openai-compatible",
        baseUrl: "https://provider.example.com/v1",
        model: "gpt-oss-120b",
        models: [],
        capabilities: {},
        apiKeyConfigured: true,
      },
    ]);
    aiConfigTabMocks.patch.mockImplementation(
      (_url: string, payload: Record<string, unknown>) =>
        Promise.resolve({
          id: "provider-1",
          ...payload,
          apiKeyConfigured: true,
        }),
    );
    aiConfigTabMocks.delete.mockResolvedValue(undefined);
    mockUpdateAiPreferences.mockImplementation(
      (updater: (current: AiPreferences) => AiPreferences) => {
        mockPreferences = updater(mockPreferences);
      },
    );
    mockPreferences = {
      assistantModel: undefined,
      explainModel: INHERIT_ASSISTANT_MODEL,
      sqlModel: INHERIT_ASSISTANT_MODEL,
      nosqlModel: INHERIT_ASSISTANT_MODEL,
      autocompleteModel: INHERIT_ASSISTANT_MODEL,
      customProviders: [
        {
          id: "provider-1",
          name: "gido",
          type: "openai-compatible",
          baseUrl: "https://provider.example.com/v1",
          apiKey: "sk-test",
          model: "gpt-oss-120b",
          serverManaged: true,
          apiKeyConfigured: true,
        },
      ],
    };
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  it("shows unassessed Beeknoee role guidance without overwriting role selections", async () => {
    mockPreferences.assistantModel = "beeknoee:bee-tok/claude-sonnet-5-5";
    render(<AiConfigTab t={(key) => key} />);
    expect(screen.getAllByText(/Vai trò Beeknoee chưa được đánh giá bằng test thực tế/).length).toBeGreaterThan(0);
    expect(mockPreferences.assistantModel).toBe("beeknoee:bee-tok/claude-sonnet-5-5");
    expect(mockPreferences.sqlModel).toBe(INHERIT_ASSISTANT_MODEL);
    expect(aiConfigTabMocks.setAiModel).not.toHaveBeenCalled();
    expect(aiConfigTabMocks.post).not.toHaveBeenCalled();
  });

  it("blocks saved-provider external testing after a fresh account disable", async () => {
    aiConfigTabMocks.post.mockResolvedValue({ ok: true, models: ["fixture-model"], latencyMs: 1 });
    render(<AiConfigTab t={(key) => key} />);
    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    aiConfigTabMocks.enabled = false;
    fireEvent.click(screen.getByRole("button", { name: /kết nối/i }));
    await waitFor(() => expect(aiConfigTabMocks.post).not.toHaveBeenCalled());
    expect(screen.getByDisplayValue("gido")).toBeInTheDocument();
  });

  it("disables provider model discovery while AI is off but allows stored-provider edits", async () => {
    aiConfigTabMocks.enabled = false;
    render(<AiConfigTab t={(key) => key} />);
    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    expect(screen.getByRole("button", { name: /kết nối/i })).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue("gido"), { target: { value: "stored-config-only" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu chỉnh sửa/i }));
    await waitFor(() => expect(aiConfigTabMocks.patch).toHaveBeenCalledWith(
      "/ai/providers/provider-1", expect.objectContaining({ name: "stored-config-only" }),
    ));
    expect(aiConfigTabMocks.post).not.toHaveBeenCalled();
    expect(aiConfigTabMocks.get).toHaveBeenCalledWith("/ai/providers");
  });

  it("waits for confirmed account save before showing toggle success", async () => {
    let finish!: () => void;
    aiConfigTabMocks.setEnabled.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    render(<AiConfigTab t={(key) => key} />);
    const toggle = screen.getByRole("switch", { name: "Bật/Tắt AI" });
    fireEvent.click(toggle);
    expect(aiConfigTabMocks.setEnabled).toHaveBeenCalledWith(false);
    expect(aiConfigTabMocks.toastSuccess).not.toHaveBeenCalled();
    expect(toggle).toBeChecked();
    finish();
    await waitFor(() => expect(aiConfigTabMocks.toastSuccess).toHaveBeenCalledWith("Đã tắt hệ thống AI."));
  });

  it("shows a save error without optimistically enabling the account", async () => {
    aiConfigTabMocks.enabled = false;
    mockPreferences = { ...mockPreferences, enabled: false };
    aiConfigTabMocks.setEnabled.mockRejectedValue(new Error("Policy save failed"));
    render(<AiConfigTab t={(key) => key} />);
    const toggle = screen.getByRole("switch", { name: "Bật/Tắt AI" });
    fireEvent.click(toggle);
    await waitFor(() => expect(aiConfigTabMocks.toastError).toHaveBeenCalledWith("Policy save failed"));
    expect(toggle).not.toBeChecked();
    expect(aiConfigTabMocks.toastSuccess).not.toHaveBeenCalled();
    expect(mockPreferences.enabled).toBe(false);
  });

  it("disables the master switch while the account save is pending", () => {
    aiConfigTabMocks.isSaving = true;
    render(<AiConfigTab t={(key) => key} />);
    expect(screen.getByRole("switch", { name: "Bật/Tắt AI" })).toBeDisabled();
    expect(aiConfigTabMocks.setEnabled).not.toHaveBeenCalled();
  });

  it("loads a provider into the form and saves edits", async () => {
    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));

    expect(screen.getByDisplayValue("gido")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://provider.example.com/v1"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /gpt-oss-120b/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("gido"), {
      target: { value: "gido-updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Lưu chỉnh sửa/i }));

    await waitFor(() => {
      expect(aiConfigTabMocks.patch).toHaveBeenCalledWith(
        "/ai/providers/provider-1",
        expect.objectContaining({ name: "gido-updated" }),
      );
      expect(screen.getByText("gido-updated")).toBeInTheDocument();
    });
    expect(aiConfigTabMocks.toastSuccess).toHaveBeenCalled();
  });

  it("loads provider models without auto-opening the dropdown", async () => {
    aiConfigTabMocks.post.mockResolvedValue({
      ok: true,
      models: ["gpt-oss-120b", "anthropic/claude-sonnet-4.5"],
      latencyMs: 42,
    });

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    fireEvent.click(screen.getByRole("button", { name: /kết nối/i }));

    await waitFor(() => {
      expect(aiConfigTabMocks.post).toHaveBeenCalledWith(
        "/ai/providers/provider-1/test",
        {},
      );
    });

    expect(
      screen.queryByText("anthropic/claude-sonnet-4.5"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Đã tải 2 model/i)).toBeInTheDocument();
  });

  it("commits a custom provider model only after pressing enter", async () => {
    aiConfigTabMocks.post.mockResolvedValue({
      ok: true,
      models: ["gpt-oss-120b", "anthropic/claude-sonnet-4.5"],
      latencyMs: 42,
    });

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    fireEvent.click(screen.getByRole("button", { name: /kết nối/i }));

    await waitFor(() => {
      expect(screen.getByText(/Đã tải 2 model/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /gpt-oss-120b/i }));

    const searchInput = screen.getByPlaceholderText("Search models...");
    fireEvent.change(searchInput, { target: { value: "custom-model" } });

    expect(
      screen.getByRole("button", { name: /gpt-oss-120b/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /custom-model/i }),
      ).toBeInTheDocument();
    });
  });

  it("resets the autocomplete role when removing its custom provider", async () => {
    mockPreferences = {
      ...mockPreferences,
      autocompleteModel: "custom-provider:provider-1",
    };

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Xóa/i }));

    await waitFor(() => {
      expect(aiConfigTabMocks.delete).toHaveBeenCalledWith(
        "/ai/providers/provider-1",
      );
      expect(mockPreferences.autocompleteModel).toBe(INHERIT_ASSISTANT_MODEL);
    });
  });

  it("toggles the custom provider's enabled state when Switch is toggled", async () => {
    render(<AiConfigTab t={(key) => key} />);

    const switchToggle = screen.getByRole("switch", { name: "Bật/Tắt provider" });
    expect(switchToggle).toBeChecked();

    fireEvent.click(switchToggle);

    await waitFor(() => {
      expect(mockPreferences.customProviders[0].enabled).toBe(false);
    });
    expect(aiConfigTabMocks.toastSuccess).toHaveBeenCalledWith("Đã tắt provider AI.");
  });
});
