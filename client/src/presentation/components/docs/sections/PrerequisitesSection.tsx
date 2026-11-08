import { publicPath } from '@/core/seo/publicRoutes';
import {
  Cpu,
  Database,
  AlertCircle,
  Shield,
  Code,
  Terminal,
} from "lucide-react";
import {
  DocPageLayout,
  DocSection,
  Prose,
  InfoCard,
  FeatureGrid,
} from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function PrerequisitesSection({ lang }: Props) {
  const t = lang === "vi";
  return (
    <DocPageLayout
      title={t ? "Điều kiện tiên quyết" : "Prerequisites & environment setup"}
      subtitle={
        t
          ? "Những thứ cần có trước khi Data Explorer chạy ổn: runtime, app metadata database, quyền mạng, và quyền truy cập tới các target databases."
          : "What you need before Data Explorer runs smoothly: runtime, an app metadata database, network access, and reachability to target databases."
      }
    >
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 border rounded-3xl bg-blue-500/5 border-blue-500/10">
          <Cpu className="w-6 h-6 text-blue-500 mb-4" />
          <h4 className="font-bold text-sm mb-2">Runtime</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t
              ? "Node.js 22 theo .nvmrc của repo. Frontend build bằng Vite 7.x."
              : "Node.js 22 as pinned in the repo's .nvmrc. The frontend builds with Vite 7.x."}
          </p>
        </div>
        <div className="p-6 border rounded-3xl bg-emerald-500/5 border-emerald-500/10">
          <Database className="w-6 h-6 text-emerald-500 mb-4" />
          <h4 className="font-bold text-sm mb-2">Persistence</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t
              ? "Một PostgreSQL riêng cho metadata app và một Redis instance cho cache, queue, notifications, presence, và throttling."
              : "A dedicated PostgreSQL database for app metadata plus a Redis instance for cache, queues, notifications, presence, and throttling."}
          </p>
        </div>
        <div className="p-6 border rounded-3xl bg-violet-500/5 border-violet-500/10">
          <Shield className="w-6 h-6 text-violet-500 mb-4" />
          <h4 className="font-bold text-sm mb-2">Security</h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t
              ? "JWT secret ngẫu nhiên ít nhất 32 byte UTF-8, ENCRYPTION_KEY ngẫu nhiên đúng 32 byte UTF-8, và outbound HTTPS tới AI providers chỉ khi bạn bật AI."
              : "A random JWT secret of at least 32 UTF-8 bytes, a random ENCRYPTION_KEY of exactly 32 UTF-8 bytes, and outbound HTTPS to AI providers only when you enable AI."}
          </p>
        </div>
      </div>

      <DocSection title={t ? "Yêu cầu hệ thống" : "System requirements"}>
        <div className="space-y-6">
          <Prose>
            {t
              ? "Repo production chạy với full-stack TypeScript, npm, PostgreSQL metadata database, migration Prisma đã commit và Redis endpoint ổn định cho cache, background jobs, search index, notifications, cùng rate limiting."
              : "The production stack uses TypeScript, npm, a PostgreSQL metadata database with committed Prisma migrations, and a stable Redis endpoint for cache, background jobs, search indexing, notifications, and rate limiting."}
          </Prose>
          <FeatureGrid>
            <InfoCard
              icon={<Code className="w-5 h-5" />}
              title="Node.js"
              color="orange"
            >
              <p className="text-xs">
                {t
                  ? "Dùng Node.js 22 theo .nvmrc cho dev và build; kiểm tra node --version trước khi chạy npm ci."
                  : "Use Node.js 22 from .nvmrc for development and builds; check node --version before running npm ci."}
              </p>
            </InfoCard>
            <InfoCard
              icon={<Terminal className="w-5 h-5" />}
              title="Package Manager"
              color="blue"
            >
              <p className="text-xs">
                {t
                  ? "Dùng npm ci cho root, server và client vì mỗi gói có lockfile riêng. Không trộn package manager hoặc thay lockfile để cài local."
                  : "Use npm ci for root, server and client because each package has its own lockfile. Do not mix package managers or replace lockfiles for local setup."}
              </p>
            </InfoCard>
            <InfoCard
              icon={<Database className="w-5 h-5" />}
              title="Prisma sync"
              color="emerald"
            >
              <p className="text-xs">
                {t
                  ? "Trong server, chạy npx prisma generate rồi npx prisma migrate deploy trên metadata PostgreSQL đã sẵn sàng. Sau đó về root chạy npm run dev."
                  : "In server, run npx prisma generate then npx prisma migrate deploy against the ready metadata PostgreSQL database. Then return to the root and run npm run dev."}
              </p>
            </InfoCard>
          </FeatureGrid>
        </div>
      </DocSection>

      <DocSection
        title={
          t ? "Engine được đăng ký và fixture kiểm thử" : "Registered engines and test fixtures"
        }
      >
        <Prose>
          {t
            ? "Danh sách dưới đây là đăng ký adapter, không phải chứng nhận tương thích hoặc phiên bản tối thiểu. Fixture CI/E2E hiện dùng PostgreSQL 16-alpine, MySQL 8.4, MongoDB 7 và Redis 7-alpine; đó chỉ là môi trường kiểm thử. MariaDB, CockroachDB, SQL Server, SQLite và ClickHouse không có chứng nhận phiên bản từ các fixture này."
            : "This list describes adapter registrations, not compatibility certification or minimum versions. Current CI/E2E fixtures use PostgreSQL 16-alpine, MySQL 8.4, MongoDB 7 and Redis 7-alpine; these are test environments only. Those fixtures do not certify versions of MariaDB, CockroachDB, SQL Server, SQLite or ClickHouse."}
        </Prose>
        <div className="border rounded-2xl overflow-hidden bg-card/30">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-4 font-bold">
                  {t ? "Engine" : "Engine"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Fixture CI/E2E" : "CI/E2E fixture"}
                </th>
                <th className="text-left p-4 font-bold">
                  {t ? "Ghi chú" : "Notes"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {[
                {
                  engine: "PostgreSQL",
                  ver: "16-alpine",
                  feat: t
                    ? "SQL workspace; Compose metadata local dùng 15-alpine, đây là vai trò riêng."
                    : "SQL workspace; local Compose metadata uses 15-alpine, a separate role.",
                },
                {
                  engine: "MySQL",
                  ver: "8.4",
                  feat: t
                    ? "SQL workspace; bật TLS rõ ràng sau khi dán URI cho server remote."
                    : "SQL workspace; explicitly enable TLS after importing a URI for a remote server.",
                },
                {
                  engine: "MariaDB",
                  ver: t ? "Không có fixture này" : "Not in these fixtures",
                  feat: t
                    ? "Dùng adapter tương thích MySQL; không suy ra mọi tính năng MySQL đều tương đương."
                    : "Uses a MySQL-compatible adapter; do not infer full MySQL feature parity.",
                },
                {
                  engine: "CockroachDB",
                  ver: t ? "Không có fixture này" : "Not in these fixtures",
                  feat: t
                    ? "Adapter qua giao thức PostgreSQL, cổng mặc định 26257; không phải PostgreSQL đầy đủ."
                    : "PostgreSQL-wire adapter, default port 26257; not full PostgreSQL parity.",
                },
                {
                  engine: "SQL Server",
                  ver: t ? "Không có fixture này" : "Not in these fixtures",
                  feat: t
                    ? "SQL workspace với SQL authentication; URI kiểu mssql://, không phải chuỗi dấu chấm phẩy."
                    : "SQL workspace with SQL authentication; mssql:// URLs, not semicolon connection strings.",
                },
                {
                  engine: "MongoDB / Atlas (SRV)",
                  ver: "MongoDB 7",
                  feat: t
                    ? "NoSQL Studio; fixture MongoDB không chứng nhận dịch vụ Atlas."
                    : "NoSQL Studio; the MongoDB fixture does not certify the Atlas service.",
                },
                {
                  engine: "Redis",
                  ver: "7-alpine",
                  feat: t
                    ? "Adapter có đăng ký; chưa có workspace lệnh Redis hoàn chỉnh. Redis hạ tầng app là dịch vụ khác."
                    : "Adapter registered; no complete Redis command workspace. App infrastructure Redis is a separate service.",
                },
                {
                  engine: "SQLite",
                  ver: t ? "Không có fixture này" : "Not in these fixtures",
                  feat: t
                    ? "Adapter có đăng ký và đường dẫn file phía backend; workspace SQL còn khoảng trống, không phải SQLite trên trình duyệt."
                    : "Adapter registered with backend file paths; SQL workspace gaps remain, not browser-local SQLite.",
                },
                {
                  engine: "ClickHouse",
                  ver: t ? "Không có fixture này" : "Not in these fixtures",
                  feat: t
                    ? "Adapter phân tích dữ liệu; không mặc định có transaction hoặc CRUD giống PostgreSQL."
                    : "Analytics adapter; do not assume PostgreSQL-style transactions or CRUD.",
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4 font-bold">{row.engine}</td>
                  <td className="p-4">{row.ver}</td>
                  <td className="p-4 text-muted-foreground">{row.feat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DocSection>

      <DocSection title={t ? "Điều kiện mạng" : "Network prerequisites"}>
        <ul className="space-y-4">
          {[
            {
              label: t ? "AI providers" : "AI providers",
              desc: t
                ? "Backend cần outbound HTTPS (443) tới provider bạn bật: Gemini, OpenRouter, Groq, Cerebras, hoặc Beeknoee. Nếu key thiếu hoặc provider không reach được, lane đó sẽ bị loại khỏi chuỗi chạy thay vì được giả vờ là đang sẵn sàng."
                : "The backend needs outbound HTTPS (443) to whichever providers you enable: Gemini, OpenRouter, Groq, Cerebras, or Beeknoee. If a key is missing or the provider is unreachable, that lane is removed from the execution chain rather than treated as if it were available.",
            },
            {
              label: t ? "Redis / dịch vụ nội bộ" : "Redis / internal services",
              desc: t
                ? "Nếu `REDIS_URL` không hoạt động, các lớp như BullMQ, throttling, presence, notification stream, và một phần caching/search sẽ không ổn định. Đây không chỉ là “optional optimization” nữa trong cấu trúc repo hiện tại."
                : "If `REDIS_URL` is not working, BullMQ, throttling, presence, notification streaming, and part of the caching/search layer become unstable. In the current repo structure this is no longer just an optional optimization.",
            },
            {
              label: t ? "Target databases" : "Target databases",
              desc: t
                ? "Host chạy backend phải reach được các database đích. Nếu mạng trường/công ty chặn 5432, 3306, hoặc 27017, cả local dev lẫn app web đều có thể fail reachability."
                : "The backend host must be able to reach target databases. If a school or company network blocks 5432, 3306, or 27017, both local development and the deployed app can lose reachability.",
            },
            {
              label: t ? "App ports" : "App ports",
              desc: t
                ? "Local host dev cần PORT=3001, client/.env có VITE_API_URL=http://localhost:3001/api và FRONTEND_URL=http://localhost:5173 ở server/.env. Frontend Docker dùng http://localhost (80); metadata PostgreSQL Compose mở cổng 5435, Redis 6379."
                : "Local host development needs PORT=3001, VITE_API_URL=http://localhost:3001/api in client/.env and FRONTEND_URL=http://localhost:5173 in server/.env. The Docker frontend uses http://localhost (80); Compose metadata PostgreSQL is published on 5435 and Redis on 6379.",
            },
          ].map((item, i) => (
            <li
              key={i}
              className="flex gap-4 p-5 border rounded-2xl items-start bg-muted/5"
            >
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold text-sm">{item.label}</h5>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </DocSection>
      <Prose>
        <a href={publicPath(lang, '/docs/installation')}>{t ? "Các bước cài đặt và ghi chú PowerShell" : "Setup steps and PowerShell notes"}</a>{' · '}
        <a href={publicPath(lang, '/docs/database-capabilities')}>{t ? "Khả năng theo engine" : "Capabilities by engine"}</a>{' · '}
        <a href={publicPath(lang, '/docs/sqlite')}>SQLite</a>{' · '}
        <a href={publicPath(lang, '/docs/clickhouse')}>ClickHouse</a>
      </Prose>
    </DocPageLayout>
  );
}
