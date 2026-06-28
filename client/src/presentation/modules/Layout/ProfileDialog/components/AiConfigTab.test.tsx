import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiPreferences } from "@/core/services/aiPreferences";
import { INHERIT_ASSISTANT_MODEL } from "@/core/services/aiPreferences";
import { AiConfigTab } from "./AiConfigTab";
import { filterSearchableGroups } from "./AiConfigTab.utils";

const aiConfigTabMocks = vi.hoisted(() => ({
  post: vi.fn(),
  setAiModel: vi.fn(),
  updateAiPreferences: vi.fn(),
}));

let mockPreferences: AiPreferences;
const mockUpdateAiPreferences = aiConfigTabMocks.updateAiPreferences;

vi.mock("@/core/services/api.service", () => ({
  apiService: {
    post: aiConfigTabMocks.post,
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
});

describe("AiConfigTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        },
      ],
    };
    vi.stubGlobal("alert", vi.fn());
  });

  it("loads a provider into the form and saves edits", () => {
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

    expect(mockUpdateAiPreferences).toHaveBeenCalledOnce();
    expect(screen.getByText("gido-updated")).toBeInTheDocument();
    expect(globalThis.alert).toHaveBeenCalled();
  });

  it("loads provider models without auto-opening the dropdown", async () => {
    aiConfigTabMocks.post.mockResolvedValue({
      models: ["gpt-oss-120b", "anthropic/claude-sonnet-4.5"],
    });

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tải model/i }));

    await waitFor(() => {
      expect(aiConfigTabMocks.post).toHaveBeenCalledWith(
        "/ai/provider-models",
        {
          baseUrl: "https://provider.example.com/v1",
          apiKey: "sk-test",
        },
      );
    });

    expect(
      screen.queryByText("anthropic/claude-sonnet-4.5"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Đã tải 2 model/i)).toBeInTheDocument();
  });

  it("commits a custom provider model only after pressing enter", async () => {
    aiConfigTabMocks.post.mockResolvedValue({
      models: ["gpt-oss-120b", "anthropic/claude-sonnet-4.5"],
    });

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Sửa/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tải model/i }));

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

  it("resets the autocomplete role when removing its custom provider", () => {
    mockPreferences = {
      ...mockPreferences,
      autocompleteModel: "custom-provider:provider-1",
    };

    render(<AiConfigTab t={(key) => key} />);

    fireEvent.click(screen.getByRole("button", { name: /Xóa/i }));

    expect(mockPreferences.autocompleteModel).toBe(INHERIT_ASSISTANT_MODEL);
  });
});
