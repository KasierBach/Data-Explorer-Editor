import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Buffer } from "node:buffer";
import { AI_ATTACHMENT_BOUNDS, AI_BINARY_REATTACH_WARNING } from "@/core/services/aiAttachmentBounds";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiMessage } from "@/core/services/store";
import { AiChatService } from "@/core/services/AiChatService";
import { useAiChat } from "./useAiChat";

const mocks = vi.hoisted(() => ({
  enabled: true,
  getProviderStatus: vi.fn(),
  generateSqlStream: vi.fn(),
  getActiveAdapter: vi.fn(),
  getAdapter: vi.fn(),
  getQueryData: vi.fn(),
  addAiMessage: vi.fn(),
  updateAiMessage: vi.fn(),
  editAiMessage: vi.fn(),
  syncAiMessage: vi.fn(),
  waitForAiMessagePersistence: vi.fn(),
  setPageState: vi.fn(),
  toastError: vi.fn(),
  pdfGetDocument: vi.fn(),
}));

let mockStore: Record<string, unknown>;
vi.mock("@/core/services/store", () => ({
  useAppStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector ? selector(mockStore) : mockStore,
    { getState: () => mockStore },
  ),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ getQueryData: mocks.getQueryData }),
}));
vi.mock("@/core/services/ConnectionService", () => ({
  connectionService: {
    getActiveAdapter: mocks.getActiveAdapter,
    getAdapter: mocks.getAdapter,
  },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("pdfjs-dist", () => ({ GlobalWorkerOptions: {}, getDocument: mocks.pdfGetDocument }));
vi.mock("@/core/services/AiService", () => ({
  aiService: { getProviderStatus: mocks.getProviderStatus },
}));
vi.mock("@/core/services/aiAccountPolicy", () => ({
  isAiEnabled: () => mocks.enabled,
  assertAiEnabled: () => {
    if (!mocks.enabled) throw new Error("AI is disabled for this account.");
  },
}));
vi.mock("@/core/services/aiPreferences", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/core/services/aiPreferences")>();
  return {
    ...actual,
    useAiPreferences: () => ({
      enabled: mocks.enabled,
      assistantModel: "fixture-model",
      customProviders: [],
      disabledProviders: ["groq"],
      fallbackProvider: "none",
    }),
    resolveAiSelection: () => ({
      model: "fixture-model",
      providerOverride: undefined,
    }),
  };
});

const messages: AiMessage[] = [];
const ReadableStream = NodeReadableStream as unknown as typeof globalThis.ReadableStream;

function streamResponse(content = 'data: {"type":"done","data":{"message":"Fixture answer"}}\n\n') {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((fulfil, fail) => {
    resolve = fulfil;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function controlledResponse(cancelPromise: Promise<void> = Promise.resolve()) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn(() => cancelPromise);
  const stream = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    cancel,
  });
  const response = new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const body = response.body!;
  const getReader = body.getReader.bind(body);
  let read!: ReturnType<typeof vi.spyOn>;
  let releaseLock!: ReturnType<typeof vi.spyOn>;
  vi.spyOn(body, "getReader").mockImplementation(() => {
    const reader = getReader();
    read = vi.spyOn(reader, "read");
    releaseLock = vi.spyOn(reader, "releaseLock");
    return reader;
  });
  return {
    response, body, cancel,
    get read() { return read; },
    get releaseLock() { return releaseLock; },
    enqueue(content: string) { controller.enqueue(new TextEncoder().encode(content)); },
    close() { controller.close(); },
    fail(error: Error) { controller.error(error); },
  };
}

describe("useAiChat account policy entry points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    messages.splice(
      0,
      messages.length,
      { id: "user-1", role: "user", content: "Original prompt", timestamp: 1 },
      { id: "ai-1", role: "ai", content: "Original answer", timestamp: 2 },
    );
    mockStore = {
      lang: "en",
      user: { id: "actor-1", email: "fixture@example.test" },
      accessToken: "fixture-session-1",
      isAuthenticated: true,
      aiModel: "fixture-model",
      aiMode: "fast",
      aiRoutingMode: "auto",
      pageStates: {},
      activeAiChatId: "chat-1",
      aiChats: [{ id: "chat-1", messages }],
      activeConnectionId: "connection-1",
      activeDatabase: "fixture-db",
      connections: [
        { id: "connection-1", type: "postgresql", name: "Fixture" },
      ],
      tabs: [
        {
          id: "tab-1",
          type: "query",
          title: "Fixture query",
          metadata: {
            sql: "SELECT private FROM fixture",
            tableId: "fixture.table",
          },
        },
      ],
      activeTabId: "tab-1",
      addAiMessage: mocks.addAiMessage,
      updateAiMessage: mocks.updateAiMessage,
      editAiMessage: mocks.editAiMessage,
      syncAiMessage: mocks.syncAiMessage,
      waitForAiMessagePersistence: mocks.waitForAiMessagePersistence,
      setPageState: mocks.setPageState,
    };
    mocks.getProviderStatus.mockResolvedValue({ providers: {} });
    mocks.getActiveAdapter.mockReturnValue({
      generateSqlStream: mocks.generateSqlStream,
    });
    mocks.generateSqlStream.mockImplementation(async () => streamResponse());
    mocks.editAiMessage.mockImplementation(async (_chatId: string, id: string, content: string) => {
      const index = messages.findIndex(item => item.id === id || item.clientId === id);
      if (index !== -1) {
        messages[index].content = content;
        messages.splice(index + 1);
      }
    });
    mocks.syncAiMessage.mockImplementation(async (_chatId: string, message: AiMessage) => {
      const current = messages.find(item => item.id === message.id || item.clientId === message.clientId);
      if (current) Object.assign(current, message, { delivery: 'saved', deliveryError: undefined });
      return current;
    });
    mocks.waitForAiMessagePersistence.mockImplementation(async (_chatId: string, id: string) => {
      const current = messages.find(item => item.id === id || item.clientId === id);
      if (!current) throw new Error('Message missing');
      if (current.delivery === 'failed') throw new Error(current.deliveryError?.message || 'Save failed');
      return current;
    });
    mocks.addAiMessage.mockImplementation(
      async (_chatId: string, message: AiMessage) => {
        const local = { ...message, clientId: message.id, delivery: message.role === 'user' ? 'saved' as const : 'local' as const };
        messages.push(local);
        return local;
      },
    );
    mocks.updateAiMessage.mockImplementation(
      (_chatId: string, id: string, updates: Partial<AiMessage>) => {
        const message = messages.find((item) => item.id === id || item.clientId === id);
        if (message) Object.assign(message, updates);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ["fixture.png", "image/png", AI_ATTACHMENT_BOUNDS.maxImageBytes + 1],
    ["fixture.pdf", "application/pdf", AI_ATTACHMENT_BOUNDS.maxPdfBytes + 1],
    ["fixture.txt", "text/plain", AI_ATTACHMENT_BOUNDS.maxTextBytes + 1],
    ["fixture.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 16],
    ["fixture.exe", "application/octet-stream", 16],
  ])("rejects %s before even reading the signature or invoking a parser", async (name, type, size) => {
    const file = { name, type, size, slice: vi.fn(), text: vi.fn(), arrayBuffer: vi.fn() };
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: name } } as never);
    });
    expect(file.slice).not.toHaveBeenCalled();
    expect(file.text).not.toHaveBeenCalled();
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.pdfGetDocument).not.toHaveBeenCalled();
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalled();
    expect(result.current.attachments).toEqual([]);
  });

  it("reads only 16 bytes and rejects a MIME-spoofed image before full reads", async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const readHeader = vi.fn().mockResolvedValue(png.buffer);
    const file = { name: "fixture.jpg", type: "image/jpeg", size: png.length,
      slice: vi.fn(() => ({ arrayBuffer: readHeader })), arrayBuffer: vi.fn(), text: vi.fn() };
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: file.name } } as never);
    });
    expect(file.slice).toHaveBeenCalledWith(0, 16);
    expect(readHeader).toHaveBeenCalledTimes(1);
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(result.current.attachments).toEqual([]);
  });

  it("bounds attachment count before reading another file", async () => {
    mockStore.pageStates = { "ai-chat-draft-chat-1": {
      attachments: Array(4).fill({ type: "file", label: "fixture.txt", data: "fixture" }),
    } };
    const file = { name: "fixture.txt", type: "text/plain", size: 7, slice: vi.fn(), text: vi.fn() };
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: file.name } } as never);
    });
    expect(file.slice).not.toHaveBeenCalled();
    expect(result.current.attachments).toHaveLength(4);
  });

  it("keeps bounded text previews and rejects a mismatched full-file declaration", async () => {
    const bytes = new TextEncoder().encode("hello");
    const file = { name: "fixture.txt", type: "text/plain", size: bytes.length,
      slice: vi.fn(() => ({ arrayBuffer: async () => bytes.buffer })), text: vi.fn().mockResolvedValue("hello") };
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: file.name } } as never);
    });
    expect(result.current.attachments[0]).toMatchObject({ type: "file", label: "[TXT] fixture.txt", data: expect.stringContaining("hello") });
    file.text.mockResolvedValueOnce("spoofed size");
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: file.name } } as never);
    });
    expect(result.current.attachments).toHaveLength(1);
  });

  it("keeps native PDF runtime-only, warns on omission, and requires reattachment on replay", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\n");
    const rawData = `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`;
    vi.stubGlobal("FileReader", class {
      result = rawData;
      onload?: () => void;
      readAsDataURL() { this.onload?.(); }
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    mocks.pdfGetDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        getTextContent: async () => ({ items: [{ str: "Fixture PDF text" }] }), cleanup: vi.fn(),
      }) }), destroy,
    });
    const file = { name: "fixture.pdf", type: "application/pdf", size: bytes.length,
      slice: vi.fn(() => ({ arrayBuffer: async () => bytes.buffer })),
      arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer) };
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.handleFileSelected({ target: { files: [file], value: file.name } } as never);
    });
    expect(result.current.attachments[0].rawData).toBe(rawData);
    expect(result.current.attachments[0].preview).toContain(AI_BINARY_REATTACH_WARNING);
    expect(destroy).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.handleSend(); });
    expect(mocks.generateSqlStream.mock.calls[0][0].document).toEqual({ name: "fixture.pdf", mimeType: "application/pdf", data: rawData });
    const user = mocks.addAiMessage.mock.calls.find(([, value]) => value.role === "user")![1] as AiMessage;
    expect(user.attachments![0]).not.toHaveProperty("rawData");
    expect(user.attachments![0].preview).toContain(AI_BINARY_REATTACH_WARNING);
    await act(async () => { await result.current.handleRegenerate("chat-1"); });
    expect(mocks.generateSqlStream.mock.calls[1][0].document).toBeUndefined();
    expect(mocks.generateSqlStream.mock.calls[1][0].context).toContain(AI_BINARY_REATTACH_WARNING);
  });

  it("does not replay legacy binary image data automatically", async () => {
    messages[0].attachments = [{ type: "image", label: "fixture.png", data: "data:image/png;base64,iVBORw0KGgo=" }];
    const { result } = renderHook(() => useAiChat());
    await act(async () => { await result.current.handleRegenerate("chat-1", "ai-1"); });
    expect(mocks.generateSqlStream.mock.calls[0][0].image).toBeUndefined();
    expect(mocks.generateSqlStream.mock.calls[0][0].context).toContain(AI_BINARY_REATTACH_WARNING);
  });

  it("does not fetch provider status when the account is disabled", () => {
    mocks.enabled = false;
    renderHook(() => useAiChat());
    expect(mocks.getProviderStatus).not.toHaveBeenCalled();
  });

  it.each(["send", "enter"])(
    "blocks stale %s before adding messages or clearing the prompt",
    async (entrypoint) => {
      const { result } = renderHook(() => useAiChat());
      await act(async () => {
        result.current.setInput("Keep this draft");
      });
      mocks.enabled = false;
      await act(async () => {
        if (entrypoint === "send") await result.current.handleSend();
        else
          result.current.handleKeyDown({
            key: "Enter",
            shiftKey: false,
            preventDefault: vi.fn(),
          } as never);
      });
      expect(mocks.generateSqlStream).not.toHaveBeenCalled();
      expect(mocks.addAiMessage).not.toHaveBeenCalled();
      expect(mocks.getActiveAdapter).not.toHaveBeenCalled();
      expect(result.current.input).toBe("Keep this draft");
    },
  );

  it.each(["retry", "edit"])(
    "blocks stale %s before syncing or truncating history",
    async (entrypoint) => {
      const { result } = renderHook(() => useAiChat());
      mocks.enabled = false;
      await act(async () => {
        if (entrypoint === "retry")
          await result.current.handleRegenerate("chat-1", "ai-1");
        else
          await result.current.handleEditSubmit(
            "chat-1",
            "user-1",
            "Revised prompt",
          );
      });
      expect(mocks.generateSqlStream).not.toHaveBeenCalled();
      expect(mocks.editAiMessage).not.toHaveBeenCalled();
      expect(mocks.addAiMessage).not.toHaveBeenCalled();
      expect(messages.map((message) => message.content)).toEqual([
        "Original prompt",
        "Original answer",
      ]);
    },
  );

  it("blocks a late queued replay after editing completes with AI now off", async () => {
    const { result } = renderHook(() => useAiChat());
    mocks.editAiMessage.mockImplementation(async () => {
      mocks.enabled = false;
    });
    await act(async () => {
      await result.current.handleRegenerate("chat-1", "ai-1");
    });
    expect(mocks.editAiMessage).toHaveBeenCalledTimes(1);
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(mocks.addAiMessage).not.toHaveBeenCalled();
  });

  it("does not read files or capture editor/schema context after disable", async () => {
    const { result } = renderHook(() => useAiChat());
    mocks.enabled = false;
    const readText = vi.fn().mockResolvedValue("Private file");
    const file = {
      name: "fixture.txt",
      type: "text/plain",
      size: 12,
      text: readText,
    } as unknown as File;
    await act(async () => {
      await result.current.handleFileSelected({
        target: { files: [file], value: "fixture.txt" },
      } as never);
      result.current.handlePasteQuery();
      await result.current.handleMentionTable();
    });
    expect(readText).not.toHaveBeenCalled();
    expect(mocks.getAdapter).not.toHaveBeenCalled();
    expect(mocks.getQueryData).not.toHaveBeenCalled();
    expect(result.current.attachments).toEqual([]);
  });

  it("forwards routing exclusions and strict fallback for an enabled chat", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      result.current.setInput("Fixture prompt");
    });
    await act(async () => {
      await result.current.handleSend();
    });
    expect(mocks.generateSqlStream).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Fixture prompt",
        disabledProviders: ["groq"],
        fallbackProvider: "none",
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.addAiMessage).toHaveBeenCalledTimes(2);
  });

  it("carries final provenance through the current message and save/load envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ id: 'canonical-ai-id', chatUpdatedAt: '2026-11-09T12:00:00.123Z', persistence: { state: 'saved' } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(1000);
    const data = {
      message: "Final answer",
      provider: "gemini",
      providerLabel: "Gemini",
      model: "fixture-returned-model",
      routingMode: "best",
      sources: [
        "https://EXAMPLE.com:443/report",
        "https://example.com/report",
        " http://example.org/reference ",
        "javascript:alert(1)",
        "https://user:secret@example.com/private",
        "https://example.com/\nunsafe",
        "https://example.com/%0dunsafe",
      ],
      usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
      warnings: ["Live search coverage was limited"],
      generationId: "server-generation-1",
      contractVersion: 1,
    };
    mocks.generateSqlStream.mockImplementation(async () => streamResponse([
      `data: ${JSON.stringify({ type: "chunk", text: "Draft answer" })}`,
      `data: ${JSON.stringify({ type: "chunk", text: " queued" })}`,
      `data: ${JSON.stringify({ type: "done", data })}`,
      "",
      "",
    ].join("\n")));
    mocks.syncAiMessage.mockImplementation((chatId: string, message: AiMessage) =>
      AiChatService.saveMessage(chatId, message),
    );
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      result.current.setInput("Fixture prompt");
    });
    await act(async () => {
      await result.current.handleSend();
    });

    const finalMessage = messages.at(-1)!;
    expect(finalMessage).toMatchObject({
      content: "Final answer",
      sources: ["https://example.com/report", "http://example.org/reference"],
      usage: data.usage,
      warnings: data.warnings,
      generationId: data.generationId,
      contractVersion: 1,
      modelInfo: { provider: "Gemini", model: data.model, routingMode: "best" },
    });
    expect(mocks.syncAiMessage).toHaveBeenCalledWith("chat-1", finalMessage);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const persisted = JSON.parse(request.body as string);
    expect(persisted.attachments).toMatchObject({
      sources: finalMessage.sources,
      usage: data.usage,
      warnings: data.warnings,
      generationId: data.generationId,
      contractVersion: 1,
      modelInfo: finalMessage.modelInfo,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        messages: [{
          ...persisted,
          id: finalMessage.id,
          createdAt: "2026-06-07T12:00:00.000Z",
        }],
      }),
    });
    const [reloaded] = await AiChatService.loadMessages("chat-1");
    expect(reloaded).toMatchObject({
      content: finalMessage.content,
      sources: finalMessage.sources,
      usage: finalMessage.usage,
      warnings: finalMessage.warnings,
      generationId: finalMessage.generationId,
      contractVersion: 1,
      modelInfo: finalMessage.modelInfo,
    });
  });

  it.each([
    { usageCoverage: "partial", attemptCount: 3, measuredAttemptCount: 1, costCoverage: "unavailable",
      usage: null, observedUsage: { promptTokens: 12, completionTokens: null, totalTokens: null } },
    { usageCoverage: "complete", attemptCount: 1, measuredAttemptCount: 1, costCoverage: "unavailable",
      usage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 }, observedUsage: { promptTokens: 0, completionTokens: 2, totalTokens: 2 } },
    { usageCoverage: "unavailable", attemptCount: 2, measuredAttemptCount: 0, costCoverage: "unavailable", usage: null, observedUsage: null },
  ])("carries execution metadata from terminal SSE through save and fresh reload: %j", async (metadata) => {
    let payload: Record<string, unknown> | undefined;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, request?: RequestInit) => {
      if (request?.method === "GET") return { ok: true, headers: { get: () => "application/json" }, json: async () => ({
        updatedAt: "2026-11-09T12:00:00.123Z",
        messages: [{ ...payload, id: "canonical-ai-id", createdAt: "2026-11-09T11:00:00.001Z" }],
      }) };
      payload = JSON.parse(request!.body as string);
      return { ok: true, headers: { get: () => "application/json" }, json: async () => ({
        id: "canonical-ai-id", chatUpdatedAt: "2026-11-09T12:00:00.123Z", persistence: { state: "saved" },
      }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = { message: "Final answer", generationId: "received-generation", ...metadata };
    mocks.generateSqlStream.mockImplementation(async () => streamResponse([
      `data: ${JSON.stringify({ type: "done", data })}`,
      'data: {"type":"done","data":{"message":"Stale answer","generationId":"stale-generation","attemptCount":8,"observedUsage":{"totalTokens":999}}}',
      "", "",
    ].join("\n")));
    mocks.syncAiMessage.mockImplementation((chatId: string, message: AiMessage) => AiChatService.saveMessage(chatId, message));
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    await act(async () => { await result.current.handleSend(); });
    const expected = { ...metadata, generationId: data.generationId, contractVersion: 1 };
    expect(messages.at(-1)).toMatchObject({ ...expected, content: data.message });
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
    expect(mocks.syncAiMessage.mock.calls[0][1]).toMatchObject(expected);
    expect(payload?.attachments).toMatchObject(expected);
    const [loaded] = await AiChatService.loadMessages("chat-1");
    expect(loaded).toMatchObject({ ...expected, content: data.message, delivery: "saved" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not infer usage, model metadata or a generation ID for legacy done events", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      result.current.setInput("Fixture prompt");
    });
    await act(async () => {
      await result.current.handleSend();
    });
    const finalMessage = messages.at(-1)!;
    expect(finalMessage.content).toBe("Fixture answer");
    expect(finalMessage.contractVersion).toBe(1);
    for (const key of ["sources", "usage", "warnings", "generationId", "modelInfo", "usageCoverage", "attemptCount", "measuredAttemptCount", "costCoverage", "observedUsage"] as const) {
      expect((finalMessage as unknown as Record<string, unknown>)[key]).toBeUndefined();
      expect(mocks.syncAiMessage.mock.calls.at(-1)![1][key]).toBeUndefined();
    }
  });

  it("does not flush queued chunk text over a terminal error", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    mocks.generateSqlStream.mockImplementation(async () => streamResponse([
      `data: ${JSON.stringify({ type: "chunk", text: "Draft answer" })}`,
      `data: ${JSON.stringify({ type: "chunk", text: " queued" })}`,
      `data: ${JSON.stringify({ type: "error", text: "Fixture provider failure" })}`,
      "",
      "",
    ].join("\n")));
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      result.current.setInput("Fixture prompt");
    });
    await act(async () => {
      await result.current.handleSend();
    });
    const finalMessage = messages.at(-1)!;
    expect(finalMessage.error).toBe(true);
    expect(finalMessage.content).toContain("Fixture provider failure");
    expect(finalMessage.content).not.toContain("Draft answer");
    expect(mocks.syncAiMessage.mock.calls.at(-1)![1].content).toBe(finalMessage.content);
  });

  it("cancels a pending reader.read and releases its lock without waiting for cancel", async () => {
    const cancel = deferred<void>();
    const stream = controlledResponse(cancel.promise);
    mocks.generateSqlStream.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    expect(stream.read).toHaveBeenCalledTimes(1);
    expect(stream.body.locked).toBe(true);

    await act(async () => {
      result.current.handleStop();
      await pending;
    });
    expect(stream.cancel).toHaveBeenCalledTimes(1);
    expect(stream.releaseLock).toHaveBeenCalledTimes(1);
    expect(stream.body.locked).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)!.content).toContain("Stopped by user");
    expect(messages.at(-1)!.delivery).toBe('interrupted');
    cancel.resolve();
  });

  it("settles stopped pending headers and disposes a late response without overwriting", async () => {
    const headers = deferred<Response>();
    mocks.generateSqlStream.mockReturnValueOnce(headers.promise);
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    const signal = mocks.generateSqlStream.mock.calls[0][1].signal as AbortSignal;
    await act(async () => { result.current.handleStop(); await pending; });
    const terminalContent = messages.at(-1)!.content;
    const writes = mocks.updateAiMessage.mock.calls.length;
    const late = controlledResponse();
    late.enqueue('data: {"type":"done","data":{"message":"Stale answer"}}\n\n');
    await act(async () => { headers.resolve(late.response); await Promise.resolve(); });
    expect(signal.aborted).toBe(true);
    expect(late.cancel).toHaveBeenCalledTimes(1);
    expect(late.body.locked).toBe(false);
    expect(messages.at(-1)!.content).toBe(terminalContent);
    expect(mocks.updateAiMessage).toHaveBeenCalledTimes(writes);
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
  });

  it("unmounts a pending read without publishing queued text or a final message", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const stream = controlledResponse();
      mocks.generateSqlStream.mockResolvedValueOnce(stream.response);
      const { result, unmount } = renderHook(() => useAiChat());
      await act(async () => { result.current.setInput("Fixture prompt"); });
      let pending!: Promise<void>;
      await act(async () => { pending = result.current.handleSend(); });
      await act(async () => {
        stream.enqueue('data: {"type":"chunk","text":"Draft"}\ndata: {"type":"chunk","text":" queued"}\n');
      });
      expect(stream.read).toHaveBeenCalledTimes(2);
      expect(messages.at(-1)!.content).toBe("Draft");
      const writes = mocks.updateAiMessage.mock.calls.length;
      unmount();
      await act(async () => { await pending; await vi.advanceTimersByTimeAsync(100); });
      expect(stream.cancel).toHaveBeenCalledTimes(1);
      expect(stream.body.locked).toBe(false);
      expect(mocks.updateAiMessage).toHaveBeenCalledTimes(writes);
      expect(mocks.syncAiMessage).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["actor", "connection", "database", "chat", "session"])(
    "discards stale %s output and queued text even before the switch rerenders",
    async (context) => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        const stream = controlledResponse();
        mocks.generateSqlStream.mockResolvedValueOnce(stream.response);
        const { result, rerender } = renderHook(() => useAiChat());
        await act(async () => { result.current.setInput("Fixture prompt"); });
        let pending!: Promise<void>;
        await act(async () => { pending = result.current.handleSend(); });
        await act(async () => {
          stream.enqueue('data: {"type":"chunk","text":"Draft"}\ndata: {"type":"chunk","text":" queued"}\n');
        });
        const writes = mocks.updateAiMessage.mock.calls.length;
        if (context === "actor") mockStore.user = { id: "actor-2", email: "other@example.test" };
        else if (context === "connection") mockStore.activeConnectionId = "connection-2";
        else if (context === "database") mockStore.activeDatabase = "other-db";
        else if (context === "chat") mockStore.activeAiChatId = "chat-2";
        else mockStore.accessToken = "fixture-session-2";
        // The live store guard must work without relying on effect timing.
        await act(async () => {
          stream.enqueue(`data: ${JSON.stringify({ type: "done", data: { message: "Stale answer", generationId: "stale-generation",
            usageCoverage: "complete", attemptCount: 8, measuredAttemptCount: 8, costCoverage: "unavailable",
            usage: { promptTokens: 0, completionTokens: 999, totalTokens: 999 }, observedUsage: { totalTokens: 999 } } })}\n\n`);
          await pending;
          await vi.advanceTimersByTimeAsync(50);
        });
        rerender();
        expect(stream.cancel).toHaveBeenCalledTimes(1);
        expect(stream.body.locked).toBe(false);
        expect(mocks.updateAiMessage).toHaveBeenCalledTimes(writes);
        expect(mocks.syncAiMessage).not.toHaveBeenCalled();
        expect(messages.at(-1)!.content).toBe("Draft");
        expect(messages.at(-1)!.generationId).toBeUndefined();
        for (const key of ["usageCoverage", "attemptCount", "measuredAttemptCount", "costCoverage", "usage", "observedUsage"]) {
          expect((messages.at(-1)! as unknown as Record<string, unknown>)[key]).toBeUndefined();
        }
        expect(result.current.isLoading).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["actor", "connection"])("aborts pending headers immediately on a %s switch", async (context) => {
    const headers = deferred<Response>();
    mocks.generateSqlStream.mockReturnValueOnce(headers.promise);
    const { result, rerender } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    const signal = mocks.generateSqlStream.mock.calls[0][1].signal as AbortSignal;
    if (context === "actor") mockStore.user = { id: "actor-2", email: "other@example.test" };
    else mockStore.activeConnectionId = "connection-2";
    rerender();
    await act(async () => { await pending; });
    expect(signal.aborted).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mocks.updateAiMessage).not.toHaveBeenCalled();
    expect(mocks.syncAiMessage).not.toHaveBeenCalled();
    const late = controlledResponse();
    await act(async () => { headers.resolve(late.response); await Promise.resolve(); });
    expect(late.cancel).toHaveBeenCalledTimes(1);
  });

  it.each(["done", "error"])("keeps the first %s terminal and syncs it once despite later events", async (terminal) => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const stream = controlledResponse();
      const terminalEvent = terminal === "done"
        ? { type: "done", data: { message: "Final answer", generationId: "returned-generation", usage: { totalTokens: 7 } } }
        : { type: "error", text: "Fixture provider failure" };
      stream.enqueue([
        'data: {"type":"chunk","text":"Draft"}',
        'data: {"type":"chunk","text":" queued"}',
        `data: ${JSON.stringify(terminalEvent)}`,
        'data: {"type":"chunk","text":" stale chunk"}',
        'data: {"type":"done","data":{"message":"Stale final","generationId":"stale-generation"}}',
        'data: {"type":"error","text":"Stale error"}',
        "", "",
      ].join("\n"));
      mocks.generateSqlStream.mockResolvedValueOnce(stream.response);
      const { result } = renderHook(() => useAiChat());
      await act(async () => { result.current.setInput("Fixture prompt"); });
      await act(async () => { await result.current.handleSend(); });
      const final = messages.at(-1)!;
      expect(final.content).toContain(terminal === "done" ? "Final answer" : "Fixture provider failure");
      expect(final.content).not.toMatch(/queued|stale/i);
      expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
      expect(mocks.updateAiMessage).toHaveBeenCalledTimes(2);
      expect(stream.read).toHaveBeenCalledTimes(1);
      expect(stream.cancel).toHaveBeenCalledTimes(1);
      expect(stream.body.locked).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      expect(mocks.updateAiMessage).toHaveBeenCalledTimes(2);
      expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
      if (terminal === "done") expect(final.generationId).toBe("returned-generation");
      expect(result.current.isLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes and syncs a non-terminal legacy stream exactly once at EOF", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    mocks.generateSqlStream.mockResolvedValueOnce(streamResponse(
      'data: {"type":"chunk","text":"Draft"}\ndata: {"type":"chunk","text":" answer"}\n\n',
    ));
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    await act(async () => { await result.current.handleSend(); });
    expect(messages.at(-1)!.content).toBe("Draft answer");
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)!.modelInfo).toBeUndefined();
  });

  it("does not let an old owner's finally clear the new loading state or controller", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      const old = controlledResponse();
      const next = controlledResponse();
      mocks.generateSqlStream.mockResolvedValueOnce(old.response).mockResolvedValueOnce(next.response);
      const { result } = renderHook(() => useAiChat());
      await act(async () => { result.current.setInput("First prompt"); });
      let first!: Promise<void>;
      await act(async () => { first = result.current.handleSend(); });
      await act(async () => {
        old.enqueue('data: {"type":"chunk","text":"Old draft"}\ndata: {"type":"chunk","text":" queued"}\n');
        result.current.setInput("Next prompt");
      });
      const firstId = messages.at(-1)!.id;
      const oldSend = result.current.handleSend;
      let second!: Promise<void>;
      await act(async () => {
        result.current.handleStop();
        second = oldSend();
        await first;
      });
      expect(mocks.generateSqlStream).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(true);
      expect(next.body.locked).toBe(true);
      const secondId = messages.at(-1)!.id;
      expect(secondId).not.toBe(firstId);
      const secondSignal = mocks.generateSqlStream.mock.calls[1][1].signal as AbortSignal;
      expect(secondSignal.aborted).toBe(false);
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      expect(messages.at(-1)!.content).toBe("");
      await act(async () => { result.current.handleStop(); await second; });
      expect(secondSignal.aborted).toBe(true);
      expect(next.cancel).toHaveBeenCalledTimes(1);
      expect(next.body.locked).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(mocks.syncAiMessage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects duplicate send/retry/edit calls before React commits loading", async () => {
    const stream = controlledResponse();
    mocks.generateSqlStream.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Fixture prompt"); });
    const send = result.current.handleSend;
    const retry = result.current.handleRegenerate;
    const edit = result.current.handleEditSubmit;
    let pending!: Promise<void>;
    await act(async () => {
      pending = send();
      await send();
      await retry("chat-1", "ai-1");
      await edit("chat-1", "user-1", "Do not edit");
    });
    expect(mocks.generateSqlStream).toHaveBeenCalledTimes(1);
    expect(mocks.addAiMessage).toHaveBeenCalledTimes(2);
    expect(mocks.editAiMessage).not.toHaveBeenCalled();
    await act(async () => { result.current.handleStop(); await pending; });
  });

  it("reserves retry ownership while history editing is pending", async () => {
    const editPending = deferred<void>();
    mocks.editAiMessage.mockReturnValueOnce(editPending.promise);
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput("Keep this draft"); });
    const retry = result.current.handleRegenerate;
    const send = result.current.handleSend;
    const edit = result.current.handleEditSubmit;
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = retry("chat-1", "ai-1");
      await retry("chat-1", "ai-1");
      await send();
      await edit("chat-1", "user-1", "Do not edit");
    });
    expect(mocks.editAiMessage).toHaveBeenCalledTimes(1);
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(result.current.input).toBe("Keep this draft");
    await act(async () => { editPending.resolve(); await pending; });
    expect(mocks.generateSqlStream).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps the draft and history when the initial user save fails, without calling a provider", async () => {
    mocks.addAiMessage.mockImplementationOnce(async (_chatId: string, message: AiMessage) => {
      messages.push({ ...message, clientId: message.id, delivery: 'failed', deliveryError: { message: 'User save offline' } });
      throw new Error('User save offline');
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput('Keep my prompt'); });
    await act(async () => { await result.current.handleSend(); });
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(mocks.getActiveAdapter).not.toHaveBeenCalled();
    expect(mocks.addAiMessage).toHaveBeenCalledTimes(1);
    expect(messages).toHaveLength(3);
    expect(messages.at(-1)).toMatchObject({ content: 'Keep my prompt', delivery: 'failed' });
    expect(messages.at(-1)!.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.current.input).toBe('Keep my prompt');
    expect(result.current.isLoading).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('User save offline'));
    await act(async () => { await result.current.handleSend(); });
    expect(mocks.addAiMessage).toHaveBeenCalledTimes(2); // Initial user and one assistant; no duplicated user.
    expect(messages.filter(item => item.content === 'Keep my prompt')).toHaveLength(1);
    expect(mocks.generateSqlStream).toHaveBeenCalledTimes(1);
  });

  it("waits for the initial save and canonical ID before clearing the draft or generating", async () => {
    const saving = deferred<AiMessage>();
    mocks.addAiMessage.mockImplementationOnce((_chatId: string, message: AiMessage) => {
      messages.push({ ...message, clientId: message.id, delivery: 'pending' });
      return saving.promise;
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput('Pending prompt'); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.input).toBe('Pending prompt');
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    const local = messages.at(-1)!;
    await act(async () => {
      Object.assign(local, { id: 'canonical-user', delivery: 'saved' });
      saving.resolve(local);
      await pending;
    });
    expect(mocks.waitForAiMessagePersistence).toHaveBeenCalledWith('chat-1', local.clientId);
    expect(mocks.generateSqlStream).toHaveBeenCalledTimes(1);
    expect(mocks.generateSqlStream.mock.calls[0][0].history).toContainEqual({ role: 'user', content: 'Pending prompt' });
    expect(result.current.input).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it.each(['actor', 'logout', 'chat', 'delete', 'session', 'disabled'])(
    'does not generate from a late initial save after %s changes', async (context) => {
      const saving = deferred<AiMessage>();
      mocks.addAiMessage.mockImplementationOnce((_chatId: string, message: AiMessage) => {
        messages.push({ ...message, clientId: message.id, delivery: 'pending' });
        return saving.promise;
      });
      const { result, rerender } = renderHook(() => useAiChat());
      await act(async () => { result.current.setInput('Keep my draft'); });
      let pending!: Promise<void>;
      await act(async () => { pending = result.current.handleSend(); });
      const local = messages.at(-1)!;
      if (context === 'actor') mockStore.user = { id: 'actor-2' };
      else if (context === 'logout') { mockStore.isAuthenticated = false; mockStore.user = null; }
      else if (context === 'chat') mockStore.activeAiChatId = 'chat-2';
      else if (context === 'delete') mockStore.aiChats = [];
      else if (context === 'session') mockStore.accessToken = 'session-2';
      else mocks.enabled = false;
      rerender();
      await act(async () => { saving.resolve(local); await pending; });
      expect(mocks.generateSqlStream).not.toHaveBeenCalled();
      expect(mocks.getActiveAdapter).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    },
  );

  it('stops pending initial persistence without clearing the draft or starting generation', async () => {
    const saving = deferred<AiMessage>();
    mocks.addAiMessage.mockImplementationOnce((_chatId: string, message: AiMessage) => {
      messages.push({ ...message, clientId: message.id, delivery: 'pending' });
      return saving.promise;
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput('Keep stopped draft'); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    await act(async () => { result.current.handleStop(); await pending; });
    expect(result.current.input).toBe('Keep stopped draft');
    expect(result.current.isLoading).toBe(false);
    await act(async () => { saving.resolve(messages.at(-1)!); });
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(mocks.syncAiMessage).not.toHaveBeenCalled();
  });

  it('uses canonical IDs for alias edits and the committed edited prompt for replay', async () => {
    messages[0].id = 'canonical-user';
    messages[0].clientId = 'local-user';
    mocks.editAiMessage.mockImplementationOnce(async (_chatId: string, id: string) => {
      expect(id).toBe('canonical-user');
      messages[0].content = 'Server normalized prompt';
      messages.splice(1);
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      expect(await result.current.handleEditSubmit('chat-1', 'local-user', 'Edited prompt')).toBe(true);
    });
    expect(mocks.editAiMessage).toHaveBeenCalledWith('chat-1', 'canonical-user', 'Edited prompt');
    expect(mocks.generateSqlStream.mock.calls[0][0].prompt).toBe('Server normalized prompt');
  });

  it('retries an earlier aliased answer from its own user, not a later user message', async () => {
    messages[1].id = 'canonical-ai';
    messages[1].clientId = 'local-ai';
    messages.push({ id: 'later-user', role: 'user', content: 'Later prompt', timestamp: 3 });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { await result.current.handleRegenerate('chat-1', 'local-ai'); });
    expect(mocks.editAiMessage).toHaveBeenCalledWith('chat-1', 'user-1', 'Original prompt');
    expect(mocks.generateSqlStream.mock.calls[0][0].prompt).toBe('Original prompt');
  });

  it('retries a failed aliased assistant save without truncating history or invoking a provider', async () => {
    messages[1].id = 'canonical-ai';
    messages[1].clientId = 'local-ai';
    messages[1].delivery = 'failed';
    messages[1].deliveryError = { message: 'Assistant save offline' };
    const { result } = renderHook(() => useAiChat());
    await act(async () => { expect(await result.current.handleRegenerate('chat-1', 'local-ai')).toBe(true); });
    expect(mocks.syncAiMessage).toHaveBeenCalledWith('chat-1', expect.objectContaining({ id: 'canonical-ai', clientId: 'local-ai' }));
    expect(mocks.editAiMessage).not.toHaveBeenCalled();
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ content: 'Original answer', delivery: 'saved' });
  });

  it('awaits pending persistence before editing an aliased user message', async () => {
    const saving = deferred<AiMessage>();
    messages[0].clientId = 'local-user';
    messages[0].delivery = 'pending';
    mocks.waitForAiMessagePersistence.mockReturnValueOnce(saving.promise);
    const { result } = renderHook(() => useAiChat());
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.handleEditSubmit('chat-1', 'local-user', 'Edited prompt'); });
    expect(mocks.editAiMessage).not.toHaveBeenCalled();
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    await act(async () => {
      messages[0].id = 'canonical-user';
      messages[0].delivery = 'saved';
      saving.resolve(messages[0]);
      await pending;
    });
    expect(mocks.editAiMessage).toHaveBeenCalledWith('chat-1', 'canonical-user', 'Edited prompt');
  });

  it('retains the final assistant answer when storage fails and catches the rejected sync', async () => {
    mocks.syncAiMessage.mockImplementationOnce(async (_chatId: string, message: AiMessage) => {
      Object.assign(messages.at(-1)!, message, { delivery: 'failed', deliveryError: { message: 'Assistant save offline' } });
      throw new Error('Assistant save offline');
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput('Prompt'); });
    await act(async () => { await result.current.handleSend(); });
    expect(messages.at(-1)).toMatchObject({ content: 'Fixture answer', delivery: 'failed', deliveryError: { message: 'Assistant save offline' } });
    expect(messages.at(-1)!.error).not.toBe(true);
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Assistant save offline'));
    expect(result.current.isLoading).toBe(false);
  });

  it('waits for final assistant storage but Stop does not overwrite a completed answer', async () => {
    const saving = deferred<AiMessage>();
    mocks.syncAiMessage.mockImplementationOnce((_chatId: string, message: AiMessage) => {
      Object.assign(messages.at(-1)!, message, { delivery: 'pending' });
      return saving.promise;
    });
    const { result } = renderHook(() => useAiChat());
    await act(async () => { result.current.setInput('Prompt'); });
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.handleSend(); });
    expect(messages.at(-1)).toMatchObject({ content: 'Fixture answer', delivery: 'pending' });
    expect(result.current.isLoading).toBe(true);
    await act(async () => { result.current.handleStop(); await pending; });
    expect(messages.at(-1)!.content).toBe('Fixture answer');
    await act(async () => { saving.resolve(messages.at(-1)!); });
    expect(mocks.syncAiMessage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it.each(['actor', 'logout', 'chat', 'delete', 'session', 'disabled'])(
    'does not publish a late assistant save failure after %s changes', async (context) => {
      const saving = deferred<AiMessage>();
      mocks.syncAiMessage.mockReturnValueOnce(saving.promise);
      const { result, rerender } = renderHook(() => useAiChat());
      await act(async () => { result.current.setInput('Prompt'); });
      let pending!: Promise<void>;
      await act(async () => { pending = result.current.handleSend(); });
      const writes = mocks.updateAiMessage.mock.calls.length;
      if (context === 'actor') mockStore.user = { id: 'actor-2' };
      else if (context === 'logout') { mockStore.isAuthenticated = false; mockStore.user = null; }
      else if (context === 'chat') mockStore.activeAiChatId = 'chat-2';
      else if (context === 'delete') mockStore.aiChats = [];
      else if (context === 'session') mockStore.accessToken = 'session-2';
      else mocks.enabled = false;
      rerender();
      await act(async () => { saving.reject(new Error('Late assistant save failure')); await pending; });
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(mocks.updateAiMessage).toHaveBeenCalledTimes(writes);
      expect(result.current.isLoading).toBe(false);
    },
  );

  it('leaves the edited message and later history unchanged on atomic edit failure', async () => {
    const before = messages.map(message => ({ ...message }));
    mocks.editAiMessage.mockRejectedValueOnce(new Error('Atomic edit conflict'));
    const { result } = renderHook(() => useAiChat());
    await act(async () => { expect(await result.current.handleEditSubmit('chat-1', 'user-1', 'Edited prompt')).toBe(false); });
    expect(messages).toEqual(before);
    expect(mocks.generateSqlStream).not.toHaveBeenCalled();
    expect(mocks.addAiMessage).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Atomic edit conflict'));
  });

  it("best-effort aborts the active UI request when the account turns off", async () => {
    let finish!: (response: Response) => void;
    mocks.generateSqlStream.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useAiChat());
    await act(async () => {
      result.current.setInput("Fixture prompt");
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.handleSend();
    });
    await waitFor(() =>
      expect(mocks.generateSqlStream).toHaveBeenCalledTimes(1),
    );
    const signal = mocks.generateSqlStream.mock.calls[0][1]
      .signal as AbortSignal;
    mocks.enabled = false;
    rerender();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish(streamResponse());
      await pending;
    });
  });
});
