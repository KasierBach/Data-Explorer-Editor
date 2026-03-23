import { Wand2, Shield, Cpu, MessageSquare, ShieldCheck, CheckCircle, XCircle, Zap, Terminal } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function AiServiceSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Trợ lý AI Gemini — Deep Dive' : 'Gemini AI Assistant — Deep Dive'}
            subtitle={t
                ? 'Phân tích chi tiết kiến trúc, cơ chế xử lý Context và các kỹ thuật tối ưu hóa mã nguồn SQL bằng trí tuệ nhân tạo hàng đầu từ Google.'
                : 'A technical deep-dive into architecture, context handling, and SQL optimization techniques using state-of-the-art AI from Google.'}
            gradient
        >
            {/* Value Proposition Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {[
                    {
                        icon: <Zap className="w-6 h-6 text-amber-500" />,
                        title: t ? 'Gemini 3.1 Flash-Lite' : 'Gemini 3.1 Flash-Lite',
                        desc: t ? 'Tối ưu hóa độ trễ cực thấp (Sub-second) cho các tính năng Ghost Text và Inline Completion.' : 'Ultra-low latency (Sub-second) optimization for Ghost Text and Inline Completion features.'
                    },
                    {
                        icon: <Shield className="w-6 h-6 text-emerald-500" />,
                        title: t ? 'Context Clipping' : 'Context Clipping',
                        desc: t ? 'Thuật toán nén lược đồ (schema) thông minh để tối ưu hóa context window (32k - 1M tokens).' : 'Intelligent schema compression algorithm to optimize context window usage.'
                    },
                    {
                        icon: <Cpu className="w-6 h-6 text-blue-500" />,
                        title: t ? 'Multi-Dialect Core' : 'Multi-Dialect Core',
                        desc: t ? 'Tự động điều chỉnh cú pháp theo PostgreSQL, MySQL hoặc T-SQL dựa trên loại kết nối.' : 'Automatic syntax adjustment for PostgreSQL, MySQL, or T-SQL based on connection type.'
                    }
                ].map((item, id) => (
                    <div key={id} className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors border-border/50">
                        <div className="mb-4">{item.icon}</div>
                        <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            <DocSection title={t ? 'Kiến trúc Workflow (AI Orchestration)' : 'AI Orchestration Workflow'}>
                <Prose>
                    {t
                        ? 'Khi bạn gửi một yêu cầu tới trợ lý AI, Data Explorer không chỉ gửi đi câu hỏi của bạn. Chúng tôi thực hiện một quy trình gồm 4 bước nghiêm ngặt để đảm bảo câu trả lời có tính thực thi cao nhất và bảo mật tuyệt đối.'
                        : 'When you send a request to the AI assistant, Data Explorer doesn\'t just send your question. We execute a strict 4-step workflow to ensure the highest reliability and absolute security:'}
                </Prose>

                <div className="my-10 space-y-8">
                    {[
                        {
                            step: "01",
                            title: t ? 'Schema Harvesting & Pruning' : 'Schema Harvesting & Pruning',
                            desc: t ? 'Hệ thống tự động quét metadata. Nếu database quá lớn, chúng tôi sử dụng thuật toán "Semantic Pruning" để chỉ lấy những bảng có khả năng liên quan nhất đến câu hỏi.' : 'Automatically scans metadata. If the DB is large, we use "Semantic Pruning" to keep only the most relevant tables.'
                        },
                        {
                            step: "02",
                            title: t ? 'Prompt Engineering (JSON Mode)' : 'Prompt Engineering (JSON Mode)',
                            desc: t ? 'Câu lệnh được bọc trong một System Instruction khổng lồ, ép Gemini hoạt động trong "JSON Mode" để trả về cấu trúc gồm: SQL, Giải thích, và Danh sách bảng bị ảnh hưởng.' : 'Enforces Gemini into "JSON Mode" via massive System Instructions to return: SQL, Explanation, and Affected Tables list.'
                        },
                        {
                            step: "03",
                            title: t ? 'Context Window Management' : 'Context Window Management',
                            desc: t ? 'Sử dụng Gemini 1.5 Flash với 1M context window cho phép chúng tôi gửi toàn bộ lược đồ của những database phức tạp nhất mà không bị mất mát thông tin.' : 'Leveraging Gemini 1.5 Flash with its 1M context window allows us to send entire schemas of complex databases without information loss.'
                        },
                        {
                            step: "04",
                            title: t ? 'Syntax Validation & Cleaning' : 'Syntax Validation & Cleaning',
                            desc: t ? 'Backend thực hiện "Regex Cleaning" để loại bỏ markdown thừa và kiểm tra các từ khóa nguy hiểm trước khi trả kết quả về UI.' : 'Backend performs "Regex Cleaning" to strip markdown and checks for dangerous keywords before returning results.'
                        }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-6 group">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center text-[10px] font-black group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                    {item.step}
                                </div>
                                <div className="w-px flex-1 bg-border my-2" />
                            </div>
                            <div className="pb-8">
                                <h5 className="font-bold text-sm text-foreground">{item.title}</h5>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection title={t ? 'Cơ chế Nén Lược đồ (Retrieval-Augmented Schema)' : 'Retrieval-Augmented Schema (RAS)'}>
                <Prose>
                    {t
                        ? 'Gửi hàng trăm bảng vào một Prompt có thể làm lãng phí token và gây nhiễu cho AI. Data Explorer sử dụng kỹ thuật "Retrieval-Augmented" để chỉ gửi những thông tin thực sự cần thiết.'
                        : 'Sending hundreds of tables in a single prompt can waste tokens and confuse the AI. Data Explorer uses "Retrieval-Augmented" techniques to send only what is truly necessary.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-4 mt-8">
                    <InfoCard 
                        icon={<CheckCircle className="w-5 h-5" />} 
                        title={t ? 'Những gì được gửi' : 'What is Sent'} 
                        color="blue"
                    >
                        <ul className="text-xs space-y-2 opacity-80">
                            <li>• {t ? 'Tên bảng & Cột (Standardized)' : 'Standardized Table & Column names'}</li>
                            <li>• {t ? 'Kiểu dữ liệu cơ bản (Mapped)' : 'Mapped basic data types'}</li>
                            <li>• {t ? 'Quan hệ khóa ngoại (Foreign Keys)' : 'Foreign Key definitions'}</li>
                            <li>• {t ? 'Mô tả Comment trên DB' : 'In-DB Comments (Metadata)'}</li>
                        </ul>
                    </InfoCard>
                    <InfoCard 
                        icon={<XCircle className="w-5 h-5" />} 
                        title={t ? 'Những gì bị loại bỏ' : 'What is Stripped'} 
                        color="red"
                    >
                        <ul className="text-xs space-y-2 opacity-80">
                            <li>• {t ? 'Dữ liệu hàng thực tế (Data Privacy)' : 'Actual row values (Data Privacy)'}</li>
                            <li>• {t ? 'Các bảng hệ thống & Internal views' : 'System tables & internal views'}</li>
                            <li>• {t ? 'Hàm & Thủ tục quá phức tạp' : 'Overly complex functions/procedures'}</li>
                            <li>• {t ? 'Thông tin hạ tầng nhạy cảm' : 'Sensitive infrastructure info'}</li>
                        </ul>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Tối ưu hóa Chi phí & Hiệu năng' : 'Cost & Performance Optimization'}>
                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2">
                             <Wand2 className="w-4 h-4 text-primary" />
                             {t ? 'Smart Debouncing (800ms)' : 'Smart Debouncing (800ms)'}
                        </h5>
                        <div className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Hệ thống Ghost Text không gửi yêu cầu khi bạn đang gõ. Chúng tôi chờ 800ms "idle" để đảm bảo ý định của bạn đã rõ ràng, giúp giảm 70% chi phí token.'
                                : 'The Ghost Text system doesn\'t send requests while you type. We wait for an 800ms "idle" period to ensure clarity, reducing token costs by 70%.'}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h5 className="text-sm font-bold flex items-center gap-2">
                             <Terminal className="w-4 h-4 text-primary" />
                             {t ? 'Streaming & Partial Parsing' : 'Streaming & Partial Parsing'}
                        </h5>
                        <div className="text-xs text-muted-foreground leading-relaxed">
                            {t
                                ? 'Sử dụng Server-Sent Events (SSE) để truyền tải kết quả từ Gemini. UI có thể hiển thị mã SQL ngay khi khối logic đầu tiên được tạo ra.'
                                : 'Uses Server-Sent Events (SSE) to stream Gemini results. The UI can display SQL code as soon as the first logic block is generated.'}
                        </div>
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Quyền riêng tư & An toàn (Security First)' : 'Privacy & Security First'}>
                <div className="p-8 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 space-y-6">
                    <div className="flex items-center gap-3 text-emerald-600">
                        <Shield className="w-6 h-6" />
                        <h4 className="font-bold uppercase text-xs tracking-widest">{t ? 'Bảo vệ dữ liệu doanh nghiệp' : 'Enterprise Data Protection'}</h4>
                    </div>
                    <Prose>
                        {t
                            ? 'Chúng tôi hiểu rằng cấu trúc cơ sở dữ liệu là tài sản nhạy cảm. Data Explorer áp dụng các tiêu chuẩn an toàn cao nhất:'
                            : 'We understand that database structure is sensitive. Data Explorer applies the highest security standards:'}
                    </Prose>
                    <div className="grid md:grid-cols-2 gap-8 mt-6">
                        <div className="flex gap-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg h-fit"><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                            <div>
                                <h5 className="font-bold text-xs">{t ? 'Cô lập API Key' : 'API Key Isolation'}</h5>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                                    {t ? 'Khóa Gemini API được mã hóa AES-256 và lưu trữ nghiêm ngặt phía Server. Client không bao giờ nhìn thấy khóa này.' : 'Gemini API Keys are AES-256 encrypted and stored strictly on the Server. Clients never see this key.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg h-fit"><MessageSquare className="w-4 h-4 text-emerald-500" /></div>
                            <div>
                                <h5 className="font-bold text-xs">{t ? 'Không dùng huấn luyện' : 'No Data Training'}</h5>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                                    {t ? 'Dữ liệu truyền qua Gemini API của Google Cloud/Vertex AI cam kết không được dùng để huấn luyện các model công cộng.' : 'Data passed via Google Cloud/Vertex AI Gemini APIs is committed NOT to be used for public model training.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
