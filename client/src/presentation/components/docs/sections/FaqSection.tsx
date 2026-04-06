import { DocPageLayout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function FaqSection({ lang }: Props) {
    const t = lang === 'vi';

    const faqs = [
        {
            q: t ? 'Tôi có cần cài database trước khi dùng Data Explorer không?' : 'Do I need a database before using Data Explorer?',
            a: t
                ? 'Có. Data Explorer là công cụ quản lý và khám phá dữ liệu, không phải database server. Bạn cần ít nhất một database đang chạy để kết nối vào. App metadata của Data Explorer cũng cần một PostgreSQL riêng cho users, connections, saved queries, dashboards và các dữ liệu nội bộ khác.'
                : 'Yes. Data Explorer is a management and exploration tool, not a database server. You need at least one running database to connect to. The app itself also needs a separate PostgreSQL database for users, connections, saved queries, dashboards, and other internal metadata.'
        },
        {
            q: t ? 'App hiện hỗ trợ những engine nào?' : 'Which engines are supported right now?',
            a: t
                ? 'Hiện tại app hỗ trợ PostgreSQL, MySQL, SQL Server, MongoDB và MongoDB Atlas (SRV). SQL workspace và NoSQL workspace là hai bề mặt riêng, nhưng cùng dùng chung hệ thống auth, connections, AI, dashboards và audit.'
                : 'The app currently supports PostgreSQL, MySQL, SQL Server, MongoDB, and MongoDB Atlas (SRV). The SQL workspace and NoSQL workspace are separate surfaces, but they share the same auth, connections, AI, dashboards, and audit foundations.'
        },
        {
            q: t ? 'Dữ liệu của tôi có bị gửi lên cloud không?' : 'Is my data sent to the cloud?',
            a: t
                ? 'Không theo kiểu “dump toàn bộ data” lên cloud. Khi dùng AI, app có thể gửi prompt, schema context, hoặc phần ngữ cảnh bạn chủ động yêu cầu sang provider AI đang cấu hình. App hiện ưu tiên không render raw HTML từ AI và không tự gửi toàn bộ result set trừ khi flow đó thật sự cần.'
                : 'Not in the sense of dumping your whole database to the cloud. When you use AI, the app can send prompts, schema context, or the context you explicitly request to the configured AI provider. The app now avoids rendering raw HTML from AI and does not automatically send full result sets unless that flow really needs them.'
        },
        {
            q: t ? 'AI hiện dùng Gemini hay gì khác?' : 'Does the AI only use Gemini?',
            a: t
                ? 'Không còn chỉ là Gemini. App hiện có AI routing: Gemini vẫn là lane chất lượng cao, nhưng bạn có thể cấu hình thêm Cerebras và OpenRouter để giảm tần suất gọi Gemini. Routing mode trong UI sẽ quyết định ưu tiên lane nào, và mỗi response đều hiển thị provider/model thực tế.'
                : 'No longer Gemini-only. The app now supports AI routing: Gemini remains the high-quality lane, but you can also configure Cerebras and OpenRouter to reduce Gemini usage. The routing mode in the UI controls which lane is preferred, and every response shows the actual provider/model that answered.'
        },
        {
            q: t ? 'Tại sao AI trả lời khác nhau giữa các mode như Auto, Fast / Cheap và Gemini Only?' : 'Why do answers differ across Auto, Fast / Cheap, and Gemini Only?',
            a: t
                ? 'Vì mỗi mode điều khiển router khác nhau. `Auto` cân bằng chi phí và chất lượng, `Fast / Cheap` ưu tiên lane rẻ hơn trước, `Best Quality` nghiêng về Gemini sớm hơn, còn `Gemini Only` luôn dùng model Gemini bạn đã chọn. Nếu provider rẻ trả lời không tốt hoặc fail, app có thể fallback tùy mode.'
                : 'Because each mode steers the router differently. `Auto` balances cost and quality, `Fast / Cheap` prefers lower-cost lanes first, `Best Quality` leans toward Gemini earlier, and `Gemini Only` always uses the Gemini model you selected. If a cheaper provider performs badly or fails, the app can fallback depending on the active mode.'
        },
        {
            q: t ? 'Tại sao tôi bị mất đăng nhập sau refresh hay restart?' : 'Why do I lose my login after refresh or restart?',
            a: t
                ? 'Hiện tại app đang persist JWT session ở client để giữ trải nghiệm refresh mượt. Nếu bạn vẫn bị out, hãy kiểm tra `JWT_SECRET` trên backend có cố định hay không và backend/frontend có đang chạy cùng version không. Một JWT secret đổi giữa các lần deploy hoặc restart sẽ làm token cũ mất hiệu lực.'
                : 'The app currently persists the JWT session on the client to keep refreshes smooth. If you still get logged out, check whether `JWT_SECRET` is fixed on the backend and whether the frontend/backend are running matching versions. Changing the JWT secret across deploys or restarts invalidates older tokens.'
        },
        {
            q: t ? 'Saved queries hiện lưu ở đâu?' : 'Where are saved queries stored now?',
            a: t
                ? 'Saved queries không còn chỉ là local-only nữa. Chúng được lưu ở backend metadata database và hỗ trợ `private`, `team`, và `workspace` visibility. Tab content vẫn có state phía client để phục hồi UX, nhưng luồng saved queries đã là server-backed.'
                : 'Saved queries are no longer local-only. They are stored in the backend metadata database and support `private`, `team`, and `workspace` visibility. Tab content still has client-side state for UX recovery, but the saved-query flow itself is now server-backed.'
        },
        {
            q: t ? 'Vì sao `prisma migrate deploy` lỗi còn `prisma db push` lại chạy được?' : 'Why does `prisma migrate deploy` fail while `prisma db push` works?',
            a: t
                ? 'Vì migration history hiện tại của repo chưa khớp một PostgreSQL deploy flow sạch. Trong trạng thái hiện nay, bạn nên dùng `npx prisma db push` cho local và production build. Đây là lý do docs deployment hiện nhấn mạnh `db push` thay vì `migrate deploy`.'
                : 'Because the current migration history in the repo is not aligned with a clean PostgreSQL deploy flow. In the current state, you should use `npx prisma db push` for local and production builds. That is why the deployment docs now emphasize `db push` instead of `migrate deploy`.'
        },
        {
            q: t ? 'Tại sao kết nối database ở trường hoặc mạng công cộng lại hay bị lỗi?' : 'Why do database connections often fail on school or public networks?',
            a: t
                ? 'Nhiều mạng chặn trực tiếp các cổng database như 5432, 3306 hoặc 27017. Khi đó cả local dev lẫn app web đều có thể gặp lỗi reachability tới DB cloud/private. Giải pháp thực tế nhất là dùng DB local cho dev, hoặc tunnel/VPN/agent cho các mạng bị chặn mạnh.'
                : 'Many networks block database ports such as 5432, 3306, or 27017 directly. In that case, both local development and the deployed app can lose reachability to cloud or private databases. The most practical workaround is to use a local database for development, or tunnels/VPN/agents on heavily restricted networks.'
        },
        {
            q: t ? 'AI-generated SQL có chạy ngay lập tức không?' : 'Does AI-generated SQL run immediately?',
            a: t
                ? 'Không mặc định. `Insert into editor` chỉ chèn SQL vào editor. `Run suggestion` mới là hành động chạy, và app hiện có bước xác nhận trước khi execute SQL do AI đề xuất để giảm rủi ro chạy nhầm.'
                : 'Not by default. `Insert into editor` only inserts SQL into the editor. `Run suggestion` is the action that executes it, and the app now shows a confirmation step before running AI-generated SQL to reduce the risk of accidental execution.'
        },
        {
            q: t ? 'Tại sao connection của tôi bị chặn bởi guardrails?' : 'Why is my connection blocked by guardrails?',
            a: t
                ? 'Connection hiện có policy flags như `readOnly`, `allowSchemaChanges`, `allowImportExport`, và `allowQueryExecution`. Backend sẽ enforce các guardrails này kể cả khi frontend bị bypass. Nếu một câu lệnh bị chặn, UI sẽ hiển thị lý do thay vì chỉ thất bại mơ hồ.'
                : 'Connections now carry policy flags such as `readOnly`, `allowSchemaChanges`, `allowImportExport`, and `allowQueryExecution`. The backend enforces these guardrails even if the frontend is bypassed. When a statement is blocked, the UI shows a clear reason instead of failing vaguely.'
        },
    ];

    return (
        <DocPageLayout
            title={t ? 'Câu hỏi thường gặp & khắc phục sự cố' : 'FAQ & troubleshooting'}
            subtitle={t
                ? 'Những câu hỏi và lỗi phổ biến nhất, được cập nhật đúng với Data Explorer hiện tại.'
                : 'The most common questions and failure modes, updated to match the current Data Explorer codebase.'}
        >
            <div className="space-y-4">
                {faqs.map((faq, i) => (
                    <details key={i} className="group border rounded-2xl bg-card overflow-hidden">
                        <summary className="flex items-center gap-4 p-5 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0 group-open:bg-primary group-open:text-primary-foreground transition-colors">
                                {i + 1}
                            </div>
                            <span className="font-bold text-sm">{faq.q}</span>
                            <span className="ml-auto text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="px-5 pb-5 pt-0">
                            <div className="pl-12 border-l-2 border-primary/20 ml-4">
                                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                            </div>
                        </div>
                    </details>
                ))}
            </div>
        </DocPageLayout>
    );
}
