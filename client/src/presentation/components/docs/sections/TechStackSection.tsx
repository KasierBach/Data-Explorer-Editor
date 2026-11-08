import { DocPageLayout, DocSection, Callout } from "../primitives";
import { getAssistantModelCatalog } from "@/presentation/modules/Query/assistantModelCatalog";
import { publicPath } from "@/core/seo/publicRoutes";

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
      <Callout type="info">
        <p className="text-muted-foreground">
          {t
            ? "Các phiên bản dưới đây phản ánh manifest và lockfile hiện tại, không phải cam kết luôn dùng bản mới nhất. Node.js 22 được dùng trong Docker và CI; phạm vi capability theo engine nằm ở "
            : "These versions reflect the current manifests and lockfiles, not a promise to always use the latest release. Docker and CI use Node.js 22; engine capability differences are documented in "}
          <a className="text-primary hover:underline" href={publicPath(lang, '/docs/database-capabilities')}>{t ? "ma trận database" : "the database matrix"}</a>.
        </p>
      </Callout>
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
                  ver: "8.18 / 3.24 / 12.2",
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
                    ? "Build image và Compose baseline local; production vẫn cần cấu hình secret, mạng, TLS và migration."
                    : "Image builds and a local Compose baseline; production still needs secrets, networking, TLS, and migrations configured.",
                },
                {
                  tech: "Nginx",
                  provider: "In Docker stack",
                  role: t
                    ? "Phục vụ frontend static và SPA fallback trong image client; cấu hình này không proxy /api tới backend."
                    : "Serves frontend static files and SPA fallback in the client image; this configuration does not proxy /api to the backend.",
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
              {getAssistantModelCatalog().map((group) => (
                <tr key={group.group} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-bold">{group.group}</td>
                  <td className="p-4 font-mono text-primary font-bold text-xs">
                    {group.items.slice(0, 3).map((model) => model.label).join(" / ")}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {t
                      ? "Ví dụ từ catalog UI hiện tại; khả dụng và capability còn phụ thuộc cấu hình/provider."
                      : "Examples from the current UI catalog; availability and capabilities also depend on provider configuration."}
                  </td>
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
                  ver: "29.4.6 (lockfile; manifest ^29.2.5)",
                  role: t
                    ? "TypeScript transform cho backend test suite."
                    : "TypeScript transform for the backend test suite.",
                },
                {
                  tech: "fast-check",
                  ver: t ? "3.23.2 (phụ thuộc gián tiếp)" : "3.23.2 (transitive)",
                  role: t
                    ? "Được một số adversarial/property-based tests import nhưng hiện chỉ có trong lockfile backend như phụ thuộc gián tiếp, không được khai báo trực tiếp trong manifest."
                    : "Imported by some adversarial/property-based tests, but currently present only as a transitive backend lockfile dependency, not a direct manifest declaration.",
                },
                {
                  tech: t ? "Pentest suites (Jest)" : "Pentest suites (Jest)",
                  ver: "—",
                  role: t
                    ? "Bộ đối kháng mô phỏng tấn công thực tế: identifier smuggling, CSRF header spoofing, IPv4-mapped IPv6, unterminated literals."
                    : "Adversarial suites simulating real attacks: identifier smuggling, CSRF header spoofing, IPv4-mapped IPv6, and unterminated literals.",
                },
                {
                  tech: "Playwright",
                  ver: "1.61.x",
                  role: t
                    ? "Browser E2E trong e2e và full-stack; cấu hình có Chromium, Firefox và mobile WebKit/Chrome tùy suite."
                    : "Browser E2E under e2e and full-stack; the configurations include Chromium, Firefox, and mobile WebKit/Chrome depending on the suite.",
                },
                {
                  tech: "Trivy + SBOM",
                  ver: "CI",
                  role: t
                    ? "Scan lỗ hổng image, sinh SBOM và pin base image trong pipeline containers."
                    : "Image vulnerability scanning, SBOM generation, and pinned base images in the containers pipeline.",
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
