import {
  Bot,
  Gauge,
  Route,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  Callout,
  CodeBlock,
  CodeComment,
  CodeLine,
  DocPageLayout,
  DocSection,
  FeatureGrid,
  InfoCard,
  Prose,
} from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function AiServiceSection({ lang }: Props) {
  const t = lang === "vi";

  return (
    <DocPageLayout
      title={t ? "Định tuyến AI & Trợ lý" : "AI Routing & Assistant"}
      subtitle={
        t
          ? "Cách Data Explorer chọn lane AI, cho phép cấu hình model theo từng vai trò, và giữ ranh giới rõ ràng giữa chat, SQL/MQL generation, vision, live search, cùng các guardrail thực thi."
          : "How Data Explorer chooses AI lanes, lets you configure models per role, and keeps clear boundaries between chat, SQL/MQL generation, vision, live search, and execution guardrails."
      }
      gradient
    >
      <FeatureGrid columns={3}>
        <InfoCard
          icon={<Route className="h-6 w-6 text-blue-500" />}
          title={t ? "Routing theo ngữ cảnh" : "Context-driven routing"}
          color="blue"
        >
          <p>
            {t
              ? "AI không chạy theo một model cứng duy nhất. Prompt ngắn, prompt dài, ảnh đính kèm, và yêu cầu thông tin hiện thời có thể đi qua các lane khác nhau nếu routing mode và capability cho phép."
              : "AI does not run through one hard-coded model. Short prompts, longer tasks, image input, and current-information requests can travel through different lanes when the routing mode and capability filters allow it."}
          </p>
        </InfoCard>
        <InfoCard
          icon={<Sparkles className="h-6 w-6 text-emerald-500" />}
          title={t ? "Cấu hình theo vai trò" : "Role-based configuration"}
          color="emerald"
        >
          <p>
            {t
              ? "Mỗi vai trò như AI Assistant, Explain, AI SQL, AI NoSQL, và Autocomplete có thể dùng chung model chính hoặc dùng model riêng để tối ưu chi phí, tốc độ, hay chất lượng theo đúng luồng công việc."
              : "Each role such as AI Assistant, Explain, AI SQL, AI NoSQL, and Autocomplete can inherit the main assistant model or use its own dedicated model to optimize for cost, speed, or quality."}
          </p>
        </InfoCard>
        <InfoCard
          icon={<Shield className="h-6 w-6 text-amber-500" />}
          title={t ? "Guardrail vẫn là lớp cuối" : "Guardrails remain final"}
          color="amber"
        >
          <p>
            {t
              ? "AI có thể sinh câu lệnh, giải thích truy vấn, hoặc đề xuất bước tiếp theo, nhưng editor, connection policy, và backend guardrails vẫn là lớp quyết định cuối cùng trước khi thực thi thật."
              : "AI can generate statements, explain queries, or suggest next steps, but the editor, connection policy, and backend guardrails still make the final decision before real execution."}
          </p>
        </InfoCard>
      </FeatureGrid>

      <DocSection
        title={t ? "Configure AI theo từng vai trò" : "Configure AI by role"}
      >
        <Prose>
          {t
            ? "Trong `Hồ sơ > Cấu hình AI`, bạn có thể cấu hình riêng model cho từng luồng chính của app. Đây là phần quan trọng nhất nếu bạn muốn assistant, explain, SQL, NoSQL, và autocomplete không còn bị buộc đi chung một model."
            : "In `Profile > Configure AI`, you can configure a separate model for each major AI workflow. This is the key surface if you do not want assistant, explain, SQL, NoSQL, and autocomplete to share one model."}
        </Prose>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              titleVi: "AI Assistant",
              titleEn: "AI Assistant",
              descVi:
                "Model dùng cho panel chat chính, gợi ý tổng quát, và các thao tác AI mang tính hội thoại. Khi bạn đổi vai trò này, model assistant ngoài workspace cũng cập nhật theo ngay.",
              descEn:
                "The model used by the main chat panel, general assistance, and conversational AI flows. When you change this role, the visible assistant model outside the settings surface updates immediately.",
            },
            {
              titleVi: "Explain",
              titleEn: "Explain",
              descVi:
                "Model dành riêng cho dialog giải thích truy vấn. Vai trò này hữu ích khi bạn muốn phần giải thích chi tiết hơn, ổn định hơn, hoặc rẻ hơn so với chat chung.",
              descEn:
                "A dedicated model for the query explanation dialog. This role is useful when you want explanations to be more detailed, more stable, or cheaper than the general assistant.",
            },
            {
              titleVi: "AI SQL",
              titleEn: "AI SQL",
              descVi:
                "Model chuyên cho tạo SQL, sửa SQL, tối ưu, hoặc đề xuất index. Bạn có thể để vai trò này nghiêng về reasoning hoặc tốc độ tùy loại truy vấn mình làm hàng ngày.",
              descEn:
                "A model specialized for SQL generation, fixing, optimization, or index suggestions. You can bias this role toward heavier reasoning or faster iteration depending on your day-to-day queries.",
            },
            {
              titleVi: "AI NoSQL",
              titleEn: "AI NoSQL",
              descVi:
                "Model dành cho MongoDB/NoSQL generation, giải thích pipeline, và các flow JSON-oriented. Tách riêng vai trò này giúp tránh dùng model SQL-centric cho tác vụ tài liệu hóa dữ liệu dạng document.",
              descEn:
                "A model for MongoDB/NoSQL generation, pipeline explanation, and JSON-oriented workflows. Keeping this role separate avoids forcing a SQL-centric model into document-style tasks.",
            },
            {
              titleVi: "Autocomplete",
              titleEn: "Autocomplete",
              descVi:
                "Model dành cho ghost text và inline completions ngay trong editor. Tách riêng vai trò này hữu ích khi bạn muốn gợi ý gõ tiếp thật nhanh, ngắn, và rẻ hơn phần chat hoặc explain.",
              descEn:
                "A dedicated model for ghost text and inline completions inside the editor. Splitting this role out is useful when you want typing suggestions to stay fast, short, and cheaper than chat or explain.",
            },
          ].map((item) => (
            <div
              key={item.titleEn}
              className="rounded-2xl border border-border/60 bg-card/40 p-5"
            >
              <h3 className="text-sm font-bold">
                {t ? item.titleVi : item.titleEn}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t ? item.descVi : item.descEn}
              </p>
            </div>
          ))}
        </div>

        <Callout type="info">
          <p className="text-sm">
            {t
              ? "Các vai trò `Explain`, `AI SQL`, `AI NoSQL`, và `Autocomplete` có thể chọn chế độ dùng lại model của Assistant. Cách này giúp bạn chỉ quản lý một model chính, nhưng vẫn có thể tách riêng từng vai trò khi cần."
              : "`Explain`, `AI SQL`, `AI NoSQL`, and `Autocomplete` can inherit the Assistant model. This keeps one central model when you want simplicity, while still allowing each role to be split out later."}
          </p>
        </Callout>
      </DocSection>

      <DocSection
        title={
          t
            ? "Custom OpenAI-compatible providers"
            : "Custom OpenAI-compatible providers"
        }
      >
        <Prose>
          {t
            ? "Ngoài các lane có sẵn như Gemini, OpenRouter, Groq, Cerebras, và Beeknoee, app còn cho phép bạn thêm provider OpenAI-compatible của riêng mình ngay trong UI. Form hiện tại hỗ trợ tên provider, Base URL, API key, model mặc định, và nút tải danh sách model từ endpoint đó."
            : "Besides built-in lanes such as Gemini, OpenRouter, Groq, Cerebras, and Beeknoee, the app also lets you add your own OpenAI-compatible provider directly in the UI. The current form supports a provider name, base URL, API key, default model, and a button to load the model list from that endpoint."}
        </Prose>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t ? "Load models từ provider" : "Load models from the provider"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Khi Base URL và API key hợp lệ, nút `Tải model` sẽ gọi endpoint lấy catalog model để bạn chọn nhanh bằng dropdown tìm kiếm. Nếu endpoint không trả catalog, bạn vẫn có thể nhập model thủ công."
                : "When the Base URL and API key are valid, the `Load models` button requests the provider model catalog so you can choose from a searchable dropdown. If the endpoint does not return a catalog, you can still type the model manually."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t
                ? "Lưu cục bộ theo máy/người dùng"
                : "Stored locally per machine/user"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Custom provider và role preference được lưu cục bộ trên client hiện tại. Chúng không thay thế `server/.env`, cũng không tự biến thành lane dùng chung cho toàn bộ hệ thống."
                : "Custom providers and role preferences are stored locally on the current client. They do not replace `server/.env`, and they do not automatically become shared global lanes for the whole system."}
            </p>
          </div>
        </div>

        <CodeBlock
          title={t ? "Ví dụ provider tùy chỉnh" : "Custom provider example"}
        >
          <CodeComment>
            {t
              ? "Các trường chính trong Configure AI"
              : "Core fields in Configure AI"}
          </CodeComment>
          <CodeLine>Provider name: My Provider</CodeLine>
          <CodeLine>Base URL: https://your-provider.example.com/v1</CodeLine>
          <CodeLine>API key: sk-...</CodeLine>
          <CodeLine>Default model: custom-model-name</CodeLine>
        </CodeBlock>
      </DocSection>

      <DocSection
        title={
          t
            ? "Các routing mode trong panel AI"
            : "Routing modes in the AI panel"
        }
      >
        <Prose>
          {t
            ? "Routing mode là lớp điều khiển ở trên model picker. Nó quyết định app nên ưu tiên ổn định, chi phí, tốc độ, hay chất lượng cho request hiện tại."
            : "Routing mode sits above the model picker. It decides whether the app should favor stability, cost, speed, or quality for the current request."}
        </Prose>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Auto",
              descVi:
                "Mode mặc định cho đa số tác vụ. App bắt đầu từ auto chain rồi lọc lại theo capability như vision hoặc live search khi prompt thực sự cần.",
              descEn:
                "The default mode for most tasks. The app starts from the auto chain and then filters it by capabilities such as vision or live search when the prompt genuinely needs them.",
            },
            {
              title: "Fast / Cheap",
              descVi:
                "Nghiêng về lane rẻ hơn và phản hồi nhanh hơn, nhưng không ghi đè explicit provider nếu bạn đã khóa model cụ thể.",
              descEn:
                "Leans toward cheaper and faster lanes, but does not override an explicit provider if you already locked a concrete model.",
            },
            {
              title: "Best Quality",
              descVi:
                "Phù hợp cho prompt dài, tái cấu trúc truy vấn, explain sâu, hoặc những request cần reasoning chắc hơn.",
              descEn:
                "Best for long prompts, deeper query rewrites, detailed explanations, or requests that need stronger reasoning.",
            },
            {
              title: "Gemini Only",
              descVi:
                "Khóa workflow vào lane Gemini đã chọn để giảm khác biệt giữa nhiều provider và giữ hành vi ổn định hơn.",
              descEn:
                "Locks the workflow to the selected Gemini lane to reduce cross-provider variance and keep behavior more predictable.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/60 bg-card/40 p-5"
            >
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t ? item.descVi : item.descEn}
              </p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        title={
          t
            ? "Provider lanes hiện có trong app"
            : "Provider lanes currently exposed in the app"
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            icon={<Bot className="h-5 w-5 text-violet-500" />}
            title="Gemini"
            color="purple"
          >
            <p className="text-xs">
              {t
                ? "Lane chất lượng cao cho reasoning dài, image input, và các task cần độ ổn định cao hơn."
                : "The higher-quality lane for longer reasoning, image input, and tasks that need stronger reliability."}
            </p>
          </InfoCard>
          <InfoCard
            icon={<Search className="h-5 w-5 text-emerald-500" />}
            title="OpenRouter"
            color="emerald"
          >
            <p className="text-xs">
              {t
                ? "Lane đa model linh hoạt cho fallback rộng hơn, và với một số model còn có thể tham gia vision hoặc live-search paths."
                : "A flexible multi-model lane used for broader fallback and, with some models, vision or live-search paths."}
            </p>
          </InfoCard>
          <InfoCard
            icon={<Gauge className="h-5 w-5 text-amber-500" />}
            title="Groq"
            color="amber"
          >
            <p className="text-xs">
              {t
                ? "Lane phản hồi nhanh cho chat ngắn và iteration nhanh, không phải lane chính cho vision hoặc live search."
                : "A low-latency lane optimized for short chat and fast iteration rather than vision or live search."}
            </p>
          </InfoCard>
          <InfoCard
            icon={<Sparkles className="h-5 w-5 text-cyan-500" />}
            title="Cerebras"
            color="cyan"
          >
            <p className="text-xs">
              {t
                ? "Lane chi phí thấp hơn cho các tác vụ không cần ảnh và không cần live web search."
                : "A lower-cost lane for tasks that do not need images or live web search."}
            </p>
          </InfoCard>
          <InfoCard
            icon={<Bot className="h-5 w-5 text-green-500" />}
            title="Beeknoee"
            color="emerald"
          >
            <p className="text-xs">
              {t
                ? "Lane explicit model trong catalog khi bạn muốn khóa thẳng vào model của Beeknoee thay vì chỉ trông vào fallback mặc định."
                : "An explicit-model lane in the catalog when you want to target a Beeknoee model directly instead of relying on default fallback."}
            </p>
          </InfoCard>
        </div>

        <Callout type="info">
          <p className="text-sm">
            {t
              ? "Ghi chú triển khai quan trọng: `Beeknoee` hiện chưa tự được nhét vào auto chain mặc định. Lane này chỉ tham gia khi bạn chọn explicit model/provider hoặc khi code được mở rộng thêm trong tương lai."
              : "Important implementation note: `Beeknoee` is not injected into the default auto chain on its own right now. It participates when you explicitly select that provider or when the code is expanded later."}
          </p>
        </Callout>
      </DocSection>

      <DocSection
        title={
          t
            ? "Chọn model explicit thực sự làm gì?"
            : "What explicit model selection really changes"
        }
      >
        <Prose>
          {t
            ? "Model picker không chỉ đổi label cho đẹp. Với các model dạng `beeknoee:<slug>` hoặc `groq:<slug>`, app sẽ route thẳng sang provider tương ứng nếu provider đó đã được cấu hình. Đây là cách tốt nhất khi bạn muốn kiểm soát model output chặt hơn."
            : "The model picker is not just cosmetic. With models shaped like `beeknoee:<slug>` or `groq:<slug>`, the app routes directly into the matching provider when that provider is configured. This is the best control lever when you want tighter output behavior."}
        </Prose>

        <CodeBlock
          title={t ? "Ví dụ model selection" : "Model selection examples"}
        >
          <CodeComment>
            {t ? "Gemini chất lượng cao" : "Higher-quality Gemini lane"}
          </CodeComment>
          <CodeLine>gemini-3.5-flash</CodeLine>
          <p className="mt-3" />
          <CodeComment>
            {t
              ? "Provider explicit của Beeknoee"
              : "Explicit Beeknoee provider"}
          </CodeComment>
          <CodeLine>beeknoee:qwen-3-235b-a22b-instruct-2507</CodeLine>
        </CodeBlock>
      </DocSection>

      <DocSection
        title={
          t
            ? "Vision và live search: ranh giới hiện tại"
            : "Vision and live search: the current boundaries"
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t ? "Vision-capable lanes" : "Vision-capable lanes"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Trong repo hiện tại, Gemini là lane vision mặc định mạnh nhất. OpenRouter cũng có thể đóng vai trò vision nếu model được chọn thực sự hỗ trợ ảnh."
                : "In the current repo, Gemini is the strongest default vision lane. OpenRouter can also act as a vision path when the chosen model genuinely supports images."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t ? "Live-search lanes" : "Live-search lanes"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Live search không đồng nghĩa với “model nghe như có web”. Trong wiring hiện tại, live-search được dành cho Gemini hoặc OpenRouter."
                : "Live search is not the same as a model sounding web-aware. In the current wiring, live search is reserved for Gemini and OpenRouter."}
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection
        title={
          t
            ? "Action cards, suggestion cards, và an toàn thực thi"
            : "Action cards, suggestion cards, and execution safety"
        }
      >
        <Prose>
          {t
            ? "Khi AI trả ra thứ gì đó có thể dùng được ngay, app không ép mọi thứ thành một đoạn văn dài. Nó có thể tách SQL/MQL, explanation, nguồn tham chiếu, và recommendation cards thành các phần rõ ràng hơn để người dùng chọn bước tiếp theo."
            : "When AI returns something directly actionable, the app does not force everything into one long paragraph. It can separate SQL/MQL, explanations, sources, and recommendation cards so the user can choose the next step more deliberately."}
        </Prose>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t ? "Insert into editor" : "Insert into editor"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Lựa chọn này chỉ chèn query hoặc payload vào editor hiện tại. Nó chưa phải là bước thực thi thật."
                : "This option only inserts the query or payload into the current editor. It is not execution yet."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t
                ? "Run vẫn phải qua lớp app"
                : "Run still goes through the app layer"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Khi bạn chọn chạy, query vẫn phải đi qua query service, connection policy, và các guardrail của engine hiện tại. AI không có quyền bỏ qua các lớp đó."
                : "When you choose to run, the query still passes through the query service, connection policy, and engine guardrails. AI cannot bypass those layers."}
            </p>
          </div>
        </div>
      </DocSection>

      <Callout type="tip">
        <p className="text-sm font-medium">
          {t
            ? "Nếu muốn đọc docs AI của app theo đúng thực tế, hãy luôn tách 3 câu hỏi: model nào đang được chọn, provider nào thực sự chạy request, và capability nào đang được wiring trong repo thay vì chỉ được nhà cung cấp quảng bá bên ngoài."
            : "If you want the AI docs to stay grounded in reality, always separate three questions: which model is selected, which provider actually executes the request, and which capability is truly wired into this repo instead of merely advertised externally."}
        </p>
      </Callout>
    </DocPageLayout>
  );
}
