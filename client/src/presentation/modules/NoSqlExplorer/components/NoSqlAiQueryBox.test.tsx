import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoSqlAiQueryBox } from "./NoSqlAiQueryBox";
import { apiService } from "@/core/services/api.service";
import { useAppStore } from "@/core/services/store";

vi.mock("@/core/services/api.service", () => ({
  apiService: {
    post: vi.fn(),
  },
}));

vi.mock("@/core/services/store", () => ({
  useAppStore: vi.fn(),
}));

vi.mock("@/core/services/aiPreferences", () => ({
  useAiPreferences: () => ({
    assistantModel: "test-model",
    nosqlModel: "test-model",
    customProviders: [],
  }),
  resolveAiSelection: () => ({
    model: "test-model",
    providerOverride: undefined,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockPost = vi.mocked(apiService.post);

describe("NoSqlAiQueryBox aggregation mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppStore.mockReturnValue({
      lang: "en",
      aiModel: "test-model",
      aiRoutingMode: "auto",
      connections: [{ id: "mongo-1", type: "mongodb", readOnly: true }],
    } as never);
  });

  it("shows novice-friendly pipeline prompts when opened in aggregation mode", () => {
    render(
      <NoSqlAiQueryBox
        aggregateOnly
        initiallyExpanded
        currentConnectionId="mongo-1"
        currentDatabase="sample_mflix"
        collectionName="movies"
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Build a pipeline with AI")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Top groups" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$group")).toBeInTheDocument();
  });

  it("accepts only aggregate commands from the AI response", async () => {
    const onGenerate = vi.fn();
    mockPost
      .mockResolvedValueOnce({
        sql: JSON.stringify({ action: "find", collection: "movies" }),
        explanation: "Find command",
      })
      .mockResolvedValueOnce({
        sql: JSON.stringify({
          action: "aggregate",
          collection: "movies",
          pipeline: [{ $limit: 10 }],
        }),
        explanation: "Aggregation pipeline",
      });

    render(
      <NoSqlAiQueryBox
        aggregateOnly
        initiallyExpanded
        currentConnectionId="mongo-1"
        currentDatabase="sample_mflix"
        collectionName="movies"
        onGenerate={onGenerate}
      />,
    );

    const prompt = screen.getByPlaceholderText(/group movies by genre/i);
    const generate = screen.getByRole("button", { name: /generate pipeline/i });

    fireEvent.change(prompt, { target: { value: "Show the top genres" } });
    fireEvent.click(generate);

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.click(generate);

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
    expect(onGenerate.mock.calls[0][0]).toContain('"action":"aggregate"');
    expect(mockPost.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        database: "sample_mflix",
        prompt: expect.stringContaining('action "aggregate"'),
      }),
    );
    expect(mockPost.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        prompt: expect.stringContaining("$unwind"),
      }),
    );
  });

  it("does not reject a valid aggregation pipeline because its JSON is long", async () => {
    const onGenerate = vi.fn(() => true);
    const longPipeline = {
      action: "aggregate",
      collection: "movies",
      pipeline: [
        { $unwind: "$genres" },
        { $group: { _id: "$genres", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ],
    };
    mockPost.mockResolvedValue({
      sql: JSON.stringify(longPipeline, null, 2),
      explanation: "Top genres",
    });

    render(
      <NoSqlAiQueryBox
        aggregateOnly
        initiallyExpanded
        currentConnectionId="mongo-1"
        collectionName="movies"
        onGenerate={onGenerate}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/group movies by genre/i), {
      target: { value: "Show the top genres" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate pipeline/i }));

    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
    expect(onGenerate).toHaveBeenCalledWith(
      JSON.stringify(longPipeline, null, 2),
    );
  });

  it("keeps the helper open when the builder rejects an unsupported pipeline", async () => {
    const onGenerate = vi.fn(() => false);
    mockPost.mockResolvedValue({
      sql: JSON.stringify({
        action: "aggregate",
        collection: "movies",
        pipeline: [{ $count: "total" }],
      }),
      explanation: "Count pipeline",
    });

    render(
      <NoSqlAiQueryBox
        aggregateOnly
        initiallyExpanded
        currentConnectionId="mongo-1"
        collectionName="movies"
        onGenerate={onGenerate}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/group movies by genre/i), {
      target: { value: "Count every movie" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate pipeline/i }));

    expect(
      await screen.findByText(/invalid or contains an unsupported stage/i),
    ).toBeInTheDocument();
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
