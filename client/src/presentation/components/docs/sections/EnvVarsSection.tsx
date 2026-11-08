import { Database, Globe, Key, Mail, Server, Shield } from "lucide-react";
import { publicPath } from '@/core/seo/publicRoutes';
import { Callout, CodeBlock, CodeComment, CodeLine, DocPageLayout, DocSection, Prose } from "../primitives";

interface Props {
  lang: "vi" | "en";
}

export function EnvVarsSection({ lang }: Props) {
  const t = lang === "vi";

  const categories = [
    {
      title: t ? "Cơ sở hạ tầng (Infrastructure)" : "Infrastructure",
      icon: <Server className="h-5 w-5 text-blue-500" />,
      vars: [
        {
          name: "PORT",
          desc: t
            ? "Cổng NestJS; đặt PORT=3001 cho local host dev để khớp VITE_API_URL"
            : "NestJS port; set PORT=3001 for local host development to match VITE_API_URL",
          example: "3001",
        },
        {
          name: "NODE_ENV",
          desc: t ? "Môi trường chạy app" : "App environment",
          example: "development | production",
        },
        {
          name: "REDIS_URL",
          desc: t
            ? "URL kết nối tới Redis cho caching, presence, notification, queue, và search flows"
            : "Redis connection URL for caching, presence, notification, queue, and search flows",
          example: "redis://localhost:6379",
        },
      ],
    },
    {
      title: t ? "Bảo mật & Quản trị (Security & Admin)" : "Security & Admin",
      icon: <Shield className="h-5 w-5 text-red-500" />,
      vars: [
        {
          name: "JWT_SECRET",
          desc: t
            ? "Secret ngẫu nhiên ít nhất 32 byte UTF-8 để ký access token; backend từ chối giá trị thiếu, ngắn hoặc mẫu bị cấm"
            : "Random access-token secret of at least 32 UTF-8 bytes; missing, short or disallowed sample values are rejected",
          example: t ? "Sinh trên máy của bạn (xem lệnh bên dưới)" : "Generate locally (see command below)",
        },
        {
          name: "REFRESH_TOKEN_SECRET",
          desc: t
            ? "Secret riêng ít nhất 32 byte UTF-8 cho refresh token; nếu bỏ trống sẽ dùng JWT_SECRET"
            : "Separate refresh-token secret of at least 32 UTF-8 bytes; omitted values fall back to JWT_SECRET",
          example: t ? "Sinh riêng trên máy của bạn" : "Generate a separate value locally",
        },
        {
          name: "ENCRYPTION_KEY",
          desc: t
            ? "Khóa ngẫu nhiên đúng 32 byte UTF-8 để mã hóa mật khẩu kết nối và API key provider đã lưu (AES-256-GCM); không đo bằng số ký tự Unicode"
            : "Random key of exactly 32 UTF-8 bytes for saved connection passwords and provider API keys (AES-256-GCM); do not count Unicode characters",
          example: t ? "Sinh 16 byte ngẫu nhiên rồi encode hex (32 byte ASCII)" : "Generate 16 random bytes then hex-encode (32 ASCII bytes)",
        },
        {
          name: "LEGACY_ENCRYPTION_KEYS",
          desc: t
            ? "Danh sách khóa cũ phân cách bằng dấu phẩy, mỗi khóa đúng 32 byte UTF-8; chỉ giữ khóa cần để đọc dữ liệu mã hóa cũ"
            : "Comma-separated legacy keys, each exactly 32 UTF-8 bytes; retain only keys needed to read older encrypted records",
          example: "",
        },
        {
          name: "ALLOW_INTERNAL_IPS",
          desc: t
            ? "Override SSRF cho địa chỉ private/internal, mặc định false. Development cho phép một số host loopback local; không bật rộng cho production chỉ để sửa lỗi kết nối"
            : "SSRF override for private/internal addresses, default false. Development allows certain local loopback hosts; do not enable broadly in production just to fix connectivity",
          example: "true | false",
        },
        {
          name: "ADMIN_EMAIL",
          desc: t
            ? "Email khởi tạo cho tài khoản admin đầu tiên"
            : "Initial email for the first admin account",
          example: "admin@example.com",
        },
        {
          name: "ADMIN_PASSWORD",
          desc: t ? "Mật khẩu admin khởi tạo" : "Initial admin password",
          example: "strong-password",
        },
      ],
    },
    {
      title: t ? "Metastore & URL nội bộ" : "Metastore & Internal URLs",
      icon: <Database className="h-5 w-5 text-emerald-500" />,
      vars: [
        {
          name: "DATABASE_URL",
          desc: t
            ? "PostgreSQL metadata app. Ví dụ dùng host port 5435 và mật khẩu mặc định Compose change-me-local; trong container dùng db:5432"
            : "App metadata PostgreSQL. The example uses host port 5435 and Compose's change-me-local default password; containers use db:5432",
          example:
            "postgresql://postgres:change-me-local@localhost:5435/data_explorer",
        },
        {
          name: "FRONTEND_URL",
          desc: t
            ? "Origin thật dùng cho CORS và redirect; Vite local là http://localhost:5173, frontend Docker là http://localhost"
            : "Actual CORS and redirect origin; local Vite uses http://localhost:5173, the Docker frontend uses http://localhost",
          example: "http://localhost:5173",
        },
        {
          name: "API_PUBLIC_URL",
          desc: t
            ? "Public API base URL, hiện được dùng bởi các billing return / webhook flows"
            : "Public API base URL currently used by billing return / webhook flows",
          example: "http://localhost:3001/api",
        },
        {
          name: "ALLOW_INSECURE_DATABASE_TLS",
          desc: t
            ? "Override TLS toàn backend. Template đặt false để verify certificate; code coi giá trị bỏ trống hoặc khác chuỗi 'false' là cho phép TLS không an toàn. Production phải đặt rõ false. Không phải cấu hình SSL mode hoặc CA riêng từng connection"
            : "Backend-wide TLS override. Templates set false for certificate verification; the code treats an omitted value or anything other than the string 'false' as permissive. Production must explicitly set false. This is not a per-connection SSL mode or CA setting",
          example: "false",
        },
        {
          name: "VITE_API_URL",
          desc: t
            ? "API base URL trong client/.env, đọc khi Vite khởi động/build. Đây là cấu hình công khai, không đặt JWT/DB/API secret ở đây"
            : "API base URL in client/.env, read at Vite startup/build time. This is public configuration; never put JWT/DB/API secrets here",
          example: "http://localhost:3001/api",
        },
      ],
    },
    {
      title: t ? "AI Providers & LLM" : "AI Providers & LLM",
      icon: <Key className="h-5 w-5 text-amber-500" />,
      vars: [
        {
          name: "GEMINI_API_KEY",
          desc: t
            ? "Google Gemini key cho lane chất lượng cao và vision"
            : "Google Gemini key for the higher-quality and vision lane",
          example: "AIzaSy...",
        },
        {
          name: "AI_PROVIDER_TIMEOUT_MS",
          desc: t
            ? "Timeout tổng cho provider requests. Hiện code fallback và file example trong repo đều đang dùng 90000ms"
            : "Overall timeout for provider requests. The code fallback and the repo example files are both set to 90000ms right now",
          example: "90000",
        },
        {
          name: "AI_STREAM_IDLE_TIMEOUT_MS",
          desc: t
            ? "Timeout khi stream bị stall. Nếu không đặt riêng, service sẽ fallback về AI_PROVIDER_TIMEOUT_MS; mặc định hiện tại cũng là 90000ms"
            : "Timeout for stalled streams. If omitted, the service falls back to AI_PROVIDER_TIMEOUT_MS; the current default is also 90000ms",
          example: "90000",
        },
        {
          name: "CEREBRAS_API_KEY",
          desc: t
            ? "Cerebras key cho lane chi phí thấp hơn"
            : "Cerebras key for a lower-cost lane",
          example: "cbr-...",
        },
        {
          name: "CEREBRAS_BASE_URL",
          desc: t
            ? "Base URL của Cerebras OpenAI-compatible endpoint"
            : "Base URL for the Cerebras OpenAI-compatible endpoint",
          example: "https://api.cerebras.ai/v1",
        },
        {
          name: "CEREBRAS_CHAT_MODEL",
          desc: t
            ? "Model mặc định của lane Cerebras"
            : "Default model for the Cerebras lane",
          example: "llama3.1-8b",
        },
        {
          name: "OPENROUTER_API_KEY",
          desc: t
            ? "OpenRouter key cho default auto chain, fallback đa model, và một số lane vision hoặc web-backed search tùy model"
            : "OpenRouter key for the default auto chain, multi-model fallback, and some vision or web-backed search lanes depending on the chosen model",
          example: "sk-or-...",
        },
        {
          name: "OPENROUTER_BASE_URL",
          desc: t ? "Base URL của OpenRouter" : "Base URL for OpenRouter",
          example: "https://openrouter.ai/api/v1",
        },
        {
          name: "OPENROUTER_CHAT_MODEL",
          desc: t
            ? "Model mặc định của lane OpenRouter"
            : "Default model for the OpenRouter lane",
          example: "",
        },
        {
          name: "GROQ_API_KEY",
          desc: t
            ? "Groq key cho lane phản hồi nhanh"
            : "Groq key for the low-latency lane",
          example: "gsk-...",
        },
        {
          name: "GROQ_BASE_URL",
          desc: t
            ? "Base URL của Groq OpenAI-compatible endpoint"
            : "Base URL for the Groq OpenAI-compatible endpoint",
          example: "https://api.groq.com/openai/v1",
        },
        {
          name: "GROQ_CHAT_MODEL",
          desc: t
            ? "Model mặc định của lane Groq"
            : "Default model for the Groq lane",
          example: "openai/gpt-oss-120b",
        },
        {
          name: "BEEKNOEE_API_KEY",
          desc: t
            ? "Beeknoee key để bật explicit provider routing trong model catalog"
            : "Beeknoee key that enables explicit provider routing from the model catalog",
          example: "sk-bee-...",
        },
        {
          name: "BEEKNOEE_BASE_URL",
          desc: t
            ? "Base URL của Beeknoee API"
            : "Base URL for the Beeknoee API",
          example: "https://platform.beeknoee.com/api/v1",
        },
        {
          name: "BEEKNOEE_CHAT_MODEL",
          desc: t
            ? "Fallback model mặc định của Beeknoee khi bạn không khóa model cụ thể"
            : "Default Beeknoee fallback model when no explicit model is locked",
          example: "glm-4.7-flash",
        },
      ],
    },
    {
      title: t ? "Social Login (OAuth)" : "Social Login (OAuth)",
      icon: <Globe className="h-5 w-5 text-indigo-500" />,
      vars: [
        {
          name: "GOOGLE_CLIENT_ID",
          desc: t ? "Google OAuth Client ID" : "Google OAuth Client ID",
          example: "xxx.apps.googleusercontent.com",
        },
        {
          name: "GOOGLE_CLIENT_SECRET",
          desc: t ? "Google OAuth Client Secret" : "Google OAuth Client Secret",
          example: "GOCSPX-...",
        },
        {
          name: "GOOGLE_CALLBACK_URL",
          desc: t
            ? "Google callback URL trỏ về backend thật"
            : "Google callback URL pointing to the real backend",
          example: "http://localhost:3001/api/auth/google/callback",
        },
        {
          name: "GITHUB_CLIENT_ID",
          desc: t ? "GitHub OAuth Client ID" : "GitHub OAuth Client ID",
          example: "Ov23...",
        },
        {
          name: "GITHUB_CLIENT_SECRET",
          desc: t ? "GitHub OAuth Client Secret" : "GitHub OAuth Client Secret",
          example: "git-...",
        },
        {
          name: "GITHUB_CALLBACK_URL",
          desc: t
            ? "GitHub callback URL trỏ về backend thật"
            : "GitHub callback URL pointing to the real backend",
          example: "http://localhost:3001/api/auth/github/callback",
        },
      ],
    },
    {
      title: t ? "Email (Brevo/Auth)" : "Email (Brevo/Auth)",
      icon: <Mail className="h-5 w-5 text-cyan-500" />,
      vars: [
        {
          name: "MAIL_USER",
          desc: t
            ? "Email sender dùng cho Brevo REST API và auth notifications"
            : "Sender email used by the Brevo REST API and auth notifications",
          example: "your-email@gmail.com",
        },
        {
          name: "MAIL_PASS",
          desc: t
            ? "Brevo API key hoặc mail service key; nếu thiếu app sẽ log email ra console"
            : "Brevo API key or mail service key; if missing, the app logs emails to the console",
          example: "xkeysib-...",
        },
      ],
    },
    {
      title: t ? "Billing providers" : "Billing providers",
      icon: <Key className="h-5 w-5 text-rose-500" />,
      vars: [
        {
          name: "MOMO_PARTNER_CODE",
          desc: t
            ? "Partner code cho MoMo checkout"
            : "Partner code for MoMo checkout",
          example: "",
        },
        {
          name: "MOMO_ACCESS_KEY",
          desc: t ? "Access key cho MoMo" : "Access key for MoMo",
          example: "",
        },
        {
          name: "MOMO_SECRET_KEY",
          desc: t
            ? "Secret key cho MoMo signature"
            : "Secret key for MoMo signatures",
          example: "",
        },
        {
          name: "MOMO_CREATE_URL",
          desc: t
            ? "Endpoint tạo payment của MoMo (sandbox/local nên dùng test URL)"
            : "MoMo payment creation endpoint (use the sandbox URL locally)",
          example: "https://test-payment.momo.vn/v2/gateway/api/create",
        },
        {
          name: "ZALOPAY_APP_ID",
          desc: t ? "App ID cho ZaloPay" : "App ID for ZaloPay",
          example: "",
        },
        {
          name: "ZALOPAY_KEY1",
          desc: t
            ? "Primary signing key cho ZaloPay"
            : "Primary signing key for ZaloPay",
          example: "",
        },
        {
          name: "ZALOPAY_KEY2",
          desc: t
            ? "Secondary verification key cho ZaloPay"
            : "Secondary verification key for ZaloPay",
          example: "",
        },
        {
          name: "ZALOPAY_CREATE_URL",
          desc: t
            ? "Endpoint tạo payment của ZaloPay sandbox"
            : "Sandbox payment creation endpoint for ZaloPay",
          example: "https://sb-openapi.zalopay.vn/v2/create",
        },
      ],
    },
  ];

  return (
    <DocPageLayout
      title={t ? "Biến môi trường" : "Environment Variables"}
      subtitle={
        t
          ? "Tham chiếu các biến môi trường quan trọng, phân biệt backend runtime, Docker Compose và frontend Vite."
          : "A reference for key environment variables, separating backend runtime, Docker Compose and the Vite frontend."
      }
    >
      <div className="space-y-12">
        <DocSection
          title={t ? "Cách đọc phần env này" : "How to read this env reference"}
        >
          <Prose>
            {t
              ? "Root .env.example dành cho Compose; server/.env dành cho backend chạy trên host; client/.env chứa VITE_API_URL. Không chép nguyên placeholder: ví dụ server có mật khẩu postgres nhưng Compose mặc định change-me-local. Local host cần PORT=3001, DATABASE_URL trỏ localhost:5435, REDIS_URL trỏ localhost:6379 và FRONTEND_URL=http://localhost:5173."
              : "The root .env.example is for Compose; server/.env is for the host backend; client/.env holds VITE_API_URL. Do not copy placeholders unchanged: the server example uses password postgres, while Compose defaults to change-me-local. Local host development needs PORT=3001, DATABASE_URL at localhost:5435, REDIS_URL at localhost:6379 and FRONTEND_URL=http://localhost:5173."}
          </Prose>

          <Callout type="info">
            <p className="text-sm">
              {t
                ? "Lưu ý thực tế: hiện code fallback và example env trong repo đều đang dùng 90000ms. Nếu local/dev của bạn muốn fail sớm hơn để debug, bạn có thể tự hạ riêng giá trị này."
                : "Practical note: the code fallback and the example env files currently both use 90000ms. If you want local/dev to fail faster while debugging, lower the value explicitly for your setup."}
            </p>
          </Callout>

          <Callout type="info">
            <p className="text-sm">
              {t
                ? "server/.env cấu hình lane AI dựng sẵn. Provider OpenAI-compatible tùy chỉnh được lưu ở server theo từng người dùng; API key được mã hóa trước khi lưu. Chỉ lựa chọn model/provider theo vai trò (Assistant, Explain, AI SQL, AI NoSQL, Autocomplete) được persist cục bộ trong trình duyệt. Không coi provider API key là dữ liệu chỉ nằm trên máy client."
                : "server/.env configures built-in AI lanes. Custom OpenAI-compatible provider records are saved per user on the server, with API keys encrypted before storage. Only per-role model/provider preferences (Assistant, Explain, AI SQL, AI NoSQL, Autocomplete) persist locally in the browser. Do not describe provider API keys as client-only data."}
            </p>
          </Callout>
        </DocSection>

        <DocSection title={t ? "Sinh secret an toàn" : "Generate secrets safely"}>
          <Prose>
            {t
              ? "Chạy lệnh sau trên máy của bạn rồi chép đầu ra vào server/.env. JWT/refresh dùng 32 byte ngẫu nhiên encode hex (64 byte ASCII); encryption key dùng 16 byte ngẫu nhiên encode hex (đúng 32 byte ASCII). Không chép ví dụ secret cố định; các giá trị mẫu như chuỗi số tuần tự đã biết bị backend từ chối. Độ dài kiểm tra là byte UTF-8 sau trim, không phải số ký tự."
              : "Run this command locally and copy its output into server/.env. JWT/refresh use 32 random bytes hex-encoded (64 ASCII bytes); the encryption key uses 16 random bytes hex-encoded (exactly 32 ASCII bytes). Never copy a fixed secret example; known sample values such as the sequential-number key are rejected. Length checks use trimmed UTF-8 bytes, not character counts."}
          </Prose>
          <CodeBlock title={t ? "Terminal / PowerShell — sinh giá trị mới mỗi lần" : "Terminal / PowerShell — new values on every run"}>
            <CodeComment>{t ? "Không commit hoặc chia sẻ đầu ra" : "Do not commit or share the output"}</CodeComment>
            <CodeLine>{`node -e "const { randomBytes } = require('node:crypto'); console.log('JWT_SECRET=' + randomBytes(32).toString('hex')); console.log('REFRESH_TOKEN_SECRET=' + randomBytes(32).toString('hex')); console.log('ENCRYPTION_KEY=' + randomBytes(16).toString('hex'));"`}</CodeLine>
          </CodeBlock>
          <Callout type="warning">
            <p className="text-sm">
              {t
                ? "Đặt ALLOW_INSECURE_DATABASE_TLS=false rõ ràng ở production: bỏ biến không đồng nghĩa an toàn. PostgreSQL remote tự dùng TLS, không có toggle riêng hoặc CA path từ URI. MySQL/MariaDB cần bật TLS trong form sau khi import URI; tls=false tắt transport, không chỉ tắt verify. ClickHouse remote dùng HTTP mặc định khi override bỏ trống; với false dùng HTTPS/cổng mặc định 8443."
                : "Explicitly set ALLOW_INSECURE_DATABASE_TLS=false in production: omitting it is not secure. Remote PostgreSQL uses automatic TLS, with no per-connection toggle or URI CA path. MySQL/MariaDB require TLS enabled in the form after importing a URI; tls=false disables transport, not just verification. Remote ClickHouse defaults to HTTP when the override is omitted; false uses HTTPS/default port 8443."}
            </p>
          </Callout>
          <Prose>
            <a href={publicPath(lang, '/docs/installation')}>{t ? "Cài đặt local đầy đủ" : "Complete local setup"}</a>{' · '}
            <a href={publicPath(lang, '/docs/data-handling')}>{t ? "Dữ liệu và AI" : "Data handling and AI"}</a>
          </Prose>
        </DocSection>

        {categories.map((cat) => (
          <DocSection key={cat.title} title={cat.title} icon={cat.icon}>
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-4">{t ? "Biến" : "Variable"}</th>
                    <th className="px-4 py-4">{t ? "Mô tả" : "Description"}</th>
                    <th className="px-4 py-4">{t ? "Ví dụ" : "Example"}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {cat.vars.map((item) => (
                    <tr
                      key={item.name}
                      className="group border-b border-white/5 transition-colors hover:bg-white/[0.01]"
                    >
                      <td className="px-4 py-4 font-mono font-bold text-primary transition-colors group-hover:text-blue-400">
                        {item.name}
                      </td>
                      <td className="px-4 py-4 leading-relaxed text-muted-foreground">
                        {item.desc}
                      </td>
                      <td className="px-4 py-4">
                        <code className="whitespace-nowrap rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px]">
                          {item.example}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DocSection>
        ))}
      </div>
    </DocPageLayout>
  );
}
