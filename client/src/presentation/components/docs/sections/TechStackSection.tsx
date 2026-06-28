import { DocPageLayout, DocSection, Callout } from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function TechStackSection({ lang }: Props) {
  const t = lang === "vi";

  return (
    <DocPageLayout
      title={t ? "Công nghệ sử dụng" : "Technology stack"}
      subtitle={
        t
          ? "Tổng quan các framework, runtime, driver, và lane AI đang được dùng thật trong Data Explorer."
          : "Overview of the frameworks, runtimes, drivers, and AI lanes actually used in Data Explorer today."
      }
    >
      <DocSection title={t ? "Frontend" : "Frontend"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-500/10">
                <th className="text-left p-4 font-bold">
                  {t ? "Công nghệ" : "Technology"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Phiên bản" : "Version"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Vai trò" : "Purpose"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  tech: "React",
                  ver: "19.2.x",
                  role: t
                    ? "Nền tảng giao diện chính cho toàn bộ ứng dụng client."
                    : "Primary UI foundation for the entire client application.",
                },
                {
                  tech: "Vite",
                  ver: "7.3.x",
                  role: t
                    ? "Dev server và build pipeline tốc độ cao."
                    : "Fast dev server and build pipeline.",
                },
                {
                  tech: "TypeScript",
                  ver: "5.9.x",
                  role: t
                    ? "Type safety cho client app; backend hiện dùng TypeScript riêng trong server package."
                    : "Type safety for the client app; the backend currently uses its own TypeScript toolchain in the server package.",
                },
                {
                  tech: "Tailwind CSS",
                  ver: "4.1.x",
                  role: t
                    ? "Styling utility-first cho toàn bộ surface UI."
                    : "Utility-first styling across the whole UI surface.",
                },
                {
                  tech: "Framer Motion",
                  ver: "12.38.x",
                  role: t
                    ? "Animation layer cho chuyển cảnh, drawer, AI bubbles, và motion UI."
                    : "Animation layer for transitions, drawers, AI bubbles, and motion-heavy UI.",
                },
                {
                  tech: "Zustand",
                  ver: "5.0.x",
                  role: t
                    ? "State management dạng slice cho tabs, AI chat, connections và UI shell."
                    : "Slice-based state management for tabs, AI chat, connections, and the shell.",
                },
                {
                  tech: "@monaco-editor/react",
                  ver: "4.7.x",
                  role: t
                    ? "Wrapper Monaco cho SQL editor, MQL editor, shortcut, formatting và completions."
                    : "The Monaco wrapper used for the SQL editor, MQL editor, shortcuts, formatting, and completions.",
                },
                {
                  tech: "@tanstack/react-query",
                  ver: "5.90.x",
                  role: t
                    ? "Server state, caching, và request synchronization."
                    : "Server state, caching, and request synchronization.",
                },
                {
                  tech: "@xyflow/react",
                  ver: "12.10.x",
                  role: t
                    ? "Canvas engine cho ERD/visual diagram flow."
                    : "Canvas engine for ERD and visual diagram flows.",
                },
                {
                  tech: "lucide-react",
                  ver: "0.563.x",
                  role: t
                    ? "Bộ icon vector hiện đại và linh hoạt."
                    : "Modern and flexible vector icon set.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold text-primary">{row.tech}</td>
                  <td className="p-4 font-mono text-xs">{row.ver}</td>
                  <td className="p-4 text-muted-foreground">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection title={t ? "Backend" : "Backend"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-500/10">
                <th className="text-left p-4 font-bold">
                  {t ? "Công nghệ" : "Technology"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Phiên bản" : "Version"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Vai trò" : "Purpose"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  tech: "NestJS",
                  ver: "11.x",
                  role: t
                    ? "Framework backend chính với module boundaries và DI."
                    : "Primary backend framework with module boundaries and DI.",
                },
                {
                  tech: "Prisma",
                  ver: "6.19.x",
                  role: t
                    ? "ORM cho metadata app: users, connections, saved queries, dashboards, billing metadata, và team entities."
                    : "ORM for app metadata: users, connections, saved queries, dashboards, billing metadata, and team entities.",
                },
                {
                  tech: "BullMQ",
                  ver: "5.74.x",
                  role: t
                    ? "Quản lý hàng đợi tác vụ nền, hiện thấy rõ nhất ở migration và các workflow async."
                    : "Background job queue management, currently most visible in migration and async workflows.",
                },
                {
                  tech: "ioredis",
                  ver: "5.10.x",
                  role: t
                    ? "Kết nối Redis cho presence, notifications, cache, search index và internal coordination."
                    : "Redis connectivity for presence, notifications, cache, search indexing, and internal coordination.",
                },
                {
                  tech: "Passport + JWT",
                  ver: "11.x / 4.x",
                  role: t
                    ? "Email login, Google/GitHub OAuth, JWT session flow."
                    : "Email login, Google/GitHub OAuth, and JWT session flow.",
                },
                {
                  tech: "pg / mysql2 / mssql",
                  ver: "8.18 / 3.16 / 12.2",
                  role: t
                    ? "Native database drivers cho SQL execution linh hoạt."
                    : "Native database drivers for flexible SQL execution.",
                },
                {
                  tech: "mongodb",
                  ver: "7.1.x",
                  role: t
                    ? "MongoDB driver cho NoSQL workspace và document-oriented execution."
                    : "MongoDB driver for the NoSQL workspace and document-oriented execution.",
                },
                {
                  tech: "RxJS",
                  ver: "7.8.x",
                  role: t
                    ? "Xử lý luồng dữ liệu không đồng bộ, đặc biệt là AI SSE."
                    : "Async stream processing, especially for AI SSE.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold text-primary">{row.tech}</td>
                  <td className="p-4 font-mono text-xs">{row.ver}</td>
                  <td className="p-4 text-muted-foreground">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection title={t ? "Hạ tầng & Middleware" : "Infra & Middleware"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cyan-500/10">
                <th className="text-left p-4 font-bold">
                  {t ? "Dịch vụ" : "Service"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Cung cấp" : "Provider"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Vai trò" : "Purpose"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  tech: "Redis",
                  provider: "Local / Upstash / AWS",
                  role: t
                    ? "Caching, BullMQ backend, và Rate limiting."
                    : "Caching, BullMQ backend, and Rate limiting.",
                },
                {
                  tech: "PostgreSQL",
                  provider: "Local / Neon / Supabase",
                  role: t
                    ? "Metastore lưu trữ toàn bộ dữ liệu nội bộ của app."
                    : "Metastore storing all internal app data.",
                },
                {
                  tech: "Docker",
                  provider: "Containerization",
                  role: t
                    ? "Đóng gói toàn bộ ecosystem để triển khai một chạm."
                    : "Packaging the entire ecosystem for one-click deployment.",
                },
                {
                  tech: "Nginx",
                  provider: "In Docker stack",
                  role: t
                    ? "Reverse proxy và phục vụ frontend static files."
                    : "Reverse proxy and serving frontend static files.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold text-primary">{row.tech}</td>
                  <td className="p-4 text-xs font-medium">{row.provider}</td>
                  <td className="p-4 text-muted-foreground">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection title={t ? "AI stack & routing" : "AI stack & routing"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-500/10">
                <th className="text-left p-4 font-bold">
                  {t ? "Lane / Provider" : "Lane / Provider"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Ví dụ model" : "Example model"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Vai trò" : "Purpose"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  service: "Gemini default high-quality lane",
                  model:
                    "gemini-3.5-flash / gemini-3.1-pro-preview / gemini-2.5-flash",
                  role: t
                    ? "Lane mặc định mạnh nhất cho reasoning, attachment-aware work, và các request cần độ ổn định cao."
                    : "The strongest default lane for reasoning, attachment-aware work, and requests that need higher reliability.",
                },
                {
                  service: "OpenRouter default auto lane",
                  model: "Env default hoặc model explicit từ catalog",
                  role: t
                    ? "Lane linh hoạt cho auto chain mặc định, một phần vision flow, và web-backed search tùy model."
                    : "The flexible lane behind the default auto chain, part of the vision flow, and some web-backed search paths depending on the model.",
                },
                {
                  service: "Groq fast lane",
                  model: "Llama 4 Scout / Llama 3.3 70B / Mixtral",
                  role: t
                    ? "Lane độ trễ thấp cho chat nhanh và iteration ngắn."
                    : "The low-latency lane for rapid chat and short iteration loops.",
                },
                {
                  service: "Cerebras low-cost lane",
                  model: "Env-configured text model",
                  role: t
                    ? "Lane chi phí thấp hơn cho prompt nhẹ, không phải đường chính cho vision hoặc live search."
                    : "A lower-cost lane for lighter prompts, not the main path for vision or live search.",
                },
                {
                  service: "Beeknoee explicit lane",
                  model: "GLM 4.7 Flash / Qwen 3 235B / MiniMax M2.7",
                  role: t
                    ? "Provider explicit từ model catalog khi bạn muốn khóa model cụ thể thay vì chỉ dựa vào fallback mặc định."
                    : "An explicit provider from the model catalog when you want to lock to a concrete model instead of relying on default fallback.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold">{row.service}</td>
                  <td className="p-4 font-mono text-primary font-bold text-xs">
                    {row.model}
                  </td>
                  <td className="p-4 text-muted-foreground">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="info">
          <p className="text-muted-foreground">
            {t
              ? "AI panel hiện hỗ trợ các routing mode như Auto, Fast / Cheap, Best Quality và Gemini Only. UI cũng hiển thị provider/model thực tế đã trả lời để tránh nhầm lẫn khi routing đang hoạt động. Trong wiring hiện tại, Beeknoee là explicit lane và không tự chui vào auto chain mặc định."
              : "The AI panel now supports routing modes such as Auto, Fast / Cheap, Best Quality, and Gemini Only. The UI also shows the actual provider/model that answered so routing decisions stay transparent. In the current wiring, Beeknoee is an explicit lane and does not insert itself into the default auto chain."}
          </p>
        </Callout>
      </DocSection>

      <DocSection title={t ? "Testing & quality" : "Testing & quality"}>
        <div className="border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-500/10">
                <th className="text-left p-4 font-bold">
                  {t ? "Công cụ" : "Tool"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Phiên bản" : "Version"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Vai trò" : "Purpose"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                {
                  tech: "Vitest",
                  ver: "4.1.x",
                  role: t
                    ? "Frontend unit tests và component tests."
                    : "Frontend unit tests and component tests.",
                },
                {
                  tech: "React Testing Library",
                  ver: "16.3.x",
                  role: t
                    ? "UI testing theo hành vi người dùng."
                    : "User-behavior-oriented UI testing.",
                },
                {
                  tech: "Jest",
                  ver: "30.x",
                  role: t
                    ? "Backend test runner cho NestJS services/controllers."
                    : "Backend test runner for NestJS services and controllers.",
                },
                {
                  tech: "ts-jest",
                  ver: "29.2.x",
                  role: t
                    ? "TypeScript transform cho backend test suite."
                    : "TypeScript transform for the backend test suite.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4 font-bold text-primary">{row.tech}</td>
                  <td className="p-4 font-mono text-xs">{row.ver}</td>
                  <td className="p-4 text-muted-foreground">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>
    </DocPageLayout>
  );
}
