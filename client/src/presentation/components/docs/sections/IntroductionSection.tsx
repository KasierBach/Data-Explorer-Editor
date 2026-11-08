import { Zap, Database, BookOpen, ArrowDown, ArrowUpRight } from "lucide-react";
import { Badge } from "@/presentation/components/ui/badge";
import { KnowledgeHub } from '@/presentation/public/KnowledgeHub';
import { KnowledgePaths } from '@/presentation/public/KnowledgePaths';
import { publicPath } from '@/core/seo/publicRoutes';
import {
  DocPageLayout,
  DocSection,
  Prose,
  InfoCard,
  FeatureGrid,
  Callout,
  CodeBlock,
  CodeComment,
  CodeLine,
} from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function IntroductionSection({ lang }: Props) {
  const t = lang === "vi";
  return (
    <DocPageLayout
      title={t ? "Chào mừng tới Data Explorer" : "Welcome to Data Explorer"}
      subtitle={
        t
          ? 'Nền tảng quản trị cơ sở dữ liệu hiện đại, được thiết kế theo triết lý "AI-First" cho các Data Engineer và AI Developers.'
          : 'A modern database management platform, designed with an "AI-First" philosophy for Data Engineers and AI Developers.'
      }
      gradient
      visual={<KnowledgeHub />}
      actions={<div className="pe-doc-hero-actions"><a className="pe-button pe-button-primary" href={publicPath(lang, '/docs/installation')}>{t ? 'Bắt đầu khám phá' : 'Start exploring'}<ArrowUpRight size={15} aria-hidden="true" /></a><a className="pe-button" href="#knowledge-paths">{t ? 'Chọn lối đi của bạn' : 'Find your path'}<ArrowDown size={15} aria-hidden="true" /></a></div>}
    >
      <div id="knowledge-paths"><KnowledgePaths /></div>
      <Prose className="mb-12">
        {t
          ? "Data Explorer kết hợp trình soạn thảo SQL, workspace MongoDB và công cụ khám phá dữ liệu trong trình duyệt. AI là lớp hỗ trợ tùy chọn để soạn query, giải thích và gợi ý; bạn vẫn có thể kết nối và truy vấn mà không bật AI."
          : "Data Explorer combines a SQL editor, a MongoDB workspace and browser-based data exploration tools. AI is an optional layer for drafting queries, explanations and suggestions; you can connect and query without enabling AI."}
      </Prose>
      <Callout type="info">
        <p className="text-sm">
          {t
            ? "Có trong phiên bản hiện tại: adapter CockroachDB và MariaDB, connection guardrails, hủy query, AI theo vai trò và provider OpenAI-compatible tùy chỉnh. Đây là mô tả khả năng hiện có, không phải tuyên bố mọi tính năng đều được ra mắt ở v1.6.7 hoặc chứng nhận production cho mọi engine."
            : "Available in the current version: CockroachDB and MariaDB adapters, connection guardrails, query cancellation, per-role AI and custom OpenAI-compatible providers. This describes current capabilities, not a claim that every feature was introduced in v1.6.7 or production certification for every engine."}
        </p>
      </Callout>
      {/* Overview Cards */}
      <FeatureGrid>
        <InfoCard
          icon={<Database className="w-6 h-6 text-blue-500" />}
          title={t ? "Hỗ trợ Đa Engine" : "Multi-Engine Support"}
          color="blue"
        >
          <p>
            {t
              ? "Adapter được đăng ký cho PostgreSQL, MySQL, MariaDB, CockroachDB, SQL Server, MongoDB/Atlas, Redis, SQLite và ClickHouse. Một số engine chia sẻ driver/giao thức; đăng ký adapter không đồng nghĩa tính năng ngang nhau. Redis và SQLite còn khoảng trống trong workspace người dùng."
              : "Registered adapters cover PostgreSQL, MySQL, MariaDB, CockroachDB, SQL Server, MongoDB/Atlas, Redis, SQLite and ClickHouse. Some engines share drivers/protocols; adapter registration does not imply feature parity. Redis and SQLite still have user-workspace gaps."}
          </p>
        </InfoCard>
        <InfoCard
          icon={<BookOpen className="w-6 h-6 text-purple-500" />}
          title={t ? "AI Assistant đa lane" : "Multi-lane AI Assistant"}
          color="purple"
        >
          <p>
            {t
              ? "Kết hợp AI routing, Gemini, OpenRouter, Groq, Cerebras, và lane explicit của Beeknoee để hỗ trợ general chat, SQL generation, schema analysis, typed recommendations, attachment context, và vision flows."
              : "Combines AI routing, Gemini, OpenRouter, Groq, Cerebras, and the Beeknoee explicit lane to support general chat, SQL generation, schema analysis, typed recommendations, attachment context, and vision flows."}
          </p>
        </InfoCard>
      </FeatureGrid>

      {/* Why Data Explorer */}
      <DocSection
        title={t ? "Tại sao chọn Data Explorer?" : "Why Data Explorer?"}
      >
        <Prose>
          {t
            ? 'Hầu hết các công cụ quản trị database hiện nay đều quá đơn sơ hoặc bị sa lầy trong các thiết kế cũ kỹ từ những thập kỷ trước. Data Explorer tập trung vào ba trụ cột cốt lõi: Mật độ thông tin, Tốc độ thực thi, và Trí tuệ nhân tạo. Chúng tôi mang đến trải nghiệm "Monaco-first" — biến việc quản trị dữ liệu trở nên thoải mái như đang lập trình trên VS Code.'
            : 'Most database management tools today are either too simplistic or bogged down in legacy designs from decades ago. Data Explorer focuses on three core pillars: Information Density, Execution Speed, and Artificial Intelligence. We bring a "Monaco-first" experience — making data management as comfortable as coding in VS Code.'}
        </Prose>
        <Prose>
          {t
            ? "Khác với các GUI database truyền thống như pgAdmin hay DBeaver, Data Explorer được xây dựng hoàn toàn trên nền web hiện đại (React + Vite) với kiến trúc Hexagonal (Clean Architecture). Điều này cho phép bạn truy cập từ bất kỳ trình duyệt nào, trên bất kỳ thiết bị nào, mà vẫn giữ được hiệu năng ngang ngửa ứng dụng desktop."
            : "Unlike traditional database GUIs like pgAdmin or DBeaver, Data Explorer is built entirely on modern web technologies (React + Vite) with Hexagonal (Clean) Architecture. This allows access from any browser, on any device, while maintaining desktop-class performance."}
        </Prose>
        <Callout type="info">
          <p className="italic text-lg text-foreground">
            {t
              ? '"Sứ mệnh của chúng tôi là biến việc khám phá dữ liệu trở nên trực quan và liền mạch như cách bạn viết mã nguồn hàng ngày."'
              : '"Our mission is to make data exploration as intuitive and seamless as the way you write source code every day."'}
          </p>
        </Callout>
      </DocSection>

      {/* Quick Start Example */}
      <DocSection
        title={t ? "Bắt đầu với local setup" : "Start with local setup"}
      >
        <Prose>
          {t
            ? "Dùng Node.js 22 theo .nvmrc. Chuẩn bị server/.env và client/.env theo trang Cài đặt trước khi generate/migrate hoặc chạy app; không chép nguyên placeholder secret trong template. Các dòng dưới là lộ trình, không phải cam kết hoàn thành trong 60 giây."
            : "Use Node.js 22 from .nvmrc. Prepare server/.env and client/.env from the Installation page before generating/migrating or starting the app; do not copy template secret placeholders unchanged. These lines describe the sequence, not a 60-second completion promise."}
        </Prose>
        <CodeBlock title={t ? "Khởi động local" : "Local startup"}>
          <CodeComment>{t ? "Sau khi clone và chọn Node 22, chạy từ root repo" : "After cloning and selecting Node 22, run from the repo root"}</CodeComment>
          <CodeLine>npm ci</CodeLine>
          <CodeLine>npm ci --prefix server</CodeLine>
          <CodeLine>npm ci --prefix client</CodeLine>
          <CodeLine>docker compose up -d db redis</CodeLine>
          <p className="mt-3" />
          <CodeComment>{t ? "Đợi db/redis healthy và tạo env theo trang Cài đặt" : "Wait for healthy db/redis and create env files from Installation"}</CodeComment>
          <CodeLine>cd server</CodeLine>
          <CodeLine>npx prisma generate</CodeLine>
          <CodeLine>npx prisma migrate deploy</CodeLine>
          <CodeLine>cd ..</CodeLine>
          <CodeLine>npm run dev</CodeLine>
          <CodeComment>{t ? "Vite: http://localhost:5173; API: http://localhost:3001/api" : "Vite: http://localhost:5173; API: http://localhost:3001/api"}</CodeComment>
        </CodeBlock>
        <Prose>
          {t
            ? "Compose metadata PostgreSQL dùng host port 5435 và mật khẩu local mặc định change-me-local; Redis dùng 6379. Đặt PORT=3001 ở server/.env và VITE_API_URL=http://localhost:3001/api ở client/.env. Full Docker frontend ở http://localhost (80), khác Vite 5173. Với PowerShell, chạy từng dòng riêng."
            : "Compose metadata PostgreSQL uses host port 5435 and local default password change-me-local; Redis uses 6379. Set PORT=3001 in server/.env and VITE_API_URL=http://localhost:3001/api in client/.env. The full Docker frontend is at http://localhost (80), unlike Vite 5173. In PowerShell, run each line separately."}
        </Prose>
        <Prose>
          <a href={publicPath(lang, '/docs/installation')}>{t ? "Cài đặt và sinh secret an toàn" : "Installation and safe secret generation"}</a>{' · '}
          <a href={publicPath(lang, '/docs/first-query')}>{t ? "Truy vấn đầu tiên" : "First query"}</a>
        </Prose>
      </DocSection>

      {/* Core Values */}
      <DocSection title={t ? "Giá trị cốt lõi" : "Core Values"}>
        <Prose>
          {t
            ? "Data Explorer được xây dựng dựa trên bốn giá trị cốt lõi. Mỗi tính năng, mỗi dòng code đều phản ánh cam kết của chúng tôi với những nguyên tắc này:"
            : "Data Explorer is built on four core values. Every feature, every line of code reflects our commitment to these principles:"}
        </Prose>
        <ul className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: t ? "Hiệu năng cực đỉnh" : "Extreme Performance",
              desc: t
                ? "Tối ưu các đường nóng thực tế: global search dùng candidate index, duyệt bảng dùng server-side window rõ ràng, raw SQL có guardrail 50,000 rows, NoSQL aggregate cap trước khi materialize, và migration dùng batch sizing thích ứng."
                : "Optimizes practical hot paths: global search uses candidate indexes, table browsing uses explicit server-side windows, raw SQL has a 50,000-row guardrail, NoSQL aggregate caps before materialization, and migration uses adaptive batch sizing.",
            },
            {
              title: t ? "Bảo vệ nhiều lớp" : "Layered Protection",
              desc: t
                ? "Kiến trúc nhiều lớp giúp tách dữ liệu kết nối, metadata app, và UI. Mật khẩu connection được mã hóa AES-256-GCM trước khi lưu; backend ép buộc secret mạnh, guardrails cho query, và SSRF validation cho host đích."
                : "A layered architecture keeps connection data, app metadata, and UI concerns separated. Connection passwords are AES-256-GCM encrypted before storage; the backend enforces strong secrets, query guardrails, and SSRF validation for target hosts.",
            },
            {
              title: t ? "Trải nghiệm lập trình viên" : "Developer Experience",
              desc: t
                ? "Monaco với highlight SQL chung, gợi ý từ schema, đa con trỏ và các thao tác editor quen thuộc. Ctrl/Cmd+Enter chạy query; Ctrl/Cmd+K mở tìm kiếm, Ctrl/Cmd+I bật AI và Ctrl/Cmd+J bật kết quả. Không có cam kết linter dialect hoặc SQL worker riêng."
                : "Monaco with generic SQL highlighting, schema completions, multi-cursor editing and familiar editor actions. Ctrl/Cmd+Enter runs queries; Ctrl/Cmd+K opens search, Ctrl/Cmd+I toggles AI and Ctrl/Cmd+J toggles results. No per-dialect linter or custom SQL worker is promised.",
            },
            {
              title: t ? "Trực quan hóa tức thời" : "Instant Visualization",
              desc: t
                ? "ChartStudio có 12 preset biểu đồ; widget snapshot trên dashboard có sáu kiểu biểu đồ. Biểu đồ phản ánh dữ liệu đã tải, không tự quét toàn bộ database. ERD hỗ trợ bố cục tương tác."
                : "ChartStudio has 12 chart presets; dashboard snapshot widgets have six chart types. Charts reflect loaded data, not an automatic scan of the whole database. ERD supports interactive layouts.",
            },
          ].map((item, id) => (
            <li
              key={id}
              className="flex gap-4 p-5 rounded-xl hover:bg-muted/30 transition-colors border"
            >
              <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
              <div>
                <span className="font-bold block text-base">{item.title}</span>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </DocSection>

      {/* Design Philosophy */}
      <DocSection
        title={t ? "Triết lý Thiết kế: AI-First" : "AI-First Design Philosophy"}
      >
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <Prose>
            {t
              ? "AI có thể hỗ trợ soạn query, nhưng người dùng vẫn kiểm soát việc xem lại và thực thi. Các luồng hỗ trợ tập trung vào ba điểm:"
              : "AI can help draft queries, while users retain control over review and execution. Assistance focuses on three areas:"}
            <ul className="mt-6 space-y-4">
              <li>
                <strong>1. Proactive Assistance:</strong>{" "}
                {t
                  ? "Khi Autocomplete được cấu hình, AI có thể gợi ý Ghost Text từ ngữ cảnh editor; gợi ý cần được xem lại."
                  : "When Autocomplete is configured, AI can suggest Ghost Text from editor context; review suggestions before using them."}
              </li>
              <li>
                <strong>2. Schema-Awareness:</strong>{" "}
                {t
                  ? "Luồng AI có thể dùng metadata schema của connection đang chọn; kết quả không thay thế việc xác nhận query trên engine thực tế."
                  : "AI flows can use schema metadata from the selected connection; generated output does not replace verification against the actual engine."}
              </li>
              <li>
                <strong>{t ? "3. Dữ liệu và AI tùy chọn:" : "3. Data and optional AI:"}</strong>{" "}
                {t
                  ? "Prompt, SQL, schema, kết quả hoặc tệp đính kèm được chọn có thể đi qua backend tới provider. Xem chính sách provider và phạm vi dữ liệu trước khi bật; không có bảo đảm tuyệt đối rằng dữ liệu không bao giờ rời hệ thống."
                  : "Prompts, SQL, schema, selected results or attachments can pass through the backend to a provider. Check provider policies and data scope before enabling AI; there is no absolute guarantee that data never leaves the system."}
                {' '}<a href={publicPath(lang, '/docs/data-handling')}>{t ? "Tìm hiểu xử lý dữ liệu" : "Read about data handling"}</a>
              </li>
            </ul>
          </Prose>
          <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all" />
            <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {t ? "Lộ trình phát triển" : "Strategic Roadmap"}
            </h4>
            <div className="space-y-4">
              {[
                {
                  v: t ? "Hiện có" : "Live",
                  t: t
                    ? "Guardrails và query chia sẻ"
                    : "Guardrails and shared queries",
                  d: t ? "Đang có" : "Available",
                },
                {
                  v: t ? "Hiện có" : "Live",
                  t: t
                    ? "ERD lưu/tải và migration dry-run"
                    : "ERD save/load and migration dry-run",
                  d: t ? "Có giới hạn" : "With limits",
                },
                {
                  v: t ? "Dự kiến" : "Planned",
                  t: t
                    ? "Báo cáo theo lịch và dashboard mở rộng"
                    : "Scheduled reports and richer dashboards",
                  d: t ? "Chưa cam kết" : "No commitment",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-[10px]"
                >
                  <span className="font-mono text-muted-foreground">
                    {item.v}
                  </span>
                  <span className="font-bold">{item.t}</span>
                  <span className="text-primary">{item.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DocSection>

      {/* Feature Overview Table */}
      <DocSection title={t ? "Tổng quan tính năng" : "Feature Overview"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-4 font-bold">
                  {t ? "Tính năng" : "Feature"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Mô tả" : "Description"}
                </th>
                <th className="text-center p-4 font-bold">
                  {t ? "Trạng thái" : "Status"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  feature: "Monaco SQL Editor",
                  desc: t
                    ? "Monaco với highlight SQL chung và gợi ý schema"
                    : "Monaco with generic SQL highlighting and schema completions",
                  status: "✅",
                },
                {
                  feature: t ? "Đa kết nối DB" : "Multi-DB Connections",
                  desc: t
                    ? "PostgreSQL, MySQL, MariaDB, CockroachDB, SQL Server, MongoDB/Atlas, Redis, SQLite, ClickHouse; Redis/SQLite còn khoảng trống workspace"
                    : "PostgreSQL, MySQL, MariaDB, CockroachDB, SQL Server, MongoDB/Atlas, Redis, SQLite, ClickHouse; Redis/SQLite workspace gaps remain",
                  status: t ? "Theo engine" : "By engine",
                },
                {
                  feature: t ? "AI SQL Generation" : "AI SQL Generation",
                  desc: t
                    ? "Routing theo provider/model đã cấu hình; cần xem lại query"
                    : "Routing through configured providers/models; review generated queries",
                  status: t ? "Tùy chọn" : "Optional",
                },
                {
                  feature: t ? "Saved Queries chia sẻ" : "Shared Saved Queries",
                  desc: t
                    ? "Private, team, và workspace visibility"
                    : "Private, team, and workspace visibility",
                  status: "✅",
                },
                {
                  feature: t ? "Dashboard từ query" : "Query to Dashboard",
                  desc: t
                    ? "Lưu query result thành dashboard widget"
                    : "Save query results as dashboard widgets",
                  status: "✅",
                },
                {
                  feature: t ? "Hệ thống Phím tắt" : "Global Shortcuts",
                  desc: t
                    ? "Ctrl/Cmd+K tìm kiếm, +I AI, +J kết quả, +N query mới"
                    : "Ctrl/Cmd+K search, +I AI, +J results, +N new query",
                  status: "✅",
                },
                {
                  feature: t ? "Hiệu ứng Mượt mà" : "Smooth UI Transitions",
                  desc: t
                    ? "Đóng mở bảng và tab với chuyển động 300ms"
                    : "300ms smooth panel and tab animations",
                  status: "✅",
                },
                {
                  feature: t ? "Đa ngôn ngữ" : "Internationalization",
                  desc: t
                    ? "Tiếng Việt và Tiếng Anh"
                    : "Vietnamese and English",
                  status: "✅",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-2 font-medium text-xs text-foreground/80">
                    {row.feature}
                  </td>
                  <td className="py-3 px-2 text-xs text-muted-foreground">
                    {row.desc}
                  </td>
                  <td className="py-3 px-2 text-center">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      {/* Mission & Vision */}
      <DocSection title={t ? "Sứ mệnh & Tầm nhìn" : "Mission & Vision"}>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              {t ? "Sứ mệnh" : "Mission"}
            </h4>
            <Prose>
              {t
                ? 'Chúng tôi tin rằng việc tương tác với dữ liệu không nên là một cực hình kỹ thuật. Sứ mệnh của Data Explorer là dân chủ hóa quyền truy cập dữ liệu thông qua AI, giúp các kỹ sư và nhà phân tích tập trung vào "Tại sao" thay vì "Làm thế nào" khi viết SQL.'
                : 'We believe that interacting with data should not be a technical ordeal. Data Explorer\'s mission is to democratize data access through AI, helping engineers and analysts focus on the "Why" rather than the "How" when writing SQL.'}
            </Prose>
          </div>
          <div className="space-y-4">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-500" />
              {t ? "Tầm nhìn" : "Vision"}
            </h4>
            <Prose>
              {t
                ? "Trở thành trung tâm chỉ huy dữ liệu (Data Command Center) mã nguồn mở hàng đầu, nơi AI không chỉ tạo query mà còn hiểu được bối cảnh kinh doanh, dự báo xu hướng và tự động hóa các tác vụ bảo trì database phức tạp."
                : "To become the leading open-source Data Command Center, where AI not only generates queries but also understands business context, predicts trends, and automates complex database maintenance tasks."}
            </Prose>
          </div>
        </div>
      </DocSection>

      {/* Product Roadmap */}
      <DocSection
        title={t ? "Lộ trình Phát triển (Roadmap)" : "Product Roadmap"}
      >
        <div className="space-y-6">
          <Prose>
            {t
              ? "Các khả năng hiện có và hướng phát triển được tách riêng dưới đây. Mục dự kiến không có lịch phát hành cam kết; tính năng hiện tại vẫn có phạm vi và giới hạn theo engine."
              : "Current capabilities and future directions are separated below. Planned items have no committed release schedule; current features still have engine-specific scope and limits."}
          </Prose>

          <div className="grid gap-4">
            {[
              {
                quarter: t ? "Hiện có" : "Live",
                title: t
                  ? "Tìm kiếm toàn cục (Ctrl/Cmd+K)"
                  : "Global Search (Ctrl/Cmd+K)",
                desc: t
                  ? "Tìm đối tượng database và connection qua chỉ mục đã sync; không phải command palette cho mọi loại file và hành động AI."
                  : "Find database objects and connections through the synced index; not a command palette for every file type and AI action.",
              },
              {
                quarter: t ? "Hiện có" : "Live",
                title: t
                  ? "Tài nguyên chia sẻ và migration có dry-run"
                  : "Shared resources and migration dry-runs",
                desc: t
                  ? "Query, dashboard và ERD có luồng chia sẻ/lưu; migration có preview với giới hạn theo cặp engine. Không phải backup hoặc chuyển dữ liệu không giới hạn."
                  : "Queries, dashboards and ERDs have sharing/save flows; migration has previews with engine-pair limits. It is not an unlimited transfer or backup system.",
              },
              {
                quarter: t ? "Dự kiến" : "Planned",
                title: t
                  ? "Báo cáo theo lịch và phân tích hiệu năng sâu hơn"
                  : "Scheduled reporting and deeper performance analysis",
                desc: t
                  ? "Hướng phát triển chưa có ngày phát hành cam kết. Không coi profiler EXPLAIN ANALYZE hoặc gợi ý index tự động theo tần suất là UI đang hoạt động."
                  : "A future direction without a committed release date. Do not treat an EXPLAIN ANALYZE profiler or frequency-based automatic index suggestions as current working UI.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-4 p-4 rounded-xl border bg-muted/20 border-border/50"
              >
                <Badge
                  variant="outline"
                  className="h-fit py-1 px-3 bg-blue-500/5 text-blue-500 border-blue-500/20 font-black text-[10px] shrink-0"
                >
                  {item.quarter}
                </Badge>
                <div className="space-y-1">
                  <h5 className="font-bold text-sm">{item.title}</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Prose>
            <a href={publicPath(lang, '/docs/database-capabilities')}>{t ? "Khả năng database" : "Database capabilities"}</a>{' · '}
            <a href={publicPath(lang, '/docs/operational-limits')}>{t ? "Giới hạn vận hành" : "Operational limits"}</a>{' · '}
            <a href={publicPath(lang, '/docs/data-migration')}>{t ? "Chuyển dữ liệu" : "Data migration"}</a>{' · '}
            <a href={publicPath(lang, '/docs/data-handling')}>{t ? "Xử lý dữ liệu" : "Data handling"}</a>
          </Prose>
        </div>
      </DocSection>
    </DocPageLayout>
  );
}
