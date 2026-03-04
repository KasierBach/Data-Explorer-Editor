import { Cpu, Eye } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function SqlGenerationSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Tạo mã SQL bằng AI' : 'AI SQL Generation'}
            subtitle={t
                ? 'Data Explorer tích hợp Google Gemini để chuyển đổi ngôn ngữ tự nhiên thành truy vấn SQL tối ưu, dựa trên ngữ cảnh thực tế của database.'
                : 'Data Explorer integrates Google Gemini to convert natural language into optimized SQL queries, based on the actual context of your database.'}
            gradient
        >
            {/* How It Works */}
            <DocSection title={t ? 'Kỹ thuật Độ chính xác cao' : 'High-Precision Engineering'}>
                <Prose>{t
                    ? 'Khác với các công cụ AI SQL thông thường chỉ dựa vào prompt của người dùng, Data Explorer thực hiện một quy trình 3 bước để đảm bảo SQL được tạo ra luôn chính xác và tối ưu:'
                    : 'Unlike typical AI SQL tools that rely solely on user prompts, Data Explorer performs a 3-step process to ensure generated SQL is always accurate and optimized:'}</Prose>
                <div className="space-y-6">
                    {[
                        {
                            step: '01', title: t ? 'Phân tích Lược đồ sâu' : 'Deep Schema Analysis',
                            desc: t
                                ? 'Khi bạn gửi yêu cầu AI, hệ thống tự động trích xuất metadata từ database: danh sách bảng, tên cột, kiểu dữ liệu, ràng buộc khóa ngoại (foreign keys), và thậm cả check constraints. Thông tin này được nén thành định dạng token-efficient trước khi gửi đến Gemini.'
                                : 'When you send an AI request, the system automatically extracts metadata from the database: table list, column names, data types, foreign key constraints, and even check constraints. This information is compressed into a token-efficient format before sending to Gemini.'
                        },
                        {
                            step: '02', title: t ? 'Contextual Prompting' : 'Contextual Prompting',
                            desc: t
                                ? 'Metadata thu gọn được đưa vào system prompt cùng với hướng dẫn về SQL dialect cụ thể (PostgreSQL, MySQL, etc.). Nhờ vậy, AI không bao giờ "ảo tưởng" (hallucinate) về tên bảng hoặc cột không tồn tại. Nó biết chính xác bạn có những gì trong database.'
                                : 'Condensed metadata is injected into the system prompt along with specific SQL dialect instructions (PostgreSQL, MySQL, etc.). This ensures the AI never "hallucinates" non-existent table or column names. It knows exactly what\'s in your database.'
                        },
                        {
                            step: '03', title: 'SSE Streaming',
                            desc: t
                                ? 'SQL được tạo ra hiển thị ngay lập tức trong Monaco Editor theo phong cách "typing" — như thể bạn đang xem AI gõ trực tiếp. Kỹ thuật Server-Sent Events (SSE) được sử dụng để truyền từng token, giúp bạn thấy kết quả trong vài trăm milliseconds thay vì phải đợi toàn bộ response.'
                                : 'Generated SQL appears instantly in the Monaco Editor in a "typing" style — as if watching the AI type live. Server-Sent Events (SSE) technique is used to stream each token, letting you see results within a few hundred milliseconds instead of waiting for the complete response.'
                        },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-6 items-start p-6 border rounded-2xl bg-muted/10">
                            <div className="bg-primary/20 p-3 rounded-2xl text-primary font-bold text-sm shrink-0">{item.step}</div>
                            <div className="space-y-2">
                                <span className="text-foreground font-bold text-lg block">{item.title}</span>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Prompt Examples */}
            <DocSection title={t ? 'Ví dụ Prompt hiệu quả' : 'Effective Prompt Examples'}>
                <Prose>{t
                    ? 'Dưới đây là một số ví dụ về cách viết prompt để nhận được SQL chất lượng cao nhất từ AI:'
                    : 'Here are examples of how to write prompts to get the highest quality SQL from AI:'}</Prose>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h4 className="font-bold text-sm text-emerald-600 uppercase tracking-widest">{t ? '✅ Prompt tốt' : '✅ Good Prompts'}</h4>
                        <CodeBlock title={t ? 'Ví dụ 1: Truy vấn phân tích' : 'Example 1: Analytical Query'}>
                            <CodeComment>{t ? 'Prompt: "Liệt kê top 10 khách hàng chi tiêu nhiều nhất trong Q4 2024, kèm số đơn hàng và tổng doanh thu"' : 'Prompt: "List top 10 customers by spending in Q4 2024, with order count and total revenue"'}</CodeComment>
                            <p className="mt-3" />
                            <CodeLine>{'SELECT'}</CodeLine>
                            <CodeLine>{'  u.name AS customer_name,'}</CodeLine>
                            <CodeLine>{'  COUNT(o.id) AS total_orders,'}</CodeLine>
                            <CodeLine>{'  SUM(o.total_amount) AS total_revenue'}</CodeLine>
                            <CodeLine>{'FROM public.users u'}</CodeLine>
                            <CodeLine>{'JOIN public.orders o ON u.id = o.user_id'}</CodeLine>
                            <CodeLine>{"WHERE o.status = 'completed'"}</CodeLine>
                            <CodeLine>{"  AND o.created_at BETWEEN '2024-10-01' AND '2024-12-31'"}</CodeLine>
                            <CodeLine>{'GROUP BY u.id, u.name'}</CodeLine>
                            <CodeLine>{'ORDER BY total_revenue DESC'}</CodeLine>
                            <CodeLine>{'LIMIT 10;'}</CodeLine>
                        </CodeBlock>
                        <CodeBlock title={t ? 'Ví dụ 2: Tạo bảng' : 'Example 2: Create Table'}>
                            <CodeComment>{t ? 'Prompt: "Tạo bảng products với các trường: id (UUID), name, price (decimal), category, inventory count, và timestamps"' : 'Prompt: "Create products table with: id (UUID), name, price (decimal), category, inventory count, and timestamps"'}</CodeComment>
                            <p className="mt-3" />
                            <CodeLine>{'CREATE TABLE public.products ('}</CodeLine>
                            <CodeLine>{'  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),'}</CodeLine>
                            <CodeLine>{'  name VARCHAR(255) NOT NULL,'}</CodeLine>
                            <CodeLine>{'  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),'}</CodeLine>
                            <CodeLine>{'  category VARCHAR(100),'}</CodeLine>
                            <CodeLine>{'  inventory_count INTEGER NOT NULL DEFAULT 0,'}</CodeLine>
                            <CodeLine>{'  created_at TIMESTAMPTZ DEFAULT NOW(),'}</CodeLine>
                            <CodeLine>{'  updated_at TIMESTAMPTZ DEFAULT NOW()'}</CodeLine>
                            <CodeLine>{');'}</CodeLine>
                        </CodeBlock>
                    </div>

                    <Callout type="tip">
                        <p className="font-bold">{t ? '💡 Mẹo viết Prompt hiệu quả' : '💡 Tips for Effective Prompts'}</p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
                            <li>{t ? 'Luôn nêu rõ tên bảng nếu biết — AI sẽ match chính xác hơn' : 'Always mention table names if known — AI matches more accurately'}</li>
                            <li>{t ? 'Mô tả rõ điều kiện lọc (WHERE): khoảng thời gian, giá trị status, etc.' : 'Clearly describe filter conditions (WHERE): time ranges, status values, etc.'}</li>
                            <li>{t ? 'Chỉ rõ cần sắp xếp (ORDER BY) và giới hạn (LIMIT) nếu cần' : 'Specify sorting (ORDER BY) and limits (LIMIT) when needed'}</li>
                            <li>{t ? 'Với truy vấn phức tạp, mô tả theo từng bước logic' : 'For complex queries, describe step by step logically'}</li>
                        </ul>
                    </Callout>
                </div>
            </DocSection>

            {/* Model Info */}
            <DocSection title={t ? 'Model AI được sử dụng' : 'AI Model Used'}>
                <div className="p-6 border rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/20 rounded-xl"><Cpu className="w-6 h-6 text-blue-600" /></div>
                        <div>
                            <span className="font-bold block text-lg italic">Gemini-2.0-flash</span>
                            <span className="text-xs text-muted-foreground">{t
                                ? 'Model chính phục vụ việc tạo SQL tốc độ cao và cực kỳ chính xác.'
                                : 'Main model serving high-speed and extremely accurate SQL generation.'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-500/20 rounded-xl"><Eye className="w-6 h-6 text-purple-600" /></div>
                        <div>
                            <span className="font-bold block text-lg italic">Gemini 1.5 Pro Vision</span>
                            <span className="text-xs text-muted-foreground">{t
                                ? 'Phân tích hình ảnh sơ đồ vẽ tay để thiết kế database schema.'
                                : 'Analyze hand-drawn diagram images to design database schemas.'}</span>
                        </div>
                    </div>
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
