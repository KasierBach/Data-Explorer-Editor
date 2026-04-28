export class MailTemplates {
    /**
     * Builds a consistent HTML email wrapper with Data Explorer branding.
     * Uses a modern, high-contrast Deep Slate theme.
     */
    private static wrap(title: string, bodyContent: string): string {
        const year = new Date().getFullYear();
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            <style>
                @media only screen and (max-width: 600px) {
                    .container { width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
                    .content { padding: 24px !important; }
                }
            </style>
        </head>
        <body style="margin:0;padding:20px;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
            <table class="container" width="520" align="center" border="0" cellpadding="0" cellspacing="0" style="margin:40px auto;background-color:#0f172a;border-radius:24px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);">
                <!-- Header -->
                <tr>
                    <td style="padding:40px 40px 20px;text-align:center;">
                        <div style="display:inline-block;padding:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;margin-bottom:16px;">
                            <span style="font-size:24px;">🛢️</span>
                        </div>
                        <h1 style="margin:0;color:#f8fafc;font-size:24px;font-weight:800;letter-spacing:-0.025em;">Data Explorer</h1>
                    </td>
                </tr>
                <!-- Body -->
                <tr>
                    <td class="content" style="padding:0 48px 40px;">
                        <div style="height:1px;background:linear-gradient(90deg,transparent,#334155,transparent);margin-bottom:32px;"></div>
                        <h2 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:0 0 20px;letter-spacing:-0.01em;">${title}</h2>
                        <div style="color:#94a3b8;font-size:15px;line-height:1.7;">
                            ${bodyContent}
                        </div>
                    </td>
                </tr>
                <!-- Footer -->
                <tr>
                    <td style="padding:24px;background-color:#020617;text-align:center;border-top:1px solid #1e293b;">
                        <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
                            Data Explorer v3.3 • Premium Module
                        </p>
                        <p style="margin:0;color:#334155;font-size:11px;">
                            © ${year} KasierBach. All rights reserved.<br/>
                            Bạn nhận được email này vì đã đăng ký sử dụng dịch vụ của chúng tôi.
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>`;
    }

    static getVerificationEmail(name: string, otp: string): string {
        const bodyContent = `
            <p style="margin-bottom:24px;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>
                Chào mừng bạn đến với <strong>Data Explorer</strong>! Tuyệt vời khi có bạn đồng hành. Vui lòng sử dụng mã PIN bên dưới để hoàn tất việc xác minh tài khoản của mình:
            </p>
            <div style="margin:32px 0;text-align:center;">
                <div style="display:inline-block;padding:2px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:16px;">
                    <div style="background:#0f172a;padding:24px 48px;border-radius:14px;">
                        <span style="color:#f1f5f9;font-size:40px;font-weight:900;letter-spacing:12px;margin-right:-12px;font-family:'Courier New',Courier,monospace;">${otp}</span>
                    </div>
                </div>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#f59e0b;font-size:13px;font-weight:500;text-align:center;">
                ⏱️ Mã này sẽ hết hạn sau <strong style="color:#fbbf24;">15 phút</strong> vì lý do bảo mật.
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email. Tài khoản sẽ không được kích hoạt nếu không có mã xác minh.
            </p>`;
        return this.wrap('Xác nhận đăng ký tài khoản', bodyContent);
    }

    static getPasswordResetEmail(name: string, otp: string): string {
        const bodyContent = `
            <p style="margin-bottom:24px;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Để tiếp tục, vui lòng sử dụng mã xác nhận bên dưới:
            </p>
            <div style="margin:32px 0;text-align:center;">
                <div style="display:inline-block;padding:2px;background:linear-gradient(135deg,#3b82f6,#2dd4bf);border-radius:16px;">
                    <div style="background:#0f172a;padding:24px 48px;border-radius:14px;">
                        <span style="color:#f1f5f9;font-size:40px;font-weight:900;letter-spacing:12px;margin-right:-12px;font-family:'Courier New',Courier,monospace;">${otp}</span>
                    </div>
                </div>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#f59e0b;font-size:13px;font-weight:500;text-align:center;">
                ⏱️ Mã này chỉ có hiệu lực trong vòng <strong style="color:#fbbf24;">5 phút</strong>.
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, đừng lo lắng, tài khoản của bạn vẫn an toàn. Hãy đổi mật khẩu nếu bạn cảm thấy có dấu hiệu lạ.
            </p>`;
        return this.wrap('Yêu cầu đặt lại mật khẩu', bodyContent);
    }

    static getSecurityAlertEmail(name: string, ip: string, time: string): string {
        const bodyContent = `
            <p style="margin-bottom:24px;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>
                Hệ thống phát hiện một lượt đăng nhập mới vào tài khoản của bạn từ một thiết bị hoặc địa chỉ IP chưa từng được sử dụng trước đây.
            </p>
            <div style="background-color:#020617;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="color:#64748b;font-size:14px;padding-bottom:12px;">📍 Địa chỉ IP</td>
                        <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;padding-bottom:12px;">${ip}</td>
                    </tr>
                    <tr>
                        <td style="height:1px;background-color:#1e293b;" colspan="2"></td>
                    </tr>
                    <tr>
                        <td style="color:#64748b;font-size:14px;padding-top:12px;">🕐 Thời gian</td>
                        <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;padding-top:12px;">${time}</td>
                    </tr>
                </table>
            </div>
            <div style="padding:16px;background-color:#450a0a;border:1px solid #7f1d1d;border-radius:12px;margin-bottom:20px;">
                <p style="margin:0;color:#fecaca;font-size:13px;line-height:1.5;">
                    ⚠️ <strong>Cảnh báo quan trọng:</strong> Nếu đây KHÔNG phải là hoạt động của bạn, hãy <a href="#" style="color:#f87171;text-decoration:underline;font-weight:700;">đổi mật khẩu ngay lập tức</a> để bảo vệ dữ liệu.
                </p>
            </div>
            <p style="font-size:13px;color:#64748b;">
                Nếu hành động này là của bạn, bạn hoàn toàn có thể bỏ qua email này.
            </p>`;
        return this.wrap('Cảnh báo bảo mật hệ thống', bodyContent);
    }

    static getTeamInvitationEmail(teamName: string, inviterName: string, role: string, loginUrl: string): string {
        const bodyContent = `
            <p style="margin-bottom:24px;">
                Xin chào,
            </p>
            <p>
                <strong style="color:#f1f5f9;">${inviterName}</strong> đã mời bạn tham gia team
                <strong style="color:#f1f5f9;">${teamName}</strong> với vai trò <strong style="color:#f1f5f9;">${role}</strong>.
            </p>
            <div style="margin:32px 0;text-align:center;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:14px;color:#fff;text-decoration:none;font-weight:800;">
                    Mở Data Explorer
                </a>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#cbd5e1;font-size:13px;line-height:1.6;">
                Nếu bạn đã có tài khoản với email này, chỉ cần đăng nhập là team sẽ xuất hiện tự động.
                Nếu chưa có tài khoản, hãy đăng ký bằng đúng email này để được thêm vào team sau khi đăng nhập.
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                Nếu bạn không mong đợi email này, có thể bỏ qua.
            </p>`;
        return this.wrap('Lời mời tham gia team', bodyContent);
    }
}
