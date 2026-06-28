import { Box, Database, Globe, Terminal } from "lucide-react";
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
          ? "Thiết lập Data Explorer đúng với repo hiện tại: Prisma sync bằng `db push`, backend NestJS, frontend Vite, và các biến môi trường cần thiết."
          : "Set up Data Explorer the way the current repo actually works: Prisma sync via `db push`, a NestJS backend, a Vite frontend, and the required environment variables."
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
              ? "Phù hợp nhất cho phát triển hằng ngày: chạy app metadata database, backend, và frontend riêng để debug nhanh hơn."
              : "Best for day-to-day development: run the app metadata database, backend, and frontend separately for faster debugging."}
          </p>
        </div>

        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <h4 className="mb-2 flex items-center gap-2 font-bold">
            <Box className="h-4 w-4 text-primary" />
            {t ? "Docker là tùy chọn" : "Docker is optional"}
          </h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t
              ? "Docker hữu ích khi bạn muốn có PostgreSQL local ổn định cho metadata app. Với repo hiện tại, manual setup vẫn là đường đơn giản nhất cho dev."
              : "Docker is useful if you want a stable local PostgreSQL instance for app metadata. For the current repo, manual setup is still the simplest development path."}
          </p>
        </div>
      </div>

      <DocSection title={t ? "Local setup chuẩn" : "Standard local setup"}>
        <StepBlock
          step={1}
          title={
            t
              ? "Clone repo và cài dependency cho root + từng workspace"
              : "Clone the repo and install root + workspace dependencies"
          }
        >
          <CodeBlock title="Terminal">
            <CodeLine>
              git clone https://github.com/KasierBach/Data-Explorer-Editor.git
            </CodeLine>
            <CodeLine>cd Data-Explorer-Editor</CodeLine>
            <CodeLine>npm install</CodeLine>
            <CodeLine>npm install --prefix server</CodeLine>
            <CodeLine>npm install --prefix client</CodeLine>
          </CodeBlock>
        </StepBlock>

        <StepBlock
          step={2}
          title={t ? "Tạo file server/.env" : "Create server/.env"}
        >
          <Prose>
            {t
              ? "Local run cần app metadata database, Redis, JWT secret đủ mạnh, encryption key đúng 32 ký tự, và `FRONTEND_URL`. OAuth và AI provider là tùy chọn."
              : "A local run needs an app metadata database, Redis, a strong JWT secret, an encryption key with exactly 32 characters, and `FRONTEND_URL`. OAuth and AI providers are optional."}
          </Prose>

          <CodeBlock title="server/.env">
            <CodeComment>{t ? "Bắt buộc" : "Required"}</CodeComment>
            <CodeLine>
              DATABASE_URL=postgresql://postgres:postgres@localhost:5432/data_explorer_dev?schema=public
            </CodeLine>
            <CodeLine>
              JWT_SECRET=replace-with-a-strong-secret-at-least-32-chars
            </CodeLine>
            <CodeLine>
              ENCRYPTION_KEY=replace-with-exactly-32-characters
            </CodeLine>
            <CodeLine>FRONTEND_URL=http://localhost:5173</CodeLine>
            <p className="mt-3" />
            <CodeComment>
              {t
                ? "Tùy chọn cho compatibility / local rules"
                : "Optional compatibility / local rules"}
            </CodeComment>
            <CodeLine>LEGACY_ENCRYPTION_KEYS=</CodeLine>
            <CodeLine>ALLOW_INTERNAL_IPS=false</CodeLine>
            <CodeLine>ADMIN_EMAIL=admin@example.com</CodeLine>
            <CodeLine>ADMIN_PASSWORD=your-secure-password</CodeLine>
            <p className="mt-3" />
            <CodeComment>
              {t ? "Tùy chọn cho AI routing" : "Optional for AI routing"}
            </CodeComment>
            <CodeLine>GEMINI_API_KEY=...</CodeLine>
            <CodeLine>AI_PROVIDER_TIMEOUT_MS=15000</CodeLine>
            <CodeLine>AI_STREAM_IDLE_TIMEOUT_MS=15000</CodeLine>
            <CodeLine>CEREBRAS_API_KEY=...</CodeLine>
            <CodeLine>CEREBRAS_BASE_URL=https://api.cerebras.ai/v1</CodeLine>
            <CodeLine>CEREBRAS_CHAT_MODEL=llama3.1-8b</CodeLine>
            <CodeLine>OPENROUTER_API_KEY=...</CodeLine>
            <CodeLine>
              OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
            </CodeLine>
            <CodeLine>OPENROUTER_CHAT_MODEL=</CodeLine>
            <CodeLine>GROQ_API_KEY=...</CodeLine>
            <CodeLine>GROQ_BASE_URL=https://api.groq.com/openai/v1</CodeLine>
            <CodeLine>
              GROQ_CHAT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
            </CodeLine>
            <CodeLine>BEEKNOEE_API_KEY=...</CodeLine>
            <CodeLine>
              BEEKNOEE_BASE_URL=https://platform.beeknoee.com/api/v1
            </CodeLine>
            <CodeLine>BEEKNOEE_CHAT_MODEL=glm-4.7-flash</CodeLine>
          </CodeBlock>

          <Callout type="info">
            <p className="text-sm">
              {t
                ? "Các biến AI trong `server/.env` cấu hình những lane dựng sẵn cho toàn hệ thống như Gemini, OpenRouter, Groq, Cerebras, và Beeknoee. Nếu bạn muốn thêm provider OpenAI-compatible riêng, hãy làm sau khi app chạy bằng `Hồ sơ > Cấu hình AI`; phần đó được lưu cục bộ trên máy người dùng chứ không nằm trong file env."
                : "The AI variables in `server/.env` configure the built-in shared lanes such as Gemini, OpenRouter, Groq, Cerebras, and Beeknoee. If you want to add your own OpenAI-compatible provider, do that after the app boots from `Profile > Configure AI`; that configuration is stored locally on the client machine instead of in the env file."}
            </p>
          </Callout>
        </StepBlock>

        <StepBlock
          step={3}
          title={t ? "Đồng bộ schema app" : "Sync the app schema"}
        >
          <Prose>
            {t
              ? "Repo hiện tại dùng Prisma `db push` cho metadata schema. Đây cũng là lệnh nên dùng trong production build flow hiện nay."
              : "The current repo uses Prisma `db push` for the metadata schema. This is also the command you should use in the current production build flow."}
          </Prose>

          <CodeBlock title="Terminal">
            <CodeLine>cd server</CodeLine>
            <CodeLine>npx prisma db push</CodeLine>
          </CodeBlock>
        </StepBlock>

        <StepBlock
          step={4}
          title={
            t ? "Chạy backend và frontend" : "Run the backend and frontend"
          }
        >
          <CodeBlock title="Backend">
            <CodeLine>cd server</CodeLine>
            <CodeLine>npm run start:dev</CodeLine>
          </CodeBlock>
          <div className="h-4" />
          <CodeBlock title="Frontend">
            <CodeLine>cd client</CodeLine>
            <CodeLine>npm run dev</CodeLine>
          </CodeBlock>
        </StepBlock>

        <StepBlock
          step={5}
          title={
            t
              ? "Tùy chọn: cấu hình AI trong UI"
              : "Optional: configure AI in the UI"
          }
        >
          <Prose>
            {t
              ? "Sau khi đăng nhập, mở `Hồ sơ > Cấu hình AI` để chọn model riêng cho `AI Assistant`, `Explain`, `AI SQL`, `AI NoSQL`, và `Autocomplete`. Nếu bạn có provider OpenAI-compatible của riêng mình, nhập Base URL + API key rồi bấm `Tải model` để lấy danh sách model; nếu provider không trả catalog, bạn vẫn có thể nhập model thủ công."
              : "After signing in, open `Profile > Configure AI` to choose separate models for `AI Assistant`, `Explain`, `AI SQL`, `AI NoSQL`, and `Autocomplete`. If you have your own OpenAI-compatible provider, enter its Base URL and API key, then press `Load models` to fetch the model catalog; if the provider does not return a catalog, you can still type the model manually."}
          </Prose>
        </StepBlock>
      </DocSection>

      <DocSection title={t ? "Chạy từ root repo" : "Run from the repo root"}>
        <Prose>
          {t
            ? "Nếu muốn bật toàn bộ stack development bằng một lệnh, root repo đã có script `npm run dev`. Lưu ý: script này chỉ hoạt động khi `server/node_modules` và `client/node_modules` đã được cài trước."
            : "If you want to boot the whole development stack with one command, the repo root already provides `npm run dev`. Note that this works only after `server/node_modules` and `client/node_modules` have already been installed."}
        </Prose>

        <CodeBlock title="Terminal">
          <CodeLine>npm run dev</CodeLine>
        </CodeBlock>
      </DocSection>

      <DocSection title={t ? "Docker notes" : "Docker notes"}>
        <Prose>
          {t
            ? "Docker phù hợp khi bạn muốn metadata database cục bộ ổn định hoặc không muốn cài PostgreSQL trực tiếp trên máy. Với code hiện tại, đường manual setup + `prisma db push` vẫn là lối dev đơn giản nhất; còn dependency của `server` và `client` vẫn nên được cài riêng nếu bạn chạy dev ngoài container."
            : "Docker is a good fit if you want a stable local metadata database or do not want to install PostgreSQL directly on your machine. With the current codebase, manual setup + `prisma db push` is still the easiest development path, and `server` / `client` dependencies should still be installed separately when you run dev outside containers."}
        </Prose>

        <CodeBlock title="Docker">
          <CodeLine>docker-compose up --build -d</CodeLine>
        </CodeBlock>
      </DocSection>

      <DocSection
        title={t ? "Các địa chỉ local quan trọng" : "Important local URLs"}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Globe className="h-4 w-4 text-blue-500" />
              Frontend
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              http://localhost:5173
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Terminal className="h-4 w-4 text-emerald-500" />
              API
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              http://localhost:3001/api
            </div>
          </div>
          <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Database className="h-4 w-4 text-amber-500" />
              Health
            </div>
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              http://localhost:3001/api/health
            </div>
          </div>
        </div>
      </DocSection>

      <Callout type="warning">
        <p className="text-sm">
          {t
            ? "Nếu backend không khởi động được sau khi sửa env, hãy kiểm tra `JWT_SECRET` và `ENCRYPTION_KEY` trước. Backend hiện fail-closed nếu secret yếu hoặc sai format. Nếu bạn đang dùng DB cloud, hãy nhớ local/network có thể chặn các cổng database như 5432, 3306, hoặc 27017."
            : "If the backend refuses to start after env changes, check `JWT_SECRET` and `ENCRYPTION_KEY` first. The backend now fails closed when secrets are weak or wrongly formatted. If you use a cloud database, remember that local networks can block database ports such as 5432, 3306, or 27017."}
        </p>
      </Callout>

      <Callout type="info">
        <p className="text-sm">
          {t
            ? "Production hiện nên build backend bằng `npx prisma db push && npm run build` thay vì `prisma migrate deploy`, vì migration history hiện tại của repo chưa sẵn sàng cho PostgreSQL deploy flow chuẩn."
            : "Production should currently build the backend with `npx prisma db push && npm run build` instead of `prisma migrate deploy`, because the repo migration history is not yet aligned with a clean PostgreSQL deploy flow."}
        </p>
      </Callout>

      <Callout type="tip">
        <p className="text-sm">
          {t
            ? "Lưu ý về timeout AI: example file trong repo hiện dùng `15000ms` cho local/dev để fail nhanh hơn khi debug. Ở production, bạn có thể tăng giá trị này nếu workflow của bạn thường xuyên có prompt dài hoặc attachment nặng."
            : "AI timeout note: the example files in the repo currently use `15000ms` for local/dev so failures surface faster while debugging. In production, you can raise that value if your workflows often involve long prompts or heavy attachments."}
        </p>
      </Callout>
    </DocPageLayout>
  );
}
