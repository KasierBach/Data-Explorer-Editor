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
}));

let mockPreferences: AiPreferences;
const mockUpdateAiPreferences = aiConfigTabMocks.updateAiPreferences;

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
    useAiPreferences: () => mockPreferences,
    updateAiPreferences: aiConfigTabMocks.updateAiPreferences,
  };
});

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
