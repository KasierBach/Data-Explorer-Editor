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
import { publicPath } from "@/core/seo/publicRoutes";
import { getAssistantModelCatalog } from "@/presentation/modules/Query/assistantModelCatalog";

interface Props {
  lang: "vi" | "en";
}

export function AiServiceSection({ lang }: Props) {
  const t = lang === "vi";
  const modelGroups = getAssistantModelCatalog();

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
      <DocSection title={t ? "Cách dùng Trợ lý AI hằng ngày" : "Using the AI Assistant day to day"}>
        <div className="space-y-3">
          {[
            {
              step: "1",
              title: t ? "Mở panel AI và chọn model" : "Open the AI panel and pick a model",
              desc: t
                ? "Nhấn Ctrl+I (Windows/Linux) hoặc Cmd+I (macOS) để mở panel AI. Model mặc định là Groq GPT OSS 120B, một lựa chọn explicit. Auto là chế độ định tuyến riêng, không phải model trong dropdown; kiểm tra cả model lẫn fallback trước khi gửi."
                : "Press Ctrl+I (Windows/Linux) or Cmd+I (macOS) to open the AI panel. The default model is Groq GPT OSS 120B, an explicit selection. Auto is a separate routing mode, not a dropdown model; check both the selected model and fallback before sending.",
            },
            {
              step: "2",
              title: t ? "Đặt câu hỏi với ngữ cảnh schema" : "Ask questions with schema context",
              desc: t
                ? "Gõ câu hỏi ở ô nhập dưới cùng, ví dụ: 'viết truy vấn đếm đơn hàng theo tháng trong năm nay'. App chọn schema liên quan theo prompt, tối đa 24 bảng và 32.000 ký tự; AI không có toàn bộ database và vẫn có thể thiếu ngữ cảnh."
                : "Type a question in the composer, for example: 'write a query counting orders per month this year'. The app selects relevant schema for the prompt, up to 24 tables and 32,000 characters; AI does not receive the entire database and can still lack context.",
            },
            {
              step: "3",
              title: t ? "Chạy SQL gợi ý ngay trong editor" : "Run suggested SQL straight in the editor",
              desc: t
                ? "Đọc SQL trước khi bấm Run: thao tác này chèn vào editor và gửi thực thi ngay. Chỉ khi backend đánh dấu câu lệnh là high-impact mới có bước xác nhận; nguồn gốc AI không khiến mọi query đều phải xác nhận. Dùng Insert hoặc copy nếu muốn chỉnh trước."
                : "Read the SQL before pressing Run: it inserts into the editor and submits execution immediately. Confirmation appears only when the backend classifies the statement as high-impact; AI origin does not make every query require confirmation. Use Insert or copy when you want to edit first.",
            },
            {
              step: "4",
              title: t ? "Đính kèm ảnh, PDF và hỏi follow-up" : "Attach images/PDFs and ask follow-ups",
              desc: t
                ? "Dùng kẹp giấy với model có capability phù hợp. UI có thể chứa nhiều attachment nhưng chỉ ảnh đầu tiên và PDF đầu tiên có dữ liệu gốc được gửi vào đường native; ảnh thêm chỉ có ghi chú, PDF thêm dùng text trích xuất. PDF gốc tối đa 5 MiB ở client; nên giữ ảnh không quá 5 MB để giảm payload, không coi đó là image cap được thực thi. Follow-up dùng lịch sử có giới hạn."
                : "Use the paperclip with a model that has the matching capability. The UI can hold multiple attachments, but only the first image and first PDF with raw data reach native input; extra images become notes and extra PDFs use extracted text. Native PDFs have a 5 MiB client threshold; keep images within 5 MB as payload guidance, not an enforced image cap. Follow-ups use bounded history.",
            },
            {
              step: "5",
              title: t ? "Kiểm tra provider/model thực tế đã trả lời" : "Check which provider/model actually answered",
              desc: t
                ? "Mỗi phản hồi hiển thị provider và model thực tế đã xử lý (ví dụ 'Gemini 3.6 Flash') cùng nguồn trích dẫn nếu có live search — để bạn không nhầm lane khi routing đang hoạt động."
                : "Every response shows the actual provider and model that handled it (e.g. 'Gemini 3.6 Flash') plus cited sources when live search was used — so you never mistake the lane while routing is active.",
            },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/20">
              <span className="bg-primary/10 text-primary border rounded-lg px-3 py-1 text-xs font-bold whitespace-nowrap">
                {item.step}
              </span>
              <div>
                <p className="text-sm font-semibold mb-1">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </DocSection>

      <FeatureGrid columns={3}>
        <InfoCard
          icon={<Route className="h-6 w-6 text-blue-500" />}
          title={t ? "Routing theo ngữ cảnh" : "Context-driven routing"}
          color="blue"
        >
          <p>
            {t
              ? "Routing phụ thuộc model/provider explicit, fallback, provider đã cấu hình hoặc tắt, và capability ảnh/PDF/web. Khi không có model explicit, Auto, Fast / Cheap và Best Quality hiện dùng cùng thứ tự provider; nhãn mode không phải cam kết chọn model khác theo độ dài prompt."
              : "Routing depends on the explicit model/provider, fallback, configured or disabled providers, and image/PDF/web capabilities. Without an explicit model, Auto, Fast / Cheap, and Best Quality currently use the same provider order; the mode label is not a promise to switch models based on prompt length."}
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
            ? "Trong Configure AI, provider tùy chỉnh được lưu thành record thuộc người dùng trên server; API key được mã hóa trong metastore và không trả lại trong catalog công khai của tài khoản. Model theo vai trò và lựa chọn bật/tắt provider vẫn là preference local của trình duyệt. Chúng không thay thế server/.env hoặc tạo lane dùng chung cho cả hệ thống."
            : "In Configure AI, a custom provider is stored as a per-user record on the server; its API key is encrypted in the metastore and is not returned in the account’s provider listing. Role-model choices and provider enabled/disabled preferences remain local to the browser. They do not replace server/.env or create a shared system-wide lane."}
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
                ? "Load models / Test / Save"
                : "Load models / Test / Save"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Nhập Base URL, API key và model; dùng Load models nếu endpoint hỗ trợ catalog, hoặc nhập model thủ công. Test gửi một chat ngắn để kiểm tra kết nối; lỗi discovery không nhất thiết là lỗi chat. Save lưu cấu hình, không tự chứng minh vision/PDF hoạt động."
                : "Enter the Base URL, API key, and model; use Load models if the endpoint exposes a catalog, or type the model manually. Test sends a short chat to check connectivity; discovery failure does not necessarily mean chat failure. Save stores the configuration, not proof that vision/PDF works."}
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
            ? "Routing mode và model picker là hai cấu hình khác nhau. Với request không có model explicit, Auto, Fast / Cheap và Best Quality hiện đều xếp OpenRouter → Groq → Gemini → Cerebras, bỏ provider chưa cấu hình/đã tắt và lọc theo capability. Model mặc định của Assistant lại là Groq explicit nên thường đi theo nhánh requested model, không phải nhánh tự chọn này."
            : "Routing mode and the model picker are separate settings. With no explicit model, Auto, Fast / Cheap, and Best Quality currently order OpenRouter → Groq → Gemini → Cerebras, omitting unavailable/disabled providers and filtering capabilities. The Assistant default is an explicit Groq model, so it normally uses the requested-model branch rather than this unselected branch."}
        </Prose>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Auto",
              descVi:
                "Mode mặc định. Thử model explicit trước nếu có; nếu không có, dùng thứ tự tự chọn hiện tại. Ảnh, PDF gốc và live search còn lọc bỏ các candidate thiếu capability.",
              descEn:
                "The default mode. Tries an explicit model first when supplied; otherwise uses the current unselected order. Images, native PDFs, and live search also filter candidates that lack the required capability.",
            },
            {
              title: "Fast / Cheap",
              descVi:
                "Hiện không đổi thứ tự tự chọn so với Auto khi không có model explicit. Tên mode không bảo đảm request rẻ hơn hoặc nhanh hơn; chi phí và tốc độ phụ thuộc model/provider thực tế.",
              descEn:
                "Currently does not change the unselected order from Auto when no explicit model is supplied. Its name does not guarantee a cheaper or faster request; cost and latency depend on the actual model/provider.",
            },
            {
              title: "Best Quality",
              descVi:
                "Không đổi thứ tự tự chọn chung. Khi có built-in model explicit và fallback là Auto, best có thể đưa Gemini lên trước các fallback low-cost sau model được yêu cầu. Không áp dụng cho custom provider bị cô lập, fallback cụ thể hoặc None; không cam kết chất lượng cao hơn cho mọi request.",
              descEn:
                "Does not change the general unselected order. With an explicit built-in model and Auto fallback, best can put Gemini ahead of low-cost fallback candidates after the requested model. This does not apply to isolated custom providers, a specific fallback, or None, and is not a global quality guarantee.",
            },
            {
              title: "Gemini Only",
              descVi:
                "Ưu tiên các candidate Gemini khi Gemini có sẵn. Nếu Gemini thiếu cấu hình hoặc bị tắt và fallback không phải None, router vẫn có thể dùng provider khác. Vì vậy Gemini Only một mình không phải ranh giới cô lập provider.",
              descEn:
                "Uses Gemini candidates when Gemini is available. If Gemini is unconfigured or disabled and fallback is not None, the router can still use another provider. Gemini Only alone is therefore not a provider-isolation boundary.",
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

        <Callout type="warning">
          <p className="text-sm">
            {t
              ? "Fallback None không nối thêm provider dự phòng cho model explicit đã resolve. Ngoài Gemini Only, custom provider đã resolve được thử riêng và không dùng fallback built-in; Gemini Only có thể bỏ qua lựa chọn custom để dùng các candidate Gemini. Nhưng None không xác minh model/credential: nếu Groq/OpenRouter đã chọn không có cấu hình, hoặc custom selection local không còn tồn tại/đã tắt, app có thể resolve sang candidate hoặc Assistant khác. Gemini Only vẫn có thể thử nhiều model Gemini. Provider disabled lọc auto/fallback, không bảo đảm chặn một lựa chọn explicit. Muốn giới hạn dữ liệu, chọn provider explicit có sẵn, đặt None, kiểm tra role kế thừa và provider thực tế; request thiếu capability có thể bị từ chối."
              : "Fallback None does not append backup providers for a resolved explicit model. Outside Gemini Only, a resolved custom provider is tried alone without built-in fallback; Gemini Only can ignore the custom selection in favor of Gemini candidates. But None does not validate models/credentials: an unconfigured Groq/OpenRouter selection, or a missing/disabled local custom selection, can resolve to another candidate or the Assistant. Gemini Only can still try multiple Gemini models. Disabled providers are filtered from auto/fallback, not guaranteed to block an explicit selection. To limit data routing, choose an available explicit provider, set None, check inherited roles and the actual provider; a request without the required capability can be rejected."}
          </p>
        </Callout>
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
                ? "Gemini nhận ảnh/PDF gốc và hỗ trợ live web search trong wiring hiện tại. Model đã chọn vẫn phải có sẵn với API key và quota của deployment; không có cam kết chất lượng hay uptime tuyệt đối."
                : "Gemini accepts images/native PDFs and supports live web search in the current wiring. The selected model must still be available with the deployment’s API key and quota; this is not an absolute quality or uptime guarantee."}
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
                ? "Groq có model text; Qwen khớp capability vision nhận ảnh; Compound và Compound Mini có live web search. GPT OSS không tự có hai capability đó chỉ vì cùng provider."
                : "Groq has text models; the matching Qwen vision model accepts images; Compound and Compound Mini support live web search. GPT OSS does not inherit those capabilities merely by sharing the provider."}
            </p>
          </InfoCard>
          <InfoCard
            icon={<Sparkles className="h-5 w-5 text-cyan-500" />}
            title="Cerebras"
            color="cyan"
          >
            <p className="text-xs">
              {t
                ? "Cerebras là lane text cấu hình phía server và có thể tham gia auto/fallback khi sẵn sàng; không phải nhóm model selectable trong catalog Assistant hiện tại. Không có vision, PDF gốc hay live search trong wiring này."
                : "Cerebras is a server-configured text lane that can participate in auto/fallback when available; it is not a selectable model group in the current Assistant catalog. It has no image, native-PDF, or live-search wiring here."}
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
              ? "Beeknoee không tự tham gia auto chain mặc định. Bạn có thể chọn model explicit hoặc đặt Beeknoee làm fallback cụ thể khi provider đã cấu hình và chưa bị tắt cho fallback. Model khớp Gemini/Bee Gemini, MiniMax hoặc Claude có vision; GLM không được đánh dấu vision."
              : "Beeknoee is not part of the default auto chain. You can select an explicit model or set Beeknoee as a specific fallback when configured and not disabled for fallback. Matching Gemini/Bee Gemini, MiniMax, and Claude models have vision; GLM is not marked vision-capable."}
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
          title={t ? "Ví dụ từ catalog model của Assistant" : "Examples from the Assistant model catalog"}
        >
          {modelGroups.map((group) => (
            <div key={group.group}>
              <CodeComment>{group.group}</CodeComment>
              {group.items.slice(0, 2).map((model) => (
                <CodeLine key={model.id}>{model.id}</CodeLine>
              ))}
              <p className="mt-3" />
            </div>
          ))}
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
                ? "Ảnh: Gemini, OpenRouter model khớp vision, Groq Qwen khớp vision, Beeknoee model khớp vision, hoặc custom provider bật vision. PDF gốc: Gemini, OpenRouter, hoặc custom bật document. Capability PDF/document tách biệt với vision; bật flag không kiểm chứng khả năng của endpoint."
                : "Images: Gemini, matching OpenRouter vision models, matching Groq Qwen, matching Beeknoee vision models, or a custom provider with vision enabled. Native PDFs: Gemini, OpenRouter, or a custom provider with document enabled. PDF/document capability is separate from vision; setting a flag does not verify the endpoint’s actual support."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t ? "Live-search lanes" : "Live-search lanes"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Live web search được wiring cho Gemini, OpenRouter và Groq Compound/Compound Mini. Vision không đồng nghĩa web; custom provider, Cerebras và Beeknoee không được coi là live-search lane ở đây. Hãy kiểm tra nguồn và provider/model thực tế thay vì chỉ tin câu trả lời có vẻ cập nhật."
                : "Live web search is wired for Gemini, OpenRouter, and Groq Compound/Compound Mini. Vision does not imply web access; custom providers, Cerebras, and Beeknoee are not live-search lanes here. Check sources and the actual provider/model rather than trusting an answer that merely sounds current."}
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
                ? "Run gửi SQL thực thi ngay qua query service và connection policy. Backend chỉ yêu cầu xác nhận khi phân loại high-impact; không có hộp xác nhận chung cho mọi SQL do AI sinh. Hãy chọn Insert để review trước khi gửi, đặc biệt với lệnh ghi dữ liệu hoặc DDL."
                : "Run submits SQL immediately through the query service and connection policy. The backend requests confirmation only for high-impact classifications; there is no blanket confirmation dialog for all AI-generated SQL. Choose Insert to review before submission, especially for writes or DDL."}
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection title={t ? "Ngữ cảnh, lưu trữ và xóa chat" : "Context, storage, and chat deletion"}>
        <Prose>
          {t
            ? "Mỗi request dùng tối đa 20 message lịch sử/24.000 ký tự và 24 bảng/32.000 ký tự schema. Text từ mỗi PDF/tệp text được cắt ở 50.000 ký tự trước ghi chú. Body JSON server giới hạn 10 MiB (10.485.760 byte); base64 làm tệp lớn hơn nên ảnh và PDF gần 5 MiB mỗi tệp vẫn có thể vượt body khi gửi chung. Đây là giới hạn request, không phải thời hạn lưu dữ liệu."
            : "Each request uses up to 20 history messages/24,000 characters and 24 tables/32,000 schema characters. Text from each PDF/text file is clipped at 50,000 characters before annotations. The server JSON body limit is 10 MiB (10,485,760 bytes); base64 increases size, so an image and PDF near 5 MiB each can exceed the combined body. These are request limits, not retention periods."}
        </Prose>
        <Callout type="warning">
          <p className="text-sm">
            {t
              ? "Chat AI, message và dữ liệu attachment được lưu trong metastore phía server; không có TTL tự động cho chat. Cắt lịch sử gửi model không xóa bản lưu. Delete chat của người dùng xóa chat và các message liên quan theo cascade, không chứng minh provider bên ngoài đã xóa dữ liệu hoặc backup đã biến mất. Chỉ gửi dữ liệu được phép chia sẻ."
              : "AI chats, messages, and attachment data are persisted in the server metastore; chats have no automatic TTL. Truncating history sent to a model does not delete stored history. The user’s Delete chat action cascades to its messages; it does not prove deletion at external providers or from backups. Send only data you are authorized to share."}
          </p>
        </Callout>
        <Prose>
          <a href={publicPath(lang, "/docs/data-handling")}>
            {t ? "Đọc cách xử lý dữ liệu, lưu trữ và xóa" : "Read about data handling, retention, and deletion"}
          </a>
          {" · "}
          <a href={publicPath(lang, "/docs/operational-limits")}>
            {t ? "Xem giới hạn vận hành" : "See operational limits"}
          </a>
        </Prose>
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
