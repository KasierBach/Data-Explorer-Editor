import { Buffer } from "node:buffer";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { mockAuthenticatedApi } from "./support/authenticated-api";

// The parent supplies a preview-only config after building. Never collect images.
test.use({ screenshot: "off", trace: "off", video: "off" });

type Lang = "en" | "vi";
type SaveMode = "confirm" | "pending" | "reject";
type ApiCall = { method: string; path: string; payload?: unknown };
type Evidence = {
  bootstrap: boolean[];
  settings: Array<{ aiEnabled: boolean }>;
  aiTraffic: ApiCall[];
  storedTraffic: ApiCall[];
  queries: ApiCall[];
  blockedExternal: string[];
};
const evidenceByPage = new WeakMap<Page, Evidence>();
const USER_ID = "user-ai-policy-e2e";
const API_ORIGIN = "http://localhost:3001";
const apiHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:4173",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers":
    "Authorization, Content-Type, X-Requested-With",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const text = {
  en: {
    profile: "Profile",
    account: "Account Settings",
    configure: "Configure AI",
    closeProfile: "Close",
    toggle: "Toggle AI",
    off: "AI is off (click to turn on)",
    send: "Send message",
    closeAssistant: "Close AI assistant",
    history: "Chat history",
    newChat: "New conversation",
    sqlPrompt: "Type natural language to generate SQL...",
    sqlPlaceholder: "Describe what you want to query in natural language...",
    generateSql: "Generate SQL",
    explain: "AI Explain",
    actions: "Actions",
    testProvider: "Test connection",
  },
  vi: {
    profile: "Hồ sơ",
    account: "Cài đặt tài khoản",
    configure: "Cấu hình AI",
    closeProfile: "Đóng",
    toggle: "Bật/Tắt AI",
    off: "AI đang tắt (bấm để bật)",
    send: "Gửi tin nhắn",
    closeAssistant: "Đóng AI assistant",
    history: "Lịch sử chat",
    newChat: "Cuộc trò chuyện mới",
    sqlPrompt: "Gõ tiếng Việt để sinh SQL, ví dụ: 10 khách hàng mới nhất...",
    sqlPlaceholder: "Mô tả yêu cầu của bạn bằng tiếng Việt hoặc tiếng Anh...",
    generateSql: "Sinh SQL",
    explain: "Giải thích AI",
    actions: "Hành động",
    testProvider: "Kiểm tra kết nối",
  },
} satisfies Record<Lang, Record<string, string>>;

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: apiHeaders,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function prepare(
  page: Page,
  lang: Lang = "en",
  mode: SaveMode = "confirm",
  noSql = false,
) {
  const evidence: Evidence = {
    bootstrap: [],
    settings: [],
    aiTraffic: [],
    storedTraffic: [],
    queries: [],
    blockedExternal: [],
  };
  evidenceByPage.set(page, evidence);
  let aiEnabled = false;
  let pending: { route: Route; value: boolean } | undefined;
  const provider = {
    id: "provider-ai-fixture",
    name: "Fixture provider",
    type: "openai-compatible",
    baseUrl: "https://provider.example.test/v1",
    model: "fixture-model",
    models: ["fixture-model"],
    apiKeyConfigured: true,
    capabilities: {},
  };
  const chats = [
    {
      id: "chat-e2e",
      title: "Saved fixture chat",
      createdAt: "2026-11-08T00:00:00Z",
      updatedAt: "2026-11-08T00:00:00Z",
    },
  ];
  const user = () => ({
    id: USER_ID,
    email: "ai-policy@example.test",
    name: "AI Policy Fixture",
    role: "USER",
    isOnboarded: true,
    legalAcceptedAt: "2026-07-23T00:00:00Z",
    language: lang,
    aiEnabled,
  });

  // Setup runs once before the first navigation. Reload must use the UI's saved
  // workspace and the current auth response, not another injected account state.
  await page.addInitScript(
    ({ language, mongo }) => {
      if (sessionStorage.getItem("ui-ai-policy-fixture-seeded")) return;
      sessionStorage.setItem("ui-ai-policy-fixture-seeded", "true");
      localStorage.setItem("lang", language);
      localStorage.setItem(
        "data-explorer-storage",
        JSON.stringify({
          version: 0,
          state: {
            lang: language,
            activeConnectionId: mongo ? "mongo-e2e" : "connection-e2e",
            activeDatabase: mongo ? "warehouse" : "analytics",
            tabs: [
              {
                id: "ai-policy-query",
                title: "AI policy query",
                type: "query",
                metadata: { sql: "SELECT fixture_name FROM fixture_users" },
              },
            ],
            activeTabId: "ai-policy-query",
            activeAiChatId: "chat-e2e",
            pageStates: {
              "ai-chat-draft-chat-e2e": {
                input: "Keep this fixture draft",
                attachments: [],
              },
            },
            nosqlActiveConnectionId: "mongo-e2e",
            nosqlActiveDatabase: "warehouse",
            nosqlActiveCollection: "products",
            nosqlMqlQuery:
              '{"action":"find","collection":"products","filter":{},"limit":10}',
            nosqlViewMode: "tree",
            isSidebarOpen: false,
            isAiPanelOpen: false,
            isResultPanelOpen: false,
            isDesktopModeOnMobile: false,
          },
        }),
      );
      // A legacy enabled preference must not override the false account response.
      localStorage.setItem(
        "data-explorer-ai-preferences-v1",
        JSON.stringify({
          enabled: true,
          assistantModel: "groq:openai/gpt-oss-120b",
          explainModel: "__assistant__",
          sqlModel: "__assistant__",
          nosqlModel: "__assistant__",
          autocompleteModel: "__assistant__",
          customProviders: [],
          disabledProviders: ["cerebras"],
          fallbackProvider: "none",
        }),
      );
    },
    { language: lang, mongo: noSql },
  );

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== API_ORIGIN || request.method() === "OPTIONS") return;
    const call: ApiCall = { method: request.method(), path: url.pathname };
    if (request.postData()) call.payload = request.postDataJSON();
    if (
      /^\/api\/ai\/(?:nlp-to-sql|generate-sql(?:-stream)?|autocomplete|providers\/status)$/.test(
        url.pathname,
      ) ||
      /^\/api\/ai\/providers\/(?:test|[^/]+\/(?:test|models|refresh))$/.test(
        url.pathname,
      )
    )
      evidence.aiTraffic.push(call);
    if (
      /^\/api\/ai\/(?:chats|providers)(?:\/|$)/.test(url.pathname) &&
      !evidence.aiTraffic.includes(call)
    )
      evidence.storedTraffic.push(call);
    if (url.pathname === "/api/query") evidence.queries.push(call);
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:4173" || url.origin === API_ORIGIN)
      return route.continue();
    evidence.blockedExternal.push(route.request().url());
    await route.abort();
  });
  await mockAuthenticatedApi(page);
  // Narrow scenario overlay; all unrelated bootstrap routes stay on the existing helper.
  await page.route("http://localhost:3001/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: apiHeaders });
    if (path === "/api/auth/refresh" && request.method() === "POST") {
      evidence.bootstrap.push(aiEnabled);
      return json(route, {
        access_token: "e2e-access-token",
        accessTokenExpiresAt: 4_102_444_800,
        user: user(),
      });
    }
    if (
      request.method() === "GET" &&
      ["/api/auth/me", "/api/users/me"].includes(path)
    )
      return json(route, user());
    if (path === "/api/users/settings" && request.method() === "PATCH") {
      const payload = request.postDataJSON() as { aiEnabled: boolean };
      expect(Object.keys(payload)).toEqual(["aiEnabled"]);
      expect(typeof payload.aiEnabled).toBe("boolean");
      evidence.settings.push(payload);
      if (mode === "reject")
        return json(
          route,
          {
            message: "Fixture AI settings save failed.",
            reason: "AI_SETTING_SAVE_FAILED",
          },
          500,
        );
      if (mode === "pending" && evidence.settings.length === 1) {
        pending = { route, value: payload.aiEnabled };
        return;
      }
      aiEnabled = payload.aiEnabled;
      return json(route, { id: USER_ID, aiEnabled });
    }
    if (path === "/api/metadata/hierarchy" && request.method() === "POST")
      return json(route, []);
    if (path === "/api/ai-quality/my-usage" && request.method() === "GET")
      return json(route, {
        generations: 0,
        tokens: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          trackedRequests: 0,
        },
      });
    if (path === "/api/ai/providers/status")
      return json(route, { providers: { groq: true, gemini: true } });
    if (path === "/api/ai/providers" && request.method() === "GET")
      return json(route, [provider]);
    if (
      path === `/api/ai/providers/${provider.id}` &&
      request.method() === "PATCH"
    ) {
      Object.assign(provider, request.postDataJSON());
      return json(route, provider);
    }
    if (
      /^\/api\/ai\/providers\/(?:test|[^/]+\/(?:test|models|refresh))$/.test(
        path,
      )
    )
      return json(route, { ok: true, models: ["fixture-model"], latencyMs: 1 });
    if (path === "/api/ai/chats" && request.method() === "GET")
      return json(route, chats);
    if (path === "/api/ai/chats" && request.method() === "POST") {
      const chat = {
        ...chats[0],
        id: `chat-new-${chats.length}`,
        title: "New fixture conversation",
      };
      chats.push(chat);
      return json(route, chat, 201);
    }
    if (/^\/api\/ai\/chats\/[^/]+$/.test(path) && request.method() === "GET")
      return json(route, {
        messages: [
          {
            id: "saved-user",
            role: "user",
            content: "Saved fixture question",
            createdAt: "2026-11-08T00:00:00Z",
          },
          {
            id: "saved-model",
            role: "model",
            content: "Saved fixture answer",
            createdAt: "2026-11-08T00:00:01Z",
          },
        ],
      });
    if (
      /^\/api\/ai\/chats\/[^/]+(?:\/messages(?:\/[^/]+(?:\/after)?)?)?$/.test(
        path,
      )
    )
      return json(route, { success: true });
    if (path === "/api/ai/nlp-to-sql")
      return json(route, {
        sql: "SELECT 42 AS fixture_result",
        explanation: "Fixture generation confirmed.",
        generationId: "ai-policy-fixture-generation",
      });
    if (path === "/api/ai/generate-sql-stream")
      return route.fulfill({
        status: 200,
        headers: apiHeaders,
        contentType: "text/event-stream",
        body: 'data: {"type":"done","data":{"message":"Fixture chat response"}}\n\n',
      });
    if (path === "/api/ai/generate-sql")
      return json(route, { message: "Fixture explanation" });
    if (path === "/api/ai/autocomplete") return json(route, { completion: "" });
    return route.fallback();
  });
  return {
    evidence,
    async confirmPending() {
      expect(pending).toBeDefined();
      const save = pending!;
      pending = undefined;
      aiEnabled = save.value;
      await json(save.route, { id: USER_ID, aiEnabled });
    },
  };
}

