import { Shield, Lock, ShieldCheck } from 'lucide-react';
import { DocPageLayout, DocSection, Prose, InfoCard, FeatureGrid } from '../primitives';

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
                <InfoCard icon={<Shield className="w-6 h-6 text-emerald-500" />} title={t ? 'Kiến trúc Multi-Tier Riêng Tư' : 'Private Multi-Tier Architecture'} color="emerald">
                    <p>{t
                        ? 'Backend kết nối trực tiếp với Database của bạn một cách an toàn. Thông tin cấu hình hệ thống (như Database Connection của bạn) giờ đây được lưu trên một Cluster PostgreSQL trung tâm có độ tin cậy cao, đảm bảo không bao giờ có nguy cơ mất kết nối do xóa bộ nhớ trình duyệt hoặc deploy lại server.'
                        : 'Backend securely connects directly to your databases. Application configuration data (like your Saved Connections) is now persistently stored on a reliable central PostgreSQL cluster, guaranteeing zero risk of data loss on browser cache clears or server redeployments.'}</p>
                </InfoCard>
                <InfoCard icon={<Lock className="w-6 h-6 text-blue-500" />} title={t ? 'Mã hóa AES-256-GCM' : 'AES-256-GCM Encryption'} color="blue">
                    <p>{t
                        ? 'Toàn bộ mật khẩu DB của bạn đều được mã hóa bằng thuật toán cấp ngân hàng AES-256-GCM trước khi lưu xuống PostgreSQL. Thuật toán này sử dụng IV ngẫu nhiên và Auth Tag chặn tuyệt đối hacker chỉnh sửa CipherText, đảm bảo an toàn tuyệt đối ngay cả khi Database rò rỉ.'
                        : 'All user database passwords are encrypted using military-grade AES-256-GCM before writing to PostgreSQL. This leverages random IVs and Auth Tags to tamper-proof the CipherText, guaranteeing absolute safety even if the persistent database is breached.'}</p>
                </InfoCard>
            </FeatureGrid>

            {/* Deep Dive Encryption */}
            <DocSection title={t ? 'Chi tiết về Mã hóa AES-256-GCM' : 'AES-256-GCM Deep Dive'}>
                <Prose>
                    {t
                        ? 'Khác với chế độ CBC truyền thống, GCM (Galois/Counter Mode) cung cấp cả tính bảo mật (Confidentiality) và tính xác thực (Authenticity). Nó tạo ra một "Authentication Tag" đi kèm với dữ liệu mã hóa để đảm bảo rằng mật khẩu không bị thay đổi bởi bên thứ ba trong quá trình lưu trữ.'
                        : 'Unlike traditional CBC mode, GCM (Galois/Counter Mode) provides both confidentiality and authenticity. It generates an "Authentication Tag" alongside the encrypted data to ensure that passwords haven\'t been tampered with by a third party during storage.'}
                </Prose>
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                        <span className="block text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">IV (Initialization Vector)</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t ? 'Mỗi mật khẩu được mã hóa với một IV 12-byte duy nhất thu được từ nguồn ngẫu nhiên cực mạnh của hệ thống. Điều này đảm bảo rằng cùng một mật khẩu nếu mã hóa hai lần sẽ ra hai chuỗi CipherText hoàn toàn khác nhau.' : 'Each password is encrypted with a unique 12-byte IV obtained from the system\'s cryptographically strong random source. This ensures that the same password encrypted twice will result in two completely different CipherText strings.'}
                        </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                        <span className="block text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">AAD & Tag</span>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t ? 'Chúng tôi sử dụng Additional Authenticated Data để ràng buộc metadata với CipherText. Authentication Tag 16-byte được kiểm tra trong mỗi lần giải mã để đảm bảo tính toàn vẹn tuyệt đối.' : 'We use Additional Authenticated Data to bind metadata to the CipherText. A 16-byte Authentication Tag is verified during each decryption to ensure absolute integrity.'}
                        </p>
                    </div>
                </div>
            </DocSection>

            {/* JWT Auth */}
            <DocSection title={t ? 'Xác thực & Phiên làm việc (Session)' : 'Auth & Session Management'}>
                <Prose>{t
                    ? 'Hệ thống sử dụng cơ chế JWT (JSON Web Token) kết hợp với HttpOnly Cookie để bảo vệ người dùng khỏi các cuộc tấn công phổ biến như XSS và Session Hijacking.'
                    : 'The system utilizes JWT (JSON Web Token) combined with HttpOnly Cookies to protect users from common attacks like XSS and Session Hijacking.'}</Prose>

                <ul className="mt-6 space-y-4">
                    {[
                        {
                            label: 'HttpOnly Cookies',
                            desc: t ? 'Token không thể bị truy cập thông qua JavaScript (document.cookie), ngăn chặn đánh cắp session từ các script độc hại.' : 'Tokens cannot be accessed via JavaScript (document.cookie), preventing session theft from malicious scripts.'
                        },
                        {
                            label: 'Stateless Auth',
                            desc: t ? 'Server không lưu trữ session trong RAM, cho phép hệ thống mở rộng ngang dễ dàng khi có nhiều người dùng đồng thời.' : 'The server doesn\'t store sessions in RAM, allowing easy horizontal scaling as concurrent user count grows.'
                        },
                        {
                            label: 'Automatic Invalidation',
                            desc: t ? 'Mỗi token có thời hạn (TTL) và sẽ tự động bị vô hiệu hóa nếu server restart mà không cấu hình JWT_SECRET cố định.' : 'Each token has a Time-To-Live (TTL) and will be automatically invalidated if the server restarts without a fixed JWT_SECRET.'
                        }
                    ].map((item, i) => (
                        <li key={i} className="flex gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                                <h5 className="font-bold text-xs mb-1">{item.label}</h5>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </DocSection>

            {/* AI Privacy Table */}
            <DocSection title={t ? 'Quyền riêng tư AI' : 'AI Privacy'}>
                <Prose>{t
                    ? 'Dưới đây là bảng phân tích chi tiết các loại dữ liệu được trao đổi khi bạn sử dụng trợ lý AI Gemini:'
                    : 'Here is a detailed breakdown of the data types exchanged when using the Gemini AI assistant:'}</Prose>

                <div className="mt-6 border rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="text-left p-4 font-bold">{t ? 'Thông tin' : 'Information'}</th>
                                <th className="text-center p-4 font-bold">{t ? 'Gửi tới AI?' : 'Sent to AI?'}</th>
                                <th className="text-left p-4 font-bold">{t ? 'Mục đích' : 'Purpose'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {[
                                { info: t ? 'Tên bảng & Kiểu dữ liệu' : 'Table names & Types', sent: '✅', reason: t ? 'Để AI hiểu cấu trúc DB và sinh truy vấn đúng' : 'To help AI understand DB structure and generate correct queries' },
                                { info: t ? 'Quan hệ Foreign Key' : 'FK relationships', sent: '✅', reason: t ? 'Để AI thực hiện các lệnh JOIN chính xác' : 'To help AI perform accurate JOIN operations' },
                                { info: t ? 'Dữ liệu thực tế' : 'Actual row data', sent: '❌', reason: t ? 'DataExplorer không bao giờ gửi dữ liệu khách hàng lên cloud' : 'DataExplorer never sends customer data to the cloud' },
                                { info: t ? 'Mật khẩu & Connection string' : 'Passwords & Connections', sent: '❌', reason: t ? 'Thông tin nhạy cảm luôn được giữ kín tuyệt đối' : 'Sensitive credentials always kept strictly private' },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-muted/15 transition-colors">
                                    <td className="p-4 font-medium">{row.info}</td>
                                    <td className="p-4 text-center text-lg">{row.sent}</td>
                                    <td className="p-4 text-muted-foreground leading-relaxed">{row.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </DocSection>

            {/* Best Practices */}
            <DocSection title={t ? 'Thực hành Bảo mật Khuyến nghị' : 'Security Best Practices'}>
                <div className="grid gap-4">
                    {[
                        t ? 'Sử dụng biến JWT_SECRET có độ dài ít nhất 32 ký tự ngẫu nhiên trong môi trường Production.' : 'Use a JWT_SECRET with at least 32 random characters in Production environments.',
                        t ? 'Luôn bật SSL/TLS cho kết nối database nếu truy cập qua mạng công cộng.' : 'Always enable SSL/TLS for database connections if accessing over public networks.',
                        t ? 'Cấu hình ENCRYPTION_KEY cố định và lưu trữ an toàn để đảm bảo mật khẩu luôn giải mã được.' : 'Configure a fixed ENCRYPTION_KEY and store it securely to ensure passwords can always be decrypted.',
                        t ? 'Giới hạn quyền của user database (Principle of Least Privilege) chỉ bao gồm các quyền cần thiết.' : 'Limit database user permissions (Principle of Least Privilege) to only what is necessary.'
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-4 border rounded-xl bg-emerald-500/5 border-emerald-500/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs text-muted-foreground font-medium">{item}</span>
                        </div>
                    ))}
                </div>
            </DocSection>
        </DocPageLayout>
    );
}
