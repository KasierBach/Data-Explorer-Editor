import { Box, Database, Globe, Terminal } from "lucide-react";
import { publicPath } from '@/core/seo/publicRoutes';
import {
  Callout,
  CodeBlock,
  CodeComment,
  CodeLine,
  DocPageLayout,
  DocSection,
  Prose,
  StepBlock,
} from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function InstallationSection({ lang }: Props) {
  const t = lang === "vi";

  return (
    <DocPageLayout
      title={t ? "Cài đặt & chạy local" : "Installation & local setup"}
      subtitle={
        t
          ? "Chạy Node.js 22, PostgreSQL và Redis cho metadata app, tạo Prisma Client, áp dụng migration, rồi khởi động NestJS và Vite."
          : "Use Node.js 22, PostgreSQL and Redis for app metadata, generate Prisma Client, apply migrations, then start NestJS and Vite."
      }
    >
      <div className="mb-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border bg-muted/20 p-6">
          <h4 className="mb-2 flex items-center gap-2 font-bold">
            <Terminal className="h-4 w-4 text-primary" />
            {t ? "Dev setup khuyên dùng" : "Recommended dev setup"}
          </h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t
              ? "Chạy backend và frontend trên máy; dùng Docker Compose chỉ cho db và redis để debug dễ hơn."
              : "Run the backend and frontend on your host; use Docker Compose only for db and redis for easier debugging."}
          </p>
        </div>
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <h4 className="mb-2 flex items-center gap-2 font-bold">
            <Box className="h-4 w-4 text-primary" />
            {t ? "Docker cho hạ tầng local" : "Docker for local infrastructure"}
          </h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t
              ? "Nếu không dùng Docker, cung cấp PostgreSQL và Redis tương đương rồi sửa URL. Metadata app tách biệt với database đích bạn muốn khám phá."
              : "Without Docker, provide equivalent PostgreSQL and Redis services and adjust the URLs. App metadata is separate from the target databases you explore."}
          </p>
        </div>
      </div>

      <DocSection title={t ? "Local setup chuẩn" : "Standard local setup"}>
        <StepBlock step={1} title={t ? "Node.js 22 và ba gói npm" : "Node.js 22 and three npm packages"}>
          <Prose>
            {t
              ? "Repo ghim Node.js 22 trong .nvmrc. Chọn phiên bản đó trước khi cài; với nvm trên macOS/Linux dùng nvm install rồi nvm use. Root, server và client có lockfile riêng, nên chạy npm ci ở cả ba nơi."
              : "The repo pins Node.js 22 in .nvmrc. Select that version before installing; with nvm on macOS/Linux use nvm install then nvm use. Root, server and client have separate lockfiles, so run npm ci for all three."}
          </Prose>
          <CodeBlock title="Terminal">
            <CodeLine>git clone https://github.com/KasierBach/Data-Explorer-Editor.git</CodeLine>
            <CodeLine>cd Data-Explorer-Editor</CodeLine>
            <CodeLine>node --version</CodeLine>
            <CodeLine>npm ci</CodeLine>
            <CodeLine>npm ci --prefix server</CodeLine>
            <CodeLine>npm ci --prefix client</CodeLine>
          </CodeBlock>
          <Callout type="tip">
            <p className="text-sm">
              {t
                ? "Windows/PowerShell: với nvm-windows, chọn Node 22 bằng nvm install 22 và nvm use 22. Chạy mỗi dòng riêng; PowerShell 5.1 không hỗ trợ nối lệnh bằng &&. Khi đi tới đường dẫn có dấu cách, dùng Set-Location với đường dẫn trong dấu nháy."
                : "Windows/PowerShell: with nvm-windows, select Node 22 using nvm install 22 and nvm use 22. Run each line separately; PowerShell 5.1 does not support && command chaining. Use Set-Location with a quoted path when it contains spaces."}
            </p>
          </Callout>
        </StepBlock>

        <StepBlock step={2} title={t ? "Khởi động PostgreSQL và Redis" : "Start PostgreSQL and Redis"}>
          <CodeBlock title="Docker Compose">
            <CodeLine>docker compose up -d db redis</CodeLine>
            <CodeLine>docker compose ps db redis</CodeLine>
          </CodeBlock>
          <Prose>
            {t
              ? "Đợi hai service healthy. Compose mặc định mở PostgreSQL trên 127.0.0.1:5435 (trong container là 5432), user postgres, database data_explorer, mật khẩu local change-me-local; Redis ở 127.0.0.1:6379. Nếu đã đổi POSTGRES_PASSWORD hoặc dùng volume cũ, dùng mật khẩu thật của database trong DATABASE_URL."
              : "Wait until both services are healthy. Compose publishes PostgreSQL on 127.0.0.1:5435 (5432 inside the container), with user postgres, database data_explorer and local password change-me-local; Redis is on 127.0.0.1:6379. If you changed POSTGRES_PASSWORD or reuse an older volume, put the database's actual password in DATABASE_URL."}
          </Prose>
        </StepBlock>

        <StepBlock step={3} title={t ? "Tạo server/.env và client/.env" : "Create server/.env and client/.env"}>
          <Prose>
            {t
              ? "Tạo server/.env với các giá trị local bên dưới, rồi thêm ba dòng secret do lệnh sinh ngẫu nhiên tạo ra. Không dùng nguyên placeholder trong .env.example; để trống các key OAuth/AI tùy chọn khi chưa cấu hình."
              : "Create server/.env with the local values below, then add the three secret lines produced by the random-generation command. Do not retain the placeholders from .env.example; leave optional OAuth/AI keys empty until configured."}
          </Prose>
          <CodeBlock title="server/.env">
            <CodeLine>PORT=3001</CodeLine>
            <CodeLine>NODE_ENV=development</CodeLine>
            <CodeLine>DATABASE_URL=postgresql://postgres:change-me-local@localhost:5435/data_explorer</CodeLine>
            <CodeLine>REDIS_URL=redis://localhost:6379</CodeLine>
            <CodeLine>FRONTEND_URL=http://localhost:5173</CodeLine>
            <CodeLine>API_PUBLIC_URL=http://localhost:3001/api</CodeLine>
            <CodeLine>ALLOW_INTERNAL_IPS=false</CodeLine>
            <CodeLine>ALLOW_INSECURE_DATABASE_TLS=false</CodeLine>
          </CodeBlock>
          <div className="h-4" />
          <CodeBlock title={t ? "Sinh secret — chạy trên máy của bạn" : "Generate secrets — run on your own machine"}>
            <CodeComment>{t ? "Chép ba dòng đầu ra vào server/.env, không chia sẻ chúng" : "Copy the three output lines into server/.env; do not share them"}</CodeComment>
            <CodeLine>{`node -e "const { randomBytes } = require('node:crypto'); console.log('JWT_SECRET=' + randomBytes(32).toString('hex')); console.log('REFRESH_TOKEN_SECRET=' + randomBytes(32).toString('hex')); console.log('ENCRYPTION_KEY=' + randomBytes(16).toString('hex'));"`}</CodeLine>
          </CodeBlock>
          <Callout type="warning">
            <p className="text-sm">
              {t
                ? "JWT_SECRET cần ít nhất 32 byte UTF-8; ENCRYPTION_KEY cần đúng 32 byte UTF-8, không phải 32 ký tự Unicode hoặc một chuỗi hex dài 64 ký tự. Lệnh trên sinh JWT/refresh secret dài 64 byte ASCII và encryption key dài 32 byte ASCII. Backend từ chối secret thiếu, sai độ dài và một số giá trị mẫu đã biết; đạt độ dài không thay thế yêu cầu ngẫu nhiên và giữ bí mật."
                : "JWT_SECRET needs at least 32 UTF-8 bytes; ENCRYPTION_KEY needs exactly 32 UTF-8 bytes, not 32 Unicode characters or a 64-character hex string. The command generates 64-byte ASCII JWT/refresh secrets and a 32-byte ASCII encryption key. The backend rejects missing secrets, invalid lengths and known sample values; meeting the length is not a substitute for randomness and secrecy."}
            </p>
          </Callout>
          <CodeBlock title="client/.env">
            <CodeLine>VITE_API_URL=http://localhost:3001/api</CodeLine>
          </CodeBlock>
          <Prose>
            {t
              ? "VITE_API_URL thuộc client/.env, không phải server/.env. Vite đọc giá trị khi khởi động/build; khởi động lại frontend sau khi đổi. Các biến VITE_ là cấu hình công khai trong bundle, tuyệt đối không đặt secret vào đó."
              : "VITE_API_URL belongs in client/.env, not server/.env. Vite reads it at startup/build time; restart the frontend after changing it. VITE_ values are public bundle configuration; never put secrets there."}
          </Prose>
        </StepBlock>

        <StepBlock step={4} title={t ? "Tạo Prisma Client và áp dụng migration" : "Generate Prisma Client and deploy migrations"}>
          <Prose>
            {t
              ? "Từ root repo, chạy các dòng sau sau khi metadata database đã healthy và server/.env đã hoàn chỉnh. migrate deploy áp dụng lịch sử migration đã commit; không dùng db push thay cho bước này."
              : "From the repo root, run these lines after the metadata database is healthy and server/.env is complete. migrate deploy applies the committed migration history; do not substitute db push for this step."}
          </Prose>
          <CodeBlock title="Terminal">
            <CodeLine>cd server</CodeLine>
            <CodeLine>npx prisma generate</CodeLine>
            <CodeLine>npx prisma migrate deploy</CodeLine>
            <CodeLine>cd ..</CodeLine>
          </CodeBlock>
        </StepBlock>

        <StepBlock step={5} title={t ? "Khởi động từ root repo" : "Start from the repo root"}>
          <CodeBlock title="Terminal">
            <CodeLine>npm run dev</CodeLine>
          </CodeBlock>
          <Prose>
            {t
              ? "Script root chạy NestJS và Vite cùng lúc. Mở http://localhost:5173; API ở http://localhost:3001/api. Nếu cần tách hai terminal, từ root dùng npm run server và npm run client."
              : "The root script starts NestJS and Vite together. Open http://localhost:5173; the API is at http://localhost:3001/api. To split them into two terminals, use npm run server and npm run client from the root."}
          </Prose>
        </StepBlock>

        <StepBlock step={6} title={t ? "Tùy chọn: cấu hình AI trong UI" : "Optional: configure AI in the UI"}>
          <Prose>
            {t
              ? "Sau khi đăng nhập, mở Hồ sơ > Cấu hình AI để chọn model cho Assistant, Explain, AI SQL, AI NoSQL và Autocomplete. Provider OpenAI-compatible tùy chỉnh được lưu ở server theo từng người dùng, API key mã hóa trước khi lưu; lựa chọn model theo vai trò được lưu cục bộ trong trình duyệt. AI không bắt buộc để kết nối và chạy query."
              : "After signing in, open Profile > Configure AI to select models for Assistant, Explain, AI SQL, AI NoSQL and Autocomplete. Custom OpenAI-compatible provider records are saved per user on the server, with encrypted API keys; per-role model preferences are stored locally in the browser. AI is not required to connect and run queries."}
          </Prose>
          <Prose>
            <a href={publicPath(lang, '/docs/data-handling')}>{t ? "Đọc phạm vi dữ liệu được gửi tới AI trước khi bật." : "Read what data can be sent to AI before enabling it."}</a>
          </Prose>
        </StepBlock>
      </DocSection>

      <DocSection title={t ? "Chạy toàn bộ bằng Docker" : "Run the full stack with Docker"}>
        <Prose>
          {t
            ? "Sau khi chuẩn bị server/.env với secret thật, lệnh sau build và chạy toàn bộ stack. Service migrate áp dụng migration trước backend. Compose dùng db:5432 và redis:6379 nội bộ, ghi đè FRONTEND_URL thành http://localhost, và build frontend với API local 3001."
            : "After preparing server/.env with real secrets, this command builds and starts the full stack. The migrate service runs before the backend. Compose uses db:5432 and redis:6379 internally, overrides FRONTEND_URL to http://localhost, and builds the frontend with the local API on 3001."}
        </Prose>
        <CodeBlock title="Docker Compose">
          <CodeLine>docker compose up --build -d</CodeLine>
        </CodeBlock>
        <Callout type="info">
          <p className="text-sm">
            {t
              ? "Frontend Docker ở http://localhost (cổng 80), không phải Vite 5173. Không chạy hai backend cùng chiếm cổng 3001. Mật khẩu change-me-local chỉ là mặc định local; thay secret/mật khẩu và origin trước khi triển khai ngoài máy của bạn."
              : "The Docker frontend is at http://localhost (port 80), not Vite 5173. Do not run two backends competing for port 3001. change-me-local is only a local default; change secrets/passwords and origins before deploying beyond your own machine."}
          </p>
        </Callout>
      </DocSection>

      <DocSection title={t ? "Các địa chỉ local quan trọng" : "Important local URLs"}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold"><Globe className="h-4 w-4 text-blue-500" />Frontend</div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">Vite: http://localhost:5173<br />Docker: http://localhost</div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-emerald-500" />API</div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">http://localhost:3001/api</div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold"><Database className="h-4 w-4 text-amber-500" />{t ? "Sẵn sàng" : "Readiness"}</div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">http://localhost:3001/api/health/ready</div>
          </div>
        </div>
      </DocSection>

      <Callout type="warning">
        <p className="text-sm">
          {t
            ? "Nếu backend không khởi động, kiểm tra Node 22, secret theo byte UTF-8, DATABASE_URL đúng mật khẩu/cổng 5435, Redis và migration trước. Localhost trong URL target database là máy chạy backend, không phải máy của người dùng web."
            : "If the backend does not start, check Node 22, UTF-8 secret lengths, the DATABASE_URL password/port 5435, Redis and migrations first. Localhost in a target database URL means the backend host, not the web user's machine."}
        </p>
      </Callout>
      <Prose>
        <a href={publicPath(lang, '/docs/env-vars')}>{t ? "Tham chiếu biến môi trường" : "Environment variable reference"}</a>{' · '}
        <a href={publicPath(lang, '/docs/first-query')}>{t ? "Truy vấn đầu tiên" : "First query"}</a>
      </Prose>
    </DocPageLayout>
  );
}
