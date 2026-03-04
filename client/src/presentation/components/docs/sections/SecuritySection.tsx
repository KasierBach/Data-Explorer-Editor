import { Shield, Lock, Eye } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, CodeBlock, CodeComment, CodeLine, Callout, InfoCard, FeatureGrid } from '../primitives';

interface Props { lang: 'vi' | 'en'; }

export function SecuritySection({ lang }: Props) {
    const t = lang === 'vi';
    return (
        <DocPageLayout
            title={t ? 'Bảo mật & Quyền riêng tư' : 'Security & Privacy'}
            subtitle={t
                ? 'Data Explorer được thiết kế với triết lý "Security by Default" — mọi dữ liệu nhạy cảm đều được bảo vệ ở cấp độ cao nhất.'
                : 'Data Explorer is designed with "Security by Default" philosophy — all sensitive data is protected at the highest level.'}
        >
            {/* Core Security Features */}
            <FeatureGrid>
                <InfoCard icon={<Shield className="w-6 h-6 text-emerald-500" />} title={t ? 'Kiến trúc Local-First' : 'Local-First Architecture'} color="emerald">
                    <p>{t
                        ? 'Mọi thông tin kết nối database (host, port, username, password) chỉ được lưu trữ trên server của bạn — không bao giờ gửi lên cloud hoặc bên thứ ba. Backend NestJS chạy ngay trên máy bạn hoặc server nội bộ, đảm bảo dữ liệu nhạy cảm không bao giờ rời khỏi mạng nội bộ.'
                        : 'All database connection info (host, port, username, password) is stored only on your server — never sent to cloud or third parties. The NestJS backend runs on your machine or internal server, ensuring sensitive data never leaves your internal network.'}</p>
                </InfoCard>
                <InfoCard icon={<Lock className="w-6 h-6 text-blue-500" />} title={t ? 'Mã hóa AES-256' : 'AES-256 Encryption'} color="blue">
                    <p>{t
                        ? 'Mật khẩu database được mã hóa bằng thuật toán AES-256-CBC trước khi lưu vào SQLite nội bộ. Chỉ backend server với secret key mới có thể giải mã. Kể cả khi file SQLite bị truy cập trái phép, mật khẩu vẫn ở dạng mã hóa và không thể đọc được.'
                        : 'Database passwords are encrypted using AES-256-CBC before storing in internal SQLite. Only the backend server with the secret key can decrypt. Even if the SQLite file is accessed unauthorized, passwords remain encrypted and unreadable.'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* JWT Auth */}
            <DocSection title={t ? 'Xác thực JWT (JSON Web Token)' : 'JWT Authentication'}>
                <Prose>{t
                    ? 'Data Explorer sử dụng JWT cho xác thực người dùng. Khi đăng nhập thành công, server tạo một JWT access token được gửi qua HttpOnly cookie — ngăn chặn tấn công XSS (Cross-Site Scripting) vì JavaScript không thể truy cập cookie này.'
                    : 'Data Explorer uses JWT for user authentication. On successful login, the server creates a JWT access token sent via HttpOnly cookie — preventing XSS (Cross-Site Scripting) attacks since JavaScript cannot access this cookie.'}</Prose>
                <CodeBlock title={t ? 'Luồng xác thực' : 'Auth Flow'}>
                    <CodeComment>{t ? 'Bước 1: Đăng nhập (POST /auth/login)' : 'Step 1: Login (POST /auth/login)'}</CodeComment>
                    <CodeLine>{'POST /auth/login { email, password }'}</CodeLine>
                    <CodeLine>{'  → Server xác thực → Tạo JWT → Set HttpOnly Cookie'}</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Bước 2: Mọi request tiếp theo' : 'Step 2: All subsequent requests'}</CodeComment>
                    <CodeLine>{'GET /api/connections (Cookie tự động gửi kèm)'}</CodeLine>
                    <CodeLine>{'  → JWT Guard verify token → Cho phép / Từ chối'}</CodeLine>
                    <p className="mt-3" />
                    <CodeComment>{t ? 'Bước 3: Token hết hạn' : 'Step 3: Token expired'}</CodeComment>
                    <CodeLine>{'  → Server trả 401 → Frontend redirect sang /login'}</CodeLine>
                </CodeBlock>
            </DocSection>

            {/* AI Privacy */}
            <DocSection title={t ? 'Quyền riêng tư AI' : 'AI Privacy'}>
                <Prose>{t
                    ? 'Khi sử dụng tính năng AI (tạo SQL, giải thích truy vấn), chỉ metadata lược đồ được gửi tới Google Gemini API — không bao giờ gửi dữ liệu thực tế trong database. Metadata được ẩn danh hóa ở mức tối thiểu cần thiết.'
                    : 'When using AI features (SQL generation, query explanation), only schema metadata is sent to Google Gemini API — never actual data in the database. Metadata is anonymized to the minimum necessary level.'}</Prose>

                <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Thông tin' : 'Information'}</th>
                                <th className="text-center p-4 font-bold">{t ? 'Gửi tới AI?' : 'Sent to AI?'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Lý do' : 'Reason'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { info: t ? 'Tên bảng' : 'Table names', sent: '✅', reason: t ? 'Cần để tạo SQL chính xác' : 'Needed for accurate SQL generation' },
                                { info: t ? 'Tên cột + kiểu dữ liệu' : 'Column names + types', sent: '✅', reason: t ? 'Cần để tham chiếu cột' : 'Needed for column references' },
                                { info: t ? 'Quan hệ Foreign Key' : 'FK relationships', sent: '✅', reason: t ? 'Cần để tạo JOIN chính xác' : 'Needed for accurate JOINs' },
                                { info: t ? 'Dữ liệu thực trong bảng' : 'Actual table data', sent: '❌', reason: t ? 'Không bao giờ gửi — bảo mật tuyệt đối' : 'Never sent — absolute security' },
                                { info: t ? 'Mật khẩu DB' : 'DB passwords', sent: '❌', reason: t ? 'Không bao giờ gửi' : 'Never sent' },
                                { info: t ? 'Connection strings' : 'Connection strings', sent: '❌', reason: t ? 'Không bao giờ gửi' : 'Never sent' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 font-medium">{row.info}</td>
                                    <td className="p-4 text-center text-lg">{row.sent}</td>
                                    <td className="p-4 text-muted-foreground">{row.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Best Practices */}
            <DocSection title={t ? 'Thực hành bảo mật khuyến nghị' : 'Security Best Practices'}>
                <ul className="space-y-3">
                    {[
                        t ? 'Đặt JWT_SECRET dài ≥ 32 ký tự ngẫu nhiên. Sử dụng công cụ tạo mật khẩu an toàn (openssl rand -hex 32).' : 'Set JWT_SECRET to ≥ 32 random characters. Use secure password generators (openssl rand -hex 32).',
                        t ? 'Sử dụng SSL/TLS cho mọi kết nối database, đặc biệt khi truy cập qua mạng công cộng hoặc cloud.' : 'Use SSL/TLS for all database connections, especially when accessing over public networks or cloud.',
                        t ? 'Không commit file .env lên repository. Đảm bảo .env nằm trong .gitignore.' : 'Never commit .env files to repository. Ensure .env is in .gitignore.',
                        t ? 'Định kỳ rotate JWT_SECRET và GEMINI_API_KEY. Hủy API key cũ khi không còn sử dụng.' : 'Periodically rotate JWT_SECRET and GEMINI_API_KEY. Revoke old API keys when no longer in use.',
                        t ? 'Chạy backend trên mạng nội bộ (private network) thay vì expose trực tiếp ra internet.' : 'Run backend on a private network instead of exposing directly to the internet.',
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3 p-4 border rounded-xl bg-muted/20">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                            <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                        </li>
                    ))}
                </ul>
            </DocSection>
        </DocPageLayout>
    );
}
