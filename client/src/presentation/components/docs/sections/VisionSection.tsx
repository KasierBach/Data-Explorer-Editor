import { Eye, Image, Sparkles } from "lucide-react";
import {
  Callout,
  DocPageLayout,
  DocSection,
  FeatureGrid,
  InfoCard,
} from "../primitives";
import { publicPath } from "@/core/seo/publicRoutes";

interface Props {
  lang: "vi" | "en";
}

export function VisionSection({ lang }: Props) {
  const t = lang === "vi";

  return (
    <DocPageLayout
      title={t ? "AI Vision & Ảnh đính kèm" : "AI Vision & Attachments"}
      subtitle={
        t
          ? "Dùng ảnh như một phần của context AI: ERD, whiteboard, app screenshot, hoặc sơ đồ viết tay có thể được phân tích để sinh SQL, MQL, giải thích cấu trúc, hoặc định hướng bước tiếp theo."
          : "Use images as part of the AI context: ERDs, whiteboards, app screenshots, and hand-drawn diagrams can be analyzed to generate SQL, MQL, structure explanations, or the next step."
      }
      gradient
    >
      <FeatureGrid columns={3}>
        <InfoCard
          icon={<Image className="w-6 h-6 text-blue-500" />}
          title={t ? "Ảnh là context thật" : "Images are real context"}
          color="blue"
        >
          <p>
            {t
              ? "Ảnh đính kèm không chỉ để “xem cho vui”. Chúng được đưa vào request theo đường vision-capable để AI đọc sơ đồ, text trong ảnh, hoặc cấu trúc giao diện liên quan."
              : "Attachments are not decorative. They travel through a vision-capable request path so AI can read diagrams, in-image text, or UI structure that matters to the task."}
          </p>
        </InfoCard>
        <InfoCard
          icon={<Eye className="w-6 h-6 text-emerald-500" />}
          title={
            t
              ? "Đầu ra không chỉ là mô tả ảnh"
              : "The output is not just image description"
          }
          color="emerald"
        >
          <p>
            {t
              ? "Kết quả có thể là SQL, MQL, schema explanation, hay một bản đọc nhanh giúp bạn biết nên đi tiếp bằng builder, query editor, hay chart flow."
              : "The result can be SQL, MQL, a schema explanation, or a quick read that tells you whether to continue in the builder, the query editor, or a chart flow."}
          </p>
        </InfoCard>
        <InfoCard
          icon={<Sparkles className="w-6 h-6 text-purple-500" />}
          title={
            t
              ? "Provider phải đúng capability"
              : "The provider must match the capability"
          }
          color="purple"
        >
          <p>
            {t
              ? "Không phải mọi attachment đều là ảnh. Ảnh cần capability vision; PDF gửi nguyên tệp cần capability document (nhãn PDF trong catalog). Text trích xuất từ tài liệu đi theo đường text, không tự tạo khả năng đọc ảnh hay PDF gốc."
              : "Not every attachment is an image. Images require vision capability; a PDF sent as a native file requires document capability (the PDF catalog badge). Extracted document text uses the text path and does not imply image or native-PDF support."}
          </p>
        </InfoCard>
      </FeatureGrid>

      <DocSection
        title={
          t
            ? "Workflow vision nên dùng như thế nào?"
            : "What a good vision workflow looks like"
        }
      >
        <div className="space-y-4">
          {[
            {
              step: "1",
              title: t
                ? "Chọn đúng workspace trước"
                : "Start in the right workspace",
              desc: t
                ? "Nếu mục tiêu là SQL, hãy đứng ở SQL workspace. Nếu mục tiêu là MongoDB/MQL, hãy đứng ở NoSQL workspace. Ảnh có thể giống nhau, nhưng output mong muốn của bạn khác nhau."
                : "If the goal is SQL, stay in the SQL workspace. If the goal is MongoDB/MQL, stay in the NoSQL workspace. The same image can lead to different useful output depending on the workspace.",
            },
            {
              step: "2",
              title: t
                ? "Đính kèm ảnh và nói rõ mục tiêu"
                : "Attach the image and state the goal clearly",
              desc: t
                ? "Đừng chỉ nói “xem ảnh này”. Hãy nói rõ bạn muốn tạo schema, giải thích quan hệ, sinh query, hay đọc thông tin cụ thể nào từ ảnh."
                : "Do not stop at “look at this image.” State whether you want schema generation, relationship explanation, query generation, or a specific fact extracted from the image.",
            },
            {
              step: "3",
              title: t
                ? "Review output rồi mới chạy"
                : "Review the output before running anything",
              desc: t
                ? "Ảnh có thể bị mờ, thiếu góc chụp, hoặc ghi chú không chuẩn. Dù AI có đọc tốt, bạn vẫn nên review SQL/MQL trước khi insert hoặc execute."
                : "Images can be blurry, incomplete, or inconsistently labeled. Even when AI reads them well, you should still review the SQL/MQL before insertion or execution.",
            },
            {
              step: "4",
              title: t
                ? "Dùng ảnh như điểm khởi đầu, không phải chân lý tuyệt đối"
                : "Treat the image as a starting point, not absolute truth",
              desc: t
                ? "Một ERD screenshot tốt có thể giúp AI đi rất xa, nhưng những quyết định như data type, index, nullability, hoặc policy production vẫn cần người dùng xác nhận."
                : "A good ERD screenshot can take AI surprisingly far, but decisions like data types, indexing, nullability, and production policy still need human confirmation.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex gap-4 items-start p-5 border rounded-2xl bg-muted/10"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                {item.step}
              </div>
              <div className="space-y-1">
                <span className="font-bold block">{item.title}</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        title={
          t
            ? "Provider nào có đường xử lý ảnh trong app?"
            : "Which providers have an image path in the app?"
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">Gemini</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Gemini được đánh dấu vision và document cho PDF gốc. Model phải có sẵn với API key/quota của deployment; capability không phải cam kết đọc ảnh chính xác hay uptime tuyệt đối."
                : "Gemini is marked for image vision and native-PDF document input. The model must be available with the deployment’s API key/quota; capability is not a guarantee of perfect image reading or uptime."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">OpenRouter</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Có thể đi đường vision nếu model bạn chọn thật sự hỗ trợ ảnh. Vì OpenRouter là multi-model lane, khả năng này phụ thuộc model cụ thể chứ không chỉ phụ thuộc provider."
                : "Can serve as a vision path when the chosen model truly supports images. Because OpenRouter is a multi-model lane, the capability depends on the selected model rather than the provider label alone."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">Groq / Beeknoee / Custom</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Groq chỉ nhận ảnh với Qwen qwen3.6-27b khớp capability. Beeknoee nhận ảnh với model khớp Gemini/Bee Gemini, MiniMax hoặc Claude, không phải GLM. Custom provider cần bật vision và endpoint thực sự hỗ trợ ảnh; flag document dành riêng cho PDF gốc."
                : "Groq accepts images only with its matching Qwen qwen3.6-27b model. Beeknoee image support matches Gemini/Bee Gemini, MiniMax, or Claude models, not GLM. A custom provider needs vision enabled and actual image support at its endpoint; document is a separate flag for native PDFs."}
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection
        title={
          t
            ? "Vision không làm thay phần nào của con người?"
            : "What vision does not replace"
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t
                ? "Không thay review query"
                : "It does not replace query review"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Ngay cả khi AI đọc ảnh đúng, SQL hoặc MQL tạo ra từ ảnh vẫn nên được đọc lại trước khi chèn vào editor hoặc thực thi. Ảnh tốt giúp nhanh hơn, nhưng không biến bước review thành thừa."
                : "Even when the image is read correctly, SQL or MQL generated from that image should still be reviewed before insertion or execution. A good image makes the workflow faster, not review-free."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t
                ? "Không tự biến thành live web search"
                : "It does not become live web search automatically"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "Vision và live web search là capability khác nhau. Web hiện được wiring cho Gemini, OpenRouter và Groq Compound/Compound Mini; Qwen Vision, Beeknoee và custom provider không tự được coi là web lane. Có ảnh không đồng nghĩa có internet."
                : "Vision and live web search are separate capabilities. Web is currently wired for Gemini, OpenRouter, and Groq Compound/Compound Mini; Qwen Vision, Beeknoee, and custom providers are not automatically web lanes. An image does not imply internet access."}
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h3 className="text-sm font-bold">
              {t
                ? "Không biến ảnh thành sự thật tuyệt đối"
                : "It does not turn an image into absolute truth"}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t
                ? "ERD, screenshot, hay bản phác thảo có thể thiếu field, sai quan hệ, hoặc đã cũ so với hệ thống thật. Vision rất hữu ích để khởi động nhanh, nhưng dữ liệu thật và schema thật vẫn là nguồn xác nhận cuối cùng."
                : "An ERD, screenshot, or sketch can omit fields, miss relationships, or drift from the real system. Vision is great for a fast start, but live data and the real schema remain the final source of truth."}
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection
        title={
          t ? "Loại ảnh nào phù hợp nhất?" : "Which image types work best?"
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: t ? "ERD và sơ đồ dữ liệu" : "ERDs and data diagrams",
              desc: t
                ? "Phù hợp để sinh SQL DDL, mô tả quan hệ, xác định entity, và dựng khung schema ban đầu."
                : "Great for SQL DDL generation, relationship explanation, entity discovery, and initial schema scaffolding.",
            },
            {
              title: t
                ? "Whiteboard, ghi chú, phác thảo"
                : "Whiteboards, notes, and sketches",
              desc: t
                ? "Phù hợp để biến ý tưởng còn thô thành danh sách bảng, field, hoặc truy vấn nháp nhanh."
                : "Useful for turning rough ideas into a first draft of tables, fields, or exploratory queries.",
            },
            {
              title: t ? "Screenshot ứng dụng" : "App screenshots",
              desc: t
                ? "Tốt khi bạn muốn AI suy luận cấu trúc dữ liệu ẩn phía sau một form, table UI, report screen, hoặc flow nghiệp vụ."
                : "Helpful when you want AI to infer the data shape behind a form, UI table, report screen, or business flow.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border/60 bg-card/40 p-5"
            >
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title={t ? "Giới hạn attachment và ngữ cảnh" : "Attachment and context limits"}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: t ? "Ảnh và PDF gốc" : "Images and native PDFs",
              desc: t
                ? "UI cho phép nhiều attachment nhưng chỉ ảnh đầu tiên và PDF đầu tiên có dữ liệu gốc đi vào đường native. Ảnh thêm chỉ gửi ghi chú; PDF thêm hoặc PDF trên 5 MiB (5 × 1.024 × 1.024 byte) dùng text trích xuất. Ngưỡng 5 MiB được kiểm tra cho PDF gốc phía client, không phải giới hạn upload ảnh được bảo đảm; ảnh còn chịu giới hạn body JSON chung. Native PDF cần document, không dùng vision thay thế."
                : "The UI allows multiple attachments, but only the first image and first PDF with raw data reach native input. Extra images send only notes; extra PDFs or PDFs above 5 MiB (5 × 1,024 × 1,024 bytes) use extracted text. The client checks that 5 MiB threshold for native PDFs, not as a guaranteed image-upload ceiling; images are subject to the overall JSON body limit. Native PDFs require document, not a substitute vision flag.",
            },
            {
              title: t ? "Text trích xuất và body" : "Extracted text and body size",
              desc: t
                ? "Text trích xuất từ mỗi PDF/tệp text được cắt ở 50.000 ký tự trước khi thêm ghi chú. Body JSON server giới hạn 10 MiB (10.485.760 byte); base64 tăng kích thước nên ảnh và PDF gần 5 MiB mỗi tệp vẫn có thể vượt body khi gửi chung lịch sử/schema."
                : "Extracted text from each PDF/text file is clipped at 50,000 characters before annotations. The server JSON body limit is 10 MiB (10,485,760 bytes); base64 increases size, so an image and PDF near 5 MiB each can exceed the body limit together with history/schema.",
            },
            {
              title: t ? "Lịch sử và schema" : "History and schema",
              desc: t
                ? "Request dùng tối đa 20 message/24.000 ký tự lịch sử và 24 bảng/32.000 ký tự schema. Đây là phần ngữ cảnh gửi model, không phải cam kết AI nhớ toàn bộ cuộc hội thoại hoặc chính sách xóa dữ liệu."
                : "Requests use up to 20 messages/24,000 history characters and 24 tables/32,000 schema characters. This bounds context sent to the model, not a promise to remember the entire chat or a deletion policy.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
              <h3 className="text-sm font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <Callout type="warning">
        <p className="font-bold">
          {t ? "Capability và lưu trữ là hai vấn đề khác nhau" : "Capability and retention are separate concerns"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t
            ? "Cần provider đã cấu hình và model/flag khớp capability; thiếu capability có thể khiến request bị từ chối. Chat và dữ liệu attachment được lưu trong metastore, không có TTL chat tự động. Delete chat cascade tới message của chat; giới hạn ngữ cảnh không xóa bản lưu hoặc dữ liệu ở provider ngoài."
            : "A configured provider and matching model/flag are required; missing capability can cause rejection. Chats and attachment data persist in the metastore with no automatic chat TTL. Delete chat cascades to its messages; context limits do not delete stored data or external-provider copies."}
          {" "}
          <a href={publicPath(lang, "/docs/data-handling")}>
            {t ? "Xem xử lý dữ liệu và lưu trữ." : "See data handling and retention."}
          </a>
        </p>
      </Callout>

      <Callout type="tip">
        <p className="text-sm font-medium">
          {t
            ? "Mẹo thực tế: nếu ảnh có text quan trọng, hãy chụp rõ, cắt gọn vùng cần đọc, và nói rõ output mong muốn. Ví dụ: “Sinh PostgreSQL schema”, “giải thích relation”, “đọc chính xác dòng chữ trong ảnh”, hoặc “biến form này thành collection design”."
            : "Practical tip: if the image contains important text, keep it sharp, crop it to the relevant area, and state the expected output clearly. For example: “Generate a PostgreSQL schema”, “explain the relations”, “read the exact text in the image”, or “turn this form into a collection design”."}
        </p>
      </Callout>
    </DocPageLayout>
  );
}
