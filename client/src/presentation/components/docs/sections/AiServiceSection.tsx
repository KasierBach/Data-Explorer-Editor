import {
    Bot,
    Gauge,
    Image,
    Route,
    Search,
    Shield,
    Sparkles,
} from 'lucide-react';
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
} from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function AiServiceSection({ lang }: Props) {
    const t = lang === 'vi';

    return (
        <DocPageLayout
            title={t ? 'Định tuyến AI & Trợ lý' : 'AI Routing & Assistant'}
            subtitle={t
                ? 'Cách Data Explorer chọn lane AI, khi nào dùng model rẻ hơn hay mạnh hơn, đâu là ranh giới giữa chat, SQL/MQL generation, vision, live search, và các guardrails bảo vệ việc thực thi.'
                : 'How Data Explorer chooses AI lanes, when it prefers cheaper or stronger models, and where the boundaries sit between chat, SQL/MQL generation, vision, live search, and execution guardrails.'}
            gradient
        >
            <FeatureGrid columns={3}>
                <InfoCard icon={<Route className="w-6 h-6 text-blue-500" />} title={t ? 'Routing theo ngữ cảnh' : 'Context-driven routing'} color="blue">
                    <p>
                        {t
                            ? 'AI không chạy theo một model cứng duy nhất. Prompt ngắn, prompt dài, image input, và yêu cầu current-info có thể đi qua các lane khác nhau nếu routing mode và provider capability cho phép.'
                            : 'AI does not run through one hard-coded model. Short prompts, longer tasks, image input, and current-info requests can travel through different lanes when the routing mode and provider capabilities allow it.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Sparkles className="w-6 h-6 text-emerald-500" />} title={t ? 'Structured output trước, text sau' : 'Structured output first, text second'} color="emerald">
                    <p>
                        {t
                            ? 'Khi yêu cầu mang tính hành động, app ưu tiên ép AI trả về output có cấu trúc hơn để SQL, MQL, explanation, recommendation card, và nguồn tham chiếu đi vào UI một cách an toàn hơn.'
                            : 'When the request is actionable, the app prefers a more structured AI response so SQL, MQL, explanations, recommendation cards, and sources arrive in the UI more safely.'}
                    </p>
                </InfoCard>
                <InfoCard icon={<Shield className="w-6 h-6 text-amber-500" />} title={t ? 'Không tự động “chạy bừa”' : 'No reckless auto-run'} color="amber">
                    <p>
                        {t
                            ? 'AI có thể gợi ý lệnh và sinh payload, nhưng editor và guardrails vẫn là lớp quyết định cuối cùng trước khi truy vấn thật được thực thi.'
                            : 'AI can suggest commands and generate payloads, but the editor and guardrails still remain the last decision layer before a real query executes.'}
                    </p>
                </InfoCard>
            </FeatureGrid>

            <DocSection title={t ? 'Các routing mode trong panel AI' : 'Routing modes in the AI panel'}>
                <Prose>
                    {t
                        ? 'Routing mode là nút điều khiển hành vi ở tầng cao hơn model picker. Nó quyết định app nên ưu tiên ổn định, chi phí, tốc độ, hay chất lượng cho yêu cầu hiện tại.'
                        : 'Routing mode sits above the model picker. It decides whether the app should favor stability, cost, speed, or quality for the current request.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        {
                            title: 'Auto',
                            descVi: 'Mode mặc định nên dùng hằng ngày. Trong wiring hiện tại, app ưu tiên auto chain mặc định rồi lọc lại theo capability như vision hoặc live search khi prompt thực sự cần.',
                            descEn: 'The default daily mode. In the current wiring, the app starts from the default auto chain and then filters it by capabilities such as vision or live search when the prompt genuinely needs them.'
                        },
                        {
                            title: 'Fast / Cheap',
                            descVi: 'Thiên về iteration nhanh và lane rẻ hơn, nhưng trong repo hiện tại khác biệt giữa `fast` và `auto` chưa quá lớn. Những yếu tố đổi chain mạnh nhất vẫn là explicit model, vision, live search, và `gemini-only`.',
                            descEn: 'Leans toward faster, cheaper iteration, but in the current repo the difference between `fast` and `auto` is still modest. The strongest chain-changing inputs are explicit model selection, vision, live search, and `gemini-only`.'
                        },
                        {
                            title: 'Best Quality',
                            descVi: 'Mode này hữu ích nhất khi bạn đã chọn model hoặc provider cụ thể và muốn ưu tiên output mạnh hơn trong chuỗi fallback. Nếu không có explicit model, thứ tự chain hiện tại vẫn còn phụ thuộc khá nhiều vào capability filtering của request.',
                            descEn: 'This mode is most useful when you already selected a concrete model or provider and want stronger output to appear earlier in the fallback chain. Without an explicit model, the current chain still depends heavily on capability filtering for the request.'
                        },
                        {
                            title: 'Gemini Only',
                            descVi: 'Khóa toàn bộ workflow vào lane Gemini đã chọn. Phù hợp khi bạn muốn đầu ra ổn định và tránh sự khác biệt giữa nhiều provider.',
                            descEn: 'Locks the workflow to the selected Gemini lane. Best when you want predictable behavior and fewer cross-provider differences.'
                        }
                    ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                            <h3 className="text-sm font-bold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {t ? item.descVi : item.descEn}
                            </p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Điều gì thật sự đổi provider chain hiện tại?' : 'What actually changes the provider chain right now?'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? '1. Explicit model hoặc explicit provider' : '1. Explicit model or explicit provider'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Khi bạn chọn dạng như `groq:<model>`, `beeknoee:<model>`, hoặc `tokenrouter:<model>`, app sẽ cố route thẳng tới provider tương ứng trước khi nghĩ tới fallback rộng hơn. Đây là nút điều khiển mạnh nhất nếu bạn cần hành vi ổn định và có chủ đích.'
                                : 'When you choose shapes such as `groq:<model>`, `beeknoee:<model>`, or `tokenrouter:<model>`, the app attempts to route directly into that provider before considering broader fallback. This is the strongest control when you need stable and intentional behavior.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? '2. Prompt có ảnh đính kèm' : '2. Prompts with image attachments'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Nếu request có ảnh, chain sẽ bị lọc lại để chỉ giữ những lane vision-capable. Đây là lý do nhiều provider text-only biến mất hoàn toàn khỏi lượt chạy đó.'
                                : 'If the request contains an image, the chain is filtered so only vision-capable lanes survive. That is why many text-only providers disappear entirely from that execution.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? '3. Prompt bị nhận diện là cần thông tin hiện thời' : '3. Prompts detected as current-information requests'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Các prompt kiểu “mới nhất”, “hôm nay”, “giá”, “thời tiết”, hay “search web” sẽ bị gắn cờ live-search. Khi đó app chỉ giữ các lane được wiring là search-capable thay vì cố trả lời kiểu đoán mò.'
                                : 'Prompts such as “latest”, “today”, “price”, “weather”, or “search web” are flagged as live-search requests. The app then keeps only lanes that are wired as search-capable instead of bluffing.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? '4. `gemini-only` là khác biệt cứng nhất' : '4. `gemini-only` is the hardest override'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Đây là mode thay đổi chain rõ nhất vì nó bỏ qua phần lớn sự đa dạng provider, chỉ giữ Gemini là đường chạy chính trừ khi lane này không sẵn sàng.'
                                : 'This is the clearest chain override because it discards most provider diversity and keeps Gemini as the primary route unless that lane is unavailable.'}
                        </p>
                    </div>
                </div>

                <Callout type="info">
                    <p className="text-sm">
                        {t
                            ? 'Ghi chú triển khai quan trọng: trong repo hiện tại, `Beeknoee` và `TokenRouter` không tự được nhét vào auto chain mặc định. Chúng chỉ tham gia khi bạn chọn explicit model/provider hoặc khi code được mở rộng thêm trong tương lai.'
                            : 'Important implementation note: in the current repo, `Beeknoee` and `TokenRouter` are not injected into the default auto chain on their own. They participate only when you explicitly choose those providers or when the code is expanded later.'}
                    </p>
                </Callout>
            </DocSection>

            <DocSection title={t ? 'Provider lanes hiện có trong app' : 'Provider lanes currently exposed in the app'}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InfoCard icon={<Bot className="w-5 h-5 text-violet-500" />} title="Gemini" color="purple">
                        <p className="text-xs">
                            {t
                                ? 'Lane chất lượng cao cho reasoning dài, image input, và nhiều tác vụ cần độ ổn định cao hơn.'
                                : 'The higher-quality lane for longer reasoning, image input, and tasks that need stronger reliability.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Search className="w-5 h-5 text-emerald-500" />} title="OpenRouter" color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Lane đa model linh hoạt, vừa dùng cho fallback rộng hơn, vừa là một trong các đường hỗ trợ vision và live-search tùy model cụ thể.'
                                : 'A flexible multi-model lane used for broader fallback and, depending on the chosen model, vision and live-search paths.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Gauge className="w-5 h-5 text-amber-500" />} title="Groq" color="amber">
                        <p className="text-xs">
                            {t
                                ? 'Lane thiên về tốc độ phản hồi cho chat ngắn và iteration nhanh, không phải lane chính cho vision hoặc search.'
                                : 'A low-latency lane optimized for short chat and rapid iteration rather than vision or live search.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Sparkles className="w-5 h-5 text-cyan-500" />} title="Cerebras" color="cyan">
                        <p className="text-xs">
                            {t
                                ? 'Lane chi phí thấp hơn cho các tác vụ không cần ảnh và không đòi live web search.'
                                : 'A lower-cost lane for tasks that do not need image input or live web search.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Bot className="w-5 h-5 text-green-500" />} title="Beeknoee" color="emerald">
                        <p className="text-xs">
                            {t
                                ? 'Lane explicit model trong catalog khi bạn muốn khóa thẳng vào GLM hoặc Qwen của Beeknoee thay vì chỉ trông vào fallback mặc định.'
                                : 'An explicit-model lane in the catalog when you want to target Beeknoee models directly instead of relying on default fallback.'}
                        </p>
                    </InfoCard>
                    <InfoCard icon={<Image className="w-5 h-5 text-blue-500" />} title="TokenRouter / MiniMax-M3" color="blue">
                        <p className="text-xs">
                            {t
                                ? 'Lane explicit mới để khóa vào MiniMax-M3. Trong repo hiện tại, lane này được xem là vision-capable khi bạn chọn đúng model, nhưng không được coi là live-search lane.'
                                : 'A newer explicit lane for MiniMax-M3. In the current repo it is treated as vision-capable when you pick that model, but it is not treated as a live-search lane.'}
                        </p>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Chọn model explicit thực sự làm gì?' : 'What explicit model selection really changes'}>
                <Prose>
                    {t
                        ? 'Model picker không chỉ đổi label cho đẹp. Với các model dạng `beeknoee:<slug>`, `groq:<slug>`, hoặc `tokenrouter:<slug>`, app sẽ route thẳng sang provider tương ứng nếu provider đó đã được cấu hình. Điều này đặc biệt hữu ích khi bạn muốn kiểm soát model output chặt hơn thay vì để router quyết định hết.'
                        : 'The model picker is not just cosmetic. With models shaped like `beeknoee:<slug>`, `groq:<slug>`, or `tokenrouter:<slug>`, the app routes directly into the matching provider when that provider is configured. This is useful when you want tighter control over model behavior instead of leaving everything to automatic routing.'}
                </Prose>

                <CodeBlock title={t ? 'Ví dụ model selection' : 'Model selection examples'}>
                    <CodeComment>{t ? 'Gemini chất lượng cao' : 'Higher-quality Gemini lane'}</CodeComment>
                    <CodeLine>gemini-3.5-flash</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Provider explicit của Beeknoee' : 'Explicit Beeknoee provider'}</CodeComment>
                    <CodeLine>beeknoee:qwen-3-235b-a22b-instruct-2507</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Provider explicit của TokenRouter' : 'Explicit TokenRouter provider'}</CodeComment>
                    <CodeLine>tokenrouter:MiniMax-M3</CodeLine>
                </CodeBlock>
            </DocSection>

            <DocSection title={t ? 'Vision và live search: ranh giới hiện tại' : 'Vision and live search: the current boundaries'}>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Vision-capable lanes' : 'Vision-capable lanes'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Trong repo hiện tại, Gemini là lane vision mặc định mạnh nhất. OpenRouter cũng có thể đóng vai trò vision nếu model được chọn thực sự hỗ trợ ảnh. TokenRouter hiện đã được app cho phép đi theo đường vision khi bạn explicit chọn `MiniMax-M3`.'
                                : 'In the current repo, Gemini is the strongest default vision lane. OpenRouter can also act as a vision path when the chosen model genuinely supports images. TokenRouter is now allowed through the vision path when you explicitly choose `MiniMax-M3`.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Live-search lanes' : 'Live-search lanes'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Live-search không đồng nghĩa với “model trả lời nghe như có web”. Trong wiring hiện tại, live-search được dành cho Gemini hoặc OpenRouter. TokenRouter / MiniMax-M3 không nên bị mô tả như một search lane chỉ vì endpoint là OpenAI-compatible.'
                                : 'Live search is not the same as a model sounding web-aware. In the current wiring, live search is reserved for Gemini and OpenRouter. TokenRouter / MiniMax-M3 should not be described as a search lane just because the endpoint is OpenAI-compatible.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Action cards, suggestion cards, và an toàn thực thi' : 'Action cards, suggestion cards, and execution safety'}>
                <Prose>
                    {t
                        ? 'Khi AI trả ra điều gì đó có thể dùng được ngay, app không ép mọi thứ thành một đoạn văn dài. Nó có thể tách SQL/MQL, explanation, nguồn tham chiếu, và recommendation cards thành các phần rõ ràng hơn để người dùng quyết định bước tiếp theo.'
                        : 'When AI returns something directly actionable, the app does not force everything into one long paragraph. It can separate SQL/MQL, explanation, sources, and recommendation cards so the user can choose the next step more deliberately.'}
                </Prose>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Insert into editor' : 'Insert into editor'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Lựa chọn này chỉ chèn query hoặc payload vào editor hiện tại. Nó chưa phải là bước thực thi thật.'
                                : 'This only inserts the query or payload into the current editor. It is not execution yet.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
                        <h3 className="text-sm font-bold">{t ? 'Run vẫn phải qua lớp app' : 'Run still goes through the app layer'}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {t
                                ? 'Khi bạn chọn chạy, query vẫn phải đi qua query service, connection policy, và các guardrail của engine hiện tại. AI không có quyền “bỏ qua” các lớp đó.'
                                : 'When you choose to run, the query still passes through the query service, connection policy, and engine guardrails. AI cannot bypass those layers.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            <Callout type="tip">
                <p className="text-sm font-medium">
                    {t
                        ? 'Nếu bạn muốn docs AI của app thật sự đọc “chuẩn thực tế”, hãy luôn phân biệt 3 câu hỏi khác nhau: model nào đang được chọn, provider nào thực sự chạy request, và capability nào đang được wiring trong repo thay vì chỉ được provider quảng bá bên ngoài.'
                        : 'If you want the AI docs to stay grounded in reality, always separate three different questions: which model is selected, which provider actually executes the request, and which capability is truly wired into this repo rather than merely advertised externally.'}
                </p>
            </Callout>
        </DocPageLayout>
    );
}
