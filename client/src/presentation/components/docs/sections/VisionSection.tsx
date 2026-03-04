import { Eye } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { DocPageLayout, DocSection, Prose, Callout } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function VisionSection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Tích hợp Gemini Vision' : 'Gemini Vision Integration'}
            subtitle={t
                ? 'Chuyển đổi sơ đồ vẽ tay trên bảng trắng hoặc ảnh chụp màn hình thành bảng dữ liệu SQL thực thi trong tích tắc.'
                : 'Convert hand-drawn diagrams on a whiteboard or screenshots into executable SQL table definitions in an instant.'}
        >
            {/* Hero Visual */}
            <div className="relative group rounded-[32px] overflow-hidden border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all bg-card/50">
                <div className="absolute inset-0 bg-primary/5 transition-colors group-hover:bg-primary/10" />
                <div className="p-16 flex flex-col items-center text-center space-y-6">
                    <div className="bg-background p-6 rounded-[24px] shadow-2xl border border-primary/10">
                        <Eye className="w-16 h-16 text-primary animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold italic tracking-tighter">Image-to-Schema</h3>
                        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{t
                            ? 'Chỉ cần kéo và thả hình ảnh sơ đồ ER, ảnh chụp bảng trắng, hoặc thậm chí screenshot ứng dụng vào khung chat AI — Gemini Vision sẽ phân tích và tạo ra CREATE TABLE statements tương ứng.'
                            : 'Simply drag and drop ER diagram images, whiteboard photos, or even app screenshots into the AI chat frame — Gemini Vision will analyze and generate corresponding CREATE TABLE statements.'}</p>
                    </div>
                </div>
            </div>

            {/* Step-by-step Workflow */}
            <DocSection title={t ? 'Quy trình từng bước' : 'Step-by-Step Workflow'}>
                <div className="space-y-4">
                    {[
                        { step: '1', title: t ? 'Mở AI Chat Panel' : 'Open AI Chat Panel', desc: t ? 'Nhấn Ctrl+I hoặc click biểu tượng Sparkles (✨) trên thanh toolbar để mở panel AI Assistant bên phải màn hình.' : 'Press Ctrl+I or click the Sparkles icon (✨) on the toolbar to open the AI Assistant panel on the right side.' },
                        { step: '2', title: t ? 'Kéo thả hình ảnh' : 'Drag & Drop Image', desc: t ? 'Kéo file hình ảnh (PNG, JPG, WEBP) trực tiếp vào khung chat. Hoặc click vào biểu tượng đính kèm (📎) để chọn file từ máy. Hình ảnh sẽ hiển thị preview trong khung chat.' : 'Drag an image file (PNG, JPG, WEBP) directly into the chat frame. Or click the attachment icon (📎) to select a file. The image will show a preview in the chat.' },
                        { step: '3', title: t ? 'Viết mô tả (tùy chọn)' : 'Add Description (Optional)', desc: t ? 'Bạn có thể thêm mô tả bổ sung: "Tạo schema PostgreSQL từ sơ đồ này với kiểu UUID cho primary key" hoặc "Sử dụng naming convention snake_case". Nếu không ghi gì, AI sẽ tự suy luận từ hình ảnh.' : 'You can add additional description: "Create PostgreSQL schema from this diagram with UUID primary keys" or "Use snake_case naming convention". If blank, AI will infer from the image.' },
                        { step: '4', title: t ? 'Nhận kết quả SQL' : 'Receive SQL Result', desc: t ? 'AI phân tích hình ảnh, nhận diện các bảng, cột, kiểu dữ liệu và mối quan hệ, rồi tạo ra CREATE TABLE statements hoàn chỉnh với foreign keys. SQL được stream trực tiếp vào chat.' : 'AI analyzes the image, identifies tables, columns, data types, and relationships, then generates complete CREATE TABLE statements with foreign keys. SQL is streamed directly into the chat.' },
                        { step: '5', title: t ? 'Copy hoặc Insert vào Editor' : 'Copy or Insert into Editor', desc: t ? 'Click nút "Copy" để sao chép SQL vào clipboard, hoặc click "Insert to Editor" để chèn trực tiếp vào tab SQL đang mở. Sau đó bạn có thể chỉnh sửa và thực thi.' : 'Click "Copy" to copy SQL to clipboard, or "Insert to Editor" to insert directly into the open SQL tab. You can then edit and execute.' },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start p-5 border rounded-2xl bg-muted/10">
                            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">{item.step}</div>
                            <div className="space-y-1">
                                <span className="font-bold block">{item.title}</span>
                                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Supported Input Types */}
            <DocSection title={t ? 'Loại hình ảnh được hỗ trợ' : 'Supported Image Types'}>
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { type: t ? 'Sơ đồ vẽ tay' : 'Hand-drawn Diagrams', desc: t ? 'Ảnh chụp bảng trắng, giấy note, hoặc tablet drawings' : 'Whiteboard photos, paper notes, or tablet drawings', icon: '✏️' },
                        { type: t ? 'Sơ đồ ER chuyên nghiệp' : 'Professional ER Diagrams', desc: t ? 'Export từ Lucidchart, draw.io, dbdiagram.io' : 'Exports from Lucidchart, draw.io, dbdiagram.io', icon: '📐' },
                        { type: t ? 'Screenshot ứng dụng' : 'App Screenshots', desc: t ? 'Chụp form UI để suy luận cấu trúc dữ liệu cần lưu' : 'UI form screenshots to infer data structures', icon: '📸' },
                    ].map((item, i) => (
                        <div key={i} className="text-center p-6 border rounded-2xl bg-card space-y-3 hover:border-primary/50 transition-colors">
                            <span className="text-3xl block">{item.icon}</span>
                            <span className="font-bold text-sm block">{item.type}</span>
                            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            {/* Tips */}
            <Callout type="tip">
                <p className="font-bold">{t ? '💡 Mẹo để tăng độ chính xác' : '💡 Tips for Better Accuracy'}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-4">
                    <li>{t ? 'Hình ảnh rõ nét, đủ ánh sáng sẽ cho kết quả tốt hơn' : 'Clear, well-lit images produce better results'}</li>
                    <li>{t ? 'Ghi rõ tên bảng và cột trong sơ đồ — AI đọc text trong hình' : 'Write table and column names clearly in diagrams — AI reads text from images'}</li>
                    <li>{t ? 'Vẽ mũi tên cho foreign keys giúp AI nhận diện mối quan hệ chính xác hơn' : 'Draw arrows for foreign keys to help AI identify relationships more accurately'}</li>
                    <li>{t ? 'Thêm ghi chú "(PK)", "(FK)", "(NOT NULL)" bên cạnh tên cột' : 'Add notes "(PK)", "(FK)", "(NOT NULL)" next to column names'}</li>
                    <li>{t ? 'Dùng prompt bổ sung để chỉ định dialect: "Generate for PostgreSQL" hoặc "Use MySQL syntax"' : 'Use supplemental prompts to specify dialect: "Generate for PostgreSQL" or "Use MySQL syntax"'}</li>
                </ul>
            </Callout>
        </DocPageLayout>
    );
}