async function openAssistant(page: Page, lang: Lang) {
  await page
    .getByRole("button", { name: "AI Assistant (Ctrl+I)", exact: true })
    .click();
  const assistant = page
    .locator("aside")
    .filter({ has: page.getByRole("switch", { name: text[lang].toggle }) });
  await expect(
    assistant.getByRole("switch", { name: text[lang].toggle }),
  ).toBeVisible();
  return assistant;
}

async function openProfileAi(page: Page, lang: Lang) {
  await page
    .getByRole("button", { name: text[lang].profile, exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^${text[lang].profile}`) })
    .click();
  const dialog = page.getByRole("dialog", {
    name: text[lang].account,
    exact: true,
  });
  await dialog
    .getByRole("button", { name: text[lang].configure, exact: true })
    .click();
  await expect(
    dialog.getByRole("switch", { name: text[lang].toggle }),
  ).toBeVisible();
  return dialog;
}

async function openSqlPrompt(page: Page, lang: Lang) {
  const main = page.locator("main");
  await main.getByRole("button", { name: /^(AI SQL|AI)$/ }).click();
  await page.getByText(text[lang].sqlPrompt, { exact: true }).click();
  return page.getByPlaceholder(text[lang].sqlPlaceholder, { exact: true });
}

async function expectExplainOff(page: Page, lang: Lang) {
  const main = page.locator("main");
  const desktop = main.getByRole("button", {
    name: text[lang].explain,
    exact: true,
  });
  const actions = main.getByRole("button", {
    name: text[lang].actions,
    exact: true,
  });

  await expect(desktop.or(actions)).toBeVisible();
  if (await desktop.isVisible()) {
    await expect(desktop).toBeDisabled();
    return;
  }

  await actions.click();
  await expect(
    page.getByRole("menuitem", { name: text[lang].explain, exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
}

async function expectNoAi(evidence: Evidence) {
  // The debounce is 350ms; observe the entire dispatch window, not just the click.
  expect(evidence.aiTraffic).toEqual([]);
}

test.afterEach(async ({ page }, info: TestInfo) => {
  const evidence = evidenceByPage.get(page);
  if (evidence)
    await info.attach(`ui-browser-${info.title.split(" ")[0]}-requests`, {
      body: Buffer.from(JSON.stringify(evidence, null, 2)),
      contentType: "application/json",
    });
});

test("UI-AI-001 EN off gates SQL shortcut, ghost text and chat while stored configuration remains usable", async ({
  page,
}) => {
  const { evidence } = await prepare(page);
  await page.goto("/sql-explorer");
  const editor = page.locator("main .monaco-editor textarea").first();
  await expect(editor).toBeVisible();
  await editor.press("End");
  await editor.pressSequentially(" fixture ");
  await page.waitForTimeout(450);
  expect(evidence.aiTraffic).toEqual([]);
  const prompt = await openSqlPrompt(page, "en");
  await prompt.fill("List fixture users");
  await expect(
    page.getByRole("button", { name: "Generate SQL", exact: true }),
  ).toBeDisabled();
  await prompt.press("Control+Enter");
  await page.keyboard.press("Escape");
  await expectExplainOff(page, "en");

  const assistant = await openAssistant(page, "en");
  await expect(
    assistant.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  const composer = assistant.locator("textarea");
  await expect(composer).toBeDisabled();
  await expect(composer).toHaveValue("Keep this fixture draft");
  // A disabled composer cannot receive ordinary keyboard input; do not force
  // focus/events. The editable SQL/MQL draft fields exercise Enter below.
  await expect(
    assistant.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await expect(
    assistant.getByText("Saved fixture answer", { exact: true }),
  ).toBeVisible();

  const profile = await openProfileAi(page, "en");
  await expect(
    profile.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  await expect(
    profile.getByRole("button", { name: "Test connection", exact: true }),
  ).toBeDisabled();
  await profile.getByRole("button", { name: "Edit", exact: true }).click();
  const providerName = profile
    .locator("input")
    .filter({ visible: true })
    .first();
  await expect(providerName).toHaveValue("Fixture provider");
  await providerName.fill("Updated fixture provider");
  await profile
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByText("Custom AI provider updated.", { exact: true }),
  ).toBeVisible();
  expect(
    evidence.storedTraffic.some(
      (call) =>
        call.method === "PATCH" &&
        call.path === "/api/ai/providers/provider-ai-fixture",
    ),
  ).toBe(true);
  await profile.getByRole("button", { name: "Close", exact: true }).click();
  await assistant
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect
    .poll(
      () =>
        evidence.storedTraffic.filter(
          (call) => call.method === "POST" && call.path === "/api/ai/chats",
        ).length,
    )
    .toBe(1);
  await page.waitForTimeout(450);
  expect(evidence.bootstrap).toEqual([false]);
  await expectNoAi(evidence);
});

test("UI-AI-002 VI off labels and account authority apply to both master switches and SQL Enter", async ({
  page,
}) => {
  const { evidence } = await prepare(page, "vi");
  await page.goto("/sql-explorer");
  const prompt = await openSqlPrompt(page, "vi");
  await prompt.fill("Liệt kê người dùng fixture");
  await expect(
    page.getByRole("button", { name: "Sinh SQL", exact: true }),
  ).toBeDisabled();
  await prompt.press("Control+Enter");
  await page.keyboard.press("Escape");
  const assistant = await openAssistant(page, "vi");
  await expect(
    assistant.getByRole("switch", { name: "Bật/Tắt AI" }),
  ).toHaveAttribute("title", text.vi.off);
  await expect(
    assistant.getByRole("button", { name: "Gửi tin nhắn", exact: true }),
  ).toBeDisabled();
  const profile = await openProfileAi(page, "vi");
  await expect(
    profile.getByRole("switch", { name: "Bật/Tắt AI" }),
  ).not.toBeChecked();
  await expect(
    profile.getByRole("button", { name: "Kiểm tra kết nối", exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(450);
  await expectNoAi(evidence);
});

test("UI-AI-003 pending enable is shared, confirmed generation works, disable survives auth reload", async ({
  page,
}) => {
  const fixture = await prepare(page, "en", "pending");
  await page.goto("/sql-explorer");
  const assistant = await openAssistant(page, "en");
  const profile = await openProfileAi(page, "en");
  await profile.getByRole("switch", { name: "Toggle AI" }).click();
  await expect
    .poll(() => fixture.evidence.settings)
    .toEqual([{ aiEnabled: true }]);
  const switches = page.getByRole("switch", {
    name: "Toggle AI",
    includeHidden: true,
  });
  await expect(switches).toHaveCount(2);
  for (const control of await switches.all()) {
    await expect(control).toBeDisabled();
    await expect(control).not.toBeChecked();
  }
  expect(fixture.evidence.aiTraffic).toEqual([]);
  await fixture.confirmPending();
  await expect(
    profile.getByRole("switch", { name: "Toggle AI" }),
  ).toBeChecked();
  await profile.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    assistant.getByRole("switch", { name: "Toggle AI" }),
  ).toBeChecked();
  await assistant
    .getByRole("button", { name: "Close AI assistant", exact: true })
    .click();

  const prompt = await openSqlPrompt(page, "en");
  await prompt.fill("Return fixture result");
  await page.getByRole("button", { name: "Generate SQL", exact: true }).click();
  await expect(
    page.getByText("Fixture generation confirmed.", { exact: true }),
  ).toBeVisible();
  const generated = fixture.evidence.aiTraffic.filter(
    (call) => call.path === "/api/ai/nlp-to-sql",
  );
  expect(generated).toHaveLength(1);
  expect(generated[0].payload).toEqual(
    expect.objectContaining({
      disabledProviders: ["cerebras"],
      fallbackProvider: "none",
    }),
  );
  await page.keyboard.press("Escape");
  const activeAssistant = await openAssistant(page, "en");
  await activeAssistant.getByRole("switch", { name: "Toggle AI" }).click();
  await expect(
    activeAssistant.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  expect(fixture.evidence.settings).toEqual([
    { aiEnabled: true },
    { aiEnabled: false },
  ]);
  const trafficAfterDisable = fixture.evidence.aiTraffic.length;
  await activeAssistant
    .getByRole("button", { name: "Close AI assistant", exact: true })
    .click();
  await page.reload();
  const restoredAssistant = await openAssistant(page, "en");
  await expect(
    restoredAssistant.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  await expect(restoredAssistant.locator("textarea")).toBeDisabled();
  await page.waitForTimeout(450);
  expect(fixture.evidence.bootstrap).toEqual([false, false]);
  expect(fixture.evidence.aiTraffic).toHaveLength(trafficAfterDisable);
  expect(fixture.evidence.queries).toEqual([]);
});

test("UI-AI-004 rejected enable leaves both controls false and reload does not enable inference", async ({
  page,
}) => {
  const { evidence } = await prepare(page, "en", "reject");
  await page.goto("/sql-explorer");
  const assistant = await openAssistant(page, "en");
  await assistant.getByRole("switch", { name: "Toggle AI" }).click();
  await expect(
    page.getByText("Fixture AI settings save failed.", { exact: true }),
  ).toBeVisible();
  await expect(
    assistant.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  const profile = await openProfileAi(page, "en");
  await expect(
    profile.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  await profile.getByRole("button", { name: "Close", exact: true }).click();
  await assistant
    .getByRole("button", { name: "Close AI assistant", exact: true })
    .click();
  await page.reload();
  const restoredAssistant = await openAssistant(page, "en");
  await expect(
    restoredAssistant.getByRole("switch", { name: "Toggle AI" }),
  ).not.toBeChecked();
  await expect(restoredAssistant.locator("textarea")).toBeDisabled();
  expect(evidence.settings).toEqual([{ aiEnabled: true }]);
  expect(evidence.bootstrap).toEqual([false, false]);
  await expectNoAi(evidence);
});

test("UI-AI-005 off MQL and aggregation prompts reject keyboard dispatch without querying a database", async ({
  page,
}) => {
  const { evidence } = await prepare(page, "en", "confirm", true);
  await page.goto("/nosql-explorer");
  const main = page.locator("main");
  await expect(main.getByText("db.products", { exact: true })).toBeVisible();
  await main.getByRole("button", { name: "AI NoSQL", exact: true }).click();
  await page
    .getByText("Type natural language to generate MQL...", { exact: true })
    .click();
  const prompt = page.getByPlaceholder(
    "Describe your MongoDB query request...",
    { exact: true },
  );
  await prompt.fill("List fixture products");
  await expect(
    page.getByRole("button", { name: "Generate MQL", exact: true }),
  ).toBeDisabled();
  await prompt.press("Control+Enter");
  await page.keyboard.press("Escape");
  await main
    .getByRole("button", { name: /^(Aggregation Pipeline|Pipeline)$/ })
    .click();
  await main
    .getByRole("button", { name: "Build with AI", exact: true })
    .click();
  const pipeline = page.getByPlaceholder(
    "Example: Group movies by genre, count them, and return the top 10 groups...",
    { exact: true },
  );
  await pipeline.fill("Group fixture products by category");
  await expect(
    page.getByRole("button", { name: "Generate pipeline", exact: true }),
  ).toBeDisabled();
  await pipeline.press("Control+Enter");
  await page.waitForTimeout(450);
  await expectNoAi(evidence);
});
