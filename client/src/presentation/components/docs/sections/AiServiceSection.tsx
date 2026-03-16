import { Wand2, Shield, Cpu, MessageSquare, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { DocPageLayout, DocSection, DocSubSection, Prose, CodeBlock, CodeComment, CodeLine, InfoCard, Callout } from '../primitives';
import { cn } from '@/lib/utils';

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
                        icon: <Wand2 className="w-6 h-6 text-violet-500" />,
                        title: t ? 'Zero-Shot SQL' : 'Zero-Shot SQL',
                        desc: t ? 'Khả năng sinh mã SQL chuẩn xác ngay từ yêu cầu đầu tiên mà không cần tài liệu huấn luyện bổ sung.' : 'Generate accurate SQL from the first prompt without needing additional training data.'
                    },
                    {
                        icon: <Shield className="w-6 h-6 text-emerald-500" />,
                        title: t ? 'Context Clipping' : 'Context Clipping',
                        desc: t ? 'Thuật toán nén lược đồ (schema) thông minh để tối ưu hóa context window (32k - 1M tokens).' : 'Intelligent schema compression algorithm to optimize context window usage.'
                    },
                    {
                        icon: <Cpu className="w-6 h-6 text-blue-500" />,
                        title: t ? 'Multi-Dialect' : 'Multi-Dialect',
                        desc: t ? 'Tự động điều chỉnh cú pháp theo PostgreSQL, MySQL hoặc T-SQL dựa trên loại kết nối.' : 'Automatic syntax adjustment for PostgreSQL, MySQL, or T-SQL based on connection type.'
                    }
                ].map((item, id) => (
                    <div key={id} className="p-6 border rounded-2xl bg-card/50 hover:bg-card transition-colors">
                        <div className="mb-4">{item.icon}</div>
                        <h4 className="font-bold text-sm mb-2">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>

            <DocSection title={t ? 'Kiến trúc Workflow' : 'Workflow Architecture'}>
                <div className="space-y-6">
                    <Prose>
                        {t
                            ? 'Khi bạn gửi một yêu cầu tới trợ lý AI, Data Explorer không chỉ gửi đi câu hỏi của bạn. Chúng tôi thực hiện một quy trình gồm 4 bước để đảm bảo câu trả lời có tính thực thi cao nhất:'
                            : 'When you send a request to the AI assistant, Data Explorer doesn\'t just send your question. we execute a 4-step workflow to ensure the highest reliability and executability:'}
                    </Prose>
                </div>

                <div className="my-8 relative">
                    <div className="absolute left-6 inset-y-0 w-px bg-border sm:left-1/2" />
                    <div className="space-y-12">
                        {[
                            {
                                step: "01",
                                title: t ? 'Schema Harvesting' : 'Schema Harvesting',
                                desc: t ? 'Hệ thống quét metadata của database hiện tại (Table, Column, Type, FK).' : 'System scans current database metadata (Tables, Columns, Types, FKs).'
                            },
                            {
                                step: "02",
                                title: t ? 'Prompt Augmentation' : 'Prompt Augmentation',
                                desc: t ? 'Gắn kèm metadata đã nén vào "System Instruction" để AI hiểu rõ bối cảnh.' : 'Attaches compressed metadata to "System Instruction" for rich context.'
                            },
                            {
                                step: "03",
                                title: t ? 'Gemini Processing' : 'Gemini Processing',
                                desc: t ? 'Gemini 1.5 Flash xử lý ở chế độ "JSON Mode" để đảm bảo output có cấu trúc.' : 'Gemini 1.5 Flash processes in "JSON Mode" for structured logical output.'
                            },
                            {
                                step: "04",
                                title: t ? 'Post-Processing' : 'Post-Processing',
                                desc: t ? 'Backend trích xuất SQL, kiểm tra bảo mật và trả về Monaco Editor.' : 'Backend extracts SQL, performs security checks, and updates Monaco Editor.'
                            }
                        ].map((item, i) => (
                            <div key={i} className="relative flex items-center gap-8 sm:justify-between group">
                                <div className={cn("hidden sm:block w-full text-right", i % 2 === 1 && "sm:order-last sm:text-left")}>
                                    <h5 className="font-bold text-sm text-foreground">{item.title}</h5>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <div className="z-10 flex items-center justify-center w-12 h-12 rounded-full border bg-card text-xs font-black shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                    {item.step}
                                </div>
                                <div className={cn("w-full sm:hidden", i % 2 === 1 && "sm:order-last")}>
                                    <h5 className="font-bold text-sm text-foreground">{item.title}</h5>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <div className="hidden sm:block w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </DocSection>

            <DocSection title={t ? 'Nén Lược đồ (Schema Compression)' : 'Schema Compression'}>
                <Prose>
                    {t
                        ? 'Gửi hàng trăm bảng vào một Prompt có thể làm lãng phí token và gây nhiễu cho AI. Data Explorer sử dụng kỹ thuật "Context Clipping" để chỉ gửi những thông tin thực sự cần thiết.'
                        : 'Sending hundreds of tables in a single prompt can waste tokens and confuse the AI. Data Explorer uses "Context Clipping" techniques to send only what is truly necessary.'}
                </Prose>
                <div className="grid md:grid-cols-2 gap-4 mt-8">
                    <InfoCard 
                        icon={<CheckCircle className="w-5 h-5" />} 
                        title={t ? 'Những gì được gửi' : 'What is Sent'} 
                        color="blue"
                    >
                        <ul className="text-xs space-y-2 opacity-80">
                            <li>• {t ? 'Tên bảng tiêu chuẩn' : 'Standard table names'}</li>
                            <li>• {t ? 'Tên cột và kiểu dữ liệu cơ bản' : 'Column names & basic types'}</li>
                            <li>• {t ? 'Quan hệ khóa ngoại (FK)' : 'Foreign Key definitions'}</li>
                            <li>• {t ? 'Mô tả Comment trên DB (nếu có)' : 'In-DB Comments (if exist)'}</li>
                        </ul>
                    </InfoCard>
                    <InfoCard 
                        icon={<XCircle className="w-5 h-5" />} 
                        title={t ? 'Những gì bị loại bỏ' : 'What is Stripped'} 
                        color="red"
                    >
                        <ul className="text-xs space-y-2 opacity-80">
                            <li>• {t ? 'Giá trị dữ liệu thực tế (Privacy)' : 'Actual row values (Privacy)'}</li>
                            <li>• {t ? 'Các bảng hệ thống (pg_*, mysql_*)' : 'System tables (pg_*, mysql_*)'}</li>
                            <li>• {t ? 'Constraints không quan trọng' : 'Non-essential constraints'}</li>
                            <li>• {t ? 'Triggers & Stored Procedures phức tạp' : 'Complex Triggers & Procedures'}</li>
                        </ul>
                    </InfoCard>
                </div>
            </DocSection>

            <DocSection title={t ? 'Mẹo Prompting dành cho Data Engineer' : 'Smart Prompts for Data Engineers'}>
                <Prose>
                    {t
                        ? 'Để tận dụng tối đa sức mạnh của Gemini, bạn có thể truyền kèm các ràng buộc kỹ thuật. Dưới đây là các Pattern "Pro-level":'
                        : 'To unlock the full potential of Gemini, you can pass technical constraints directly. Here are "Pro-level" prompt patterns:'}
                </Prose>
                <div className="space-y-6 mt-8">
                    <DocSubSection title={t ? 'Mô hình Dữ liệu Phức tạp' : 'Complex Data Modeling'}>
                        <CodeBlock title="Expert Prompt">
                            <CodeComment>{t ? '-- Prompt: "Viết truy vấn doanh thu theo tháng dùng CTE, ' : '-- Prompt: "Write revenue by month using CTE, '}</CodeComment>
                            <CodeComment>{t ? '-- xử lý trường hợp giá bằng 0 bằng NULLIF"' : '-- handle zero prices with NULLIF"'}</CodeComment>
                            <CodeLine>WITH MonthlyRevenue AS (</CodeLine>
                            <CodeLine>  SELECT date_trunc('month', created_at) as month,</CodeLine>
                            <CodeLine>  SUM(quantity * NULLIF(unit_price, 0)) as total</CodeLine>
                            <CodeLine>  FROM sales GROUP BY 1</CodeLine>
                            <CodeLine>)</CodeLine>
                            <CodeLine>SELECT * FROM MonthlyRevenue ORDER BY month;</CodeLine>
                        </CodeBlock>
                    </DocSubSection>

                    <DocSubSection title={t ? 'Tối ưu hóa Hiệu năng' : 'Performance Optimization'}>
                        <Prose>
                            {t
                                ? 'Yêu cầu AI phân tích truy vấn của bạn và gợi ý Index để thay thế full table scan.'
                                : 'Ask the AI to analyze your query and suggest Indexes to avoid full table scans.'}
                        </Prose>
                        <Callout type="warning">
                            <p className="text-xs">
                                {t
                                    ? 'Lưu ý: Luôn kiểm tra lại gợi ý của AI bằng lệnh EXPLAIN trước khi áp dụng lên Production.'
                                    : 'Note: Always verify AI suggestions with EXPLAIN before applying to Production.'}
                            </p>
                        </Callout>
                    </DocSubSection>
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
                            ? 'Chúng tôi hiểu rằng dữ liệu cơ sở dữ liệu là tài sản nhạy cảm nhất. Data Explorer cam kết:'
                            : 'We understand that database data is your most sensitive asset. Data Explorer commits to:'}
                    </Prose>
                    <div className="grid md:grid-cols-2 gap-8 mt-6">
                        <div className="flex gap-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg h-fit"><ShieldCheck className="w-4 h-4 text-emerald-500" /></div>
                            <div>
                                <h5 className="font-bold text-xs">{t ? 'Cô lập API Key' : 'API Key Isolation'}</h5>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                                    {t ? 'Khóa Gemini API của bạn được lưu an toàn tại backend (.env). Trình duyệt của client không bao giờ có quyền truy cập.' : 'Your Gemini API Key is stored safely on the backend (.env). Client browsers never have access.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="p-2 bg-emerald-500/10 rounded-lg h-fit"><MessageSquare className="w-4 h-4 text-emerald-500" /></div>
                            <div>
                                <h5 className="font-bold text-xs">{t ? 'Không huấn luyện' : 'No Data Training'}</h5>
                                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                                    {t ? 'Các yêu cầu qua API thương mại của Gemini không được dùng để huấn luyện mô hình công cộng của Google.' : 'Requests via Gemini commercial APIs are not used to train Google\'s public models.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}

