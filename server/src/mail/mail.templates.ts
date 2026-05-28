import { pickLocalizedText, type AppLanguage } from '../common/utils/i18n.util';

export class MailTemplates {
  private static wrap(
    title: string,
    bodyContent: string,
    lang: AppLanguage,
  ): string {
    const year = new Date().getFullYear();
    const footerTagline = pickLocalizedText(
      lang,
      'Data Explorer v3.3 • Premium Module',
      'Data Explorer v3.3 • Premium Module',
    );
    const footerNote = pickLocalizedText(
      lang,
      'Bạn nhận được email này vì đã đăng ký sử dụng dịch vụ của chúng tôi.',
      'You received this email because you signed up for our service.',
    );

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
                <tr>
                    <td style="padding:40px 40px 20px;text-align:center;">
                        <div style="display:inline-block;padding:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:12px;margin-bottom:16px;">
                            <span style="font-size:24px;">🛢️</span>
                        </div>
                        <h1 style="margin:0;color:#f8fafc;font-size:24px;font-weight:800;letter-spacing:-0.025em;">Data Explorer</h1>
                    </td>
                </tr>
                <tr>
                    <td class="content" style="padding:0 48px 40px;">
                        <div style="height:1px;background:linear-gradient(90deg,transparent,#334155,transparent);margin-bottom:32px;"></div>
                        <h2 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:0 0 20px;letter-spacing:-0.01em;">${title}</h2>
                        <div style="color:#94a3b8;font-size:15px;line-height:1.7;">
                            ${bodyContent}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="padding:24px;background-color:#020617;text-align:center;border-top:1px solid #1e293b;">
                        <p style="margin:0 0 8px;color:#475569;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">
                            ${footerTagline}
                        </p>
                        <p style="margin:0;color:#334155;font-size:11px;">
                            © ${year} KasierBach. All rights reserved.<br/>
                            ${footerNote}
                        </p>
                    </td>
                </tr>
            </table>
        </body>
        </html>`;
  }

  private static getRoleLabel(role: string, lang: AppLanguage): string {
    const normalizedRole = role.toUpperCase();
    switch (normalizedRole) {
      case 'ADMIN':
        return pickLocalizedText(lang, 'Quản trị', 'Admin');
      case 'MEMBER':
        return pickLocalizedText(lang, 'Thành viên', 'Member');
      case 'VIEWER':
        return pickLocalizedText(lang, 'Người xem', 'Viewer');
      default:
        return role;
    }
  }

  static getVerificationEmail(
    name: string,
    otp: string,
    lang: AppLanguage = 'vi',
  ): string {
    const title = pickLocalizedText(
      lang,
      'Xác nhận đăng ký tài khoản',
      'Verify your account',
    );
    const greeting = pickLocalizedText(lang, 'Xin chào', 'Hello');
    const intro = pickLocalizedText(
      lang,
      'Chào mừng bạn đến với <strong>Data Explorer</strong>. Vui lòng dùng mã PIN bên dưới để hoàn tất việc xác minh tài khoản:',
      'Welcome to <strong>Data Explorer</strong>. Please use the PIN below to finish verifying your account:',
    );
    const expiry = pickLocalizedText(
      lang,
      '⏱️ Mã này sẽ hết hạn sau <strong style="color:#fbbf24;">15 phút</strong> vì lý do bảo mật.',
      '⏱️ This code expires in <strong style="color:#fbbf24;">15 minutes</strong> for security reasons.',
    );
    const outro = pickLocalizedText(
      lang,
      'Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email. Tài khoản sẽ không được kích hoạt nếu không có mã xác minh.',
      'If you did not start this sign-up, you can ignore this email. The account will remain inactive without this code.',
    );

    const bodyContent = `
            <p style="margin-bottom:24px;">
                ${greeting} <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>${intro}</p>
            <div style="margin:32px 0;text-align:center;">
                <div style="display:inline-block;padding:2px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:16px;">
                    <div style="background:#0f172a;padding:24px 48px;border-radius:14px;">
                        <span style="color:#f1f5f9;font-size:40px;font-weight:900;letter-spacing:12px;margin-right:-12px;font-family:'Courier New',Courier,monospace;">${otp}</span>
                    </div>
                </div>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#f59e0b;font-size:13px;font-weight:500;text-align:center;">
                ${expiry}
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                ${outro}
            </p>`;

    return this.wrap(title, bodyContent, lang);
  }

  static getPasswordResetEmail(
    name: string,
    otp: string,
    lang: AppLanguage = 'vi',
  ): string {
    const title = pickLocalizedText(
      lang,
      'Yêu cầu đặt lại mật khẩu',
      'Reset your password',
    );
    const greeting = pickLocalizedText(lang, 'Xin chào', 'Hello');
    const intro = pickLocalizedText(
      lang,
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Hãy dùng mã xác nhận bên dưới để tiếp tục:',
      'We received a request to reset your password. Use the verification code below to continue:',
    );
    const expiry = pickLocalizedText(
      lang,
      '⏱️ Mã này chỉ có hiệu lực trong vòng <strong style="color:#fbbf24;">5 phút</strong>.',
      '⏱️ This code is valid for <strong style="color:#fbbf24;">5 minutes</strong>.',
    );
    const outro = pickLocalizedText(
      lang,
      'Nếu bạn không yêu cầu đặt lại mật khẩu, tài khoản của bạn vẫn an toàn. Hãy đổi mật khẩu nếu bạn nghi ngờ có hoạt động lạ.',
      'If you did not request a password reset, your account is still safe. Change your password if you notice suspicious activity.',
    );

    const bodyContent = `
            <p style="margin-bottom:24px;">
                ${greeting} <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>${intro}</p>
            <div style="margin:32px 0;text-align:center;">
                <div style="display:inline-block;padding:2px;background:linear-gradient(135deg,#3b82f6,#2dd4bf);border-radius:16px;">
                    <div style="background:#0f172a;padding:24px 48px;border-radius:14px;">
                        <span style="color:#f1f5f9;font-size:40px;font-weight:900;letter-spacing:12px;margin-right:-12px;font-family:'Courier New',Courier,monospace;">${otp}</span>
                    </div>
                </div>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#f59e0b;font-size:13px;font-weight:500;text-align:center;">
                ${expiry}
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                ${outro}
            </p>`;

    return this.wrap(title, bodyContent, lang);
  }

  static getSecurityAlertEmail(
    name: string,
    ip: string,
    time: string,
    lang: AppLanguage = 'vi',
  ): string {
    const title = pickLocalizedText(
      lang,
      'Cảnh báo bảo mật hệ thống',
      'Security alert',
    );
    const greeting = pickLocalizedText(lang, 'Xin chào', 'Hello');
    const intro = pickLocalizedText(
      lang,
      'Hệ thống phát hiện một lượt đăng nhập mới vào tài khoản của bạn từ thiết bị hoặc địa chỉ IP chưa từng được sử dụng trước đây.',
      'We detected a new login to your account from a device or IP address that has not been used before.',
    );
    const ipLabel = pickLocalizedText(lang, '📍 Địa chỉ IP', '📍 IP address');
    const timeLabel = pickLocalizedText(lang, '🕐 Thời gian', '🕐 Time');
    const warning = pickLocalizedText(
      lang,
      '⚠️ <strong>Cảnh báo quan trọng:</strong> Nếu đây KHÔNG phải là hoạt động của bạn, hãy đổi mật khẩu ngay lập tức để bảo vệ dữ liệu.',
      '⚠️ <strong>Important warning:</strong> If this was NOT you, change your password immediately to protect your data.',
    );
    const outro = pickLocalizedText(
      lang,
      'Nếu hành động này là của bạn, bạn có thể bỏ qua email này.',
      'If this action was yours, you can ignore this email.',
    );

    const bodyContent = `
            <p style="margin-bottom:24px;">
                ${greeting} <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p>${intro}</p>
            <div style="background-color:#020617;border:1px solid #1e293b;border-radius:16px;padding:24px;margin:24px 0;">
                <table width="100%" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="color:#64748b;font-size:14px;padding-bottom:12px;">${ipLabel}</td>
                        <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;padding-bottom:12px;">${ip}</td>
                    </tr>
                    <tr>
                        <td style="height:1px;background-color:#1e293b;" colspan="2"></td>
                    </tr>
                    <tr>
                        <td style="color:#64748b;font-size:14px;padding-top:12px;">${timeLabel}</td>
                        <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;padding-top:12px;">${time}</td>
                    </tr>
                </table>
            </div>
            <div style="padding:16px;background-color:#450a0a;border:1px solid #7f1d1d;border-radius:12px;margin-bottom:20px;">
                <p style="margin:0;color:#fecaca;font-size:13px;line-height:1.5;">
                    ${warning}
                </p>
            </div>
            <p style="font-size:13px;color:#64748b;">
                ${outro}
            </p>`;

    return this.wrap(title, bodyContent, lang);
  }

  static getTeamInvitationEmail(
    teamName: string,
    inviterName: string,
    role: string,
    loginUrl: string,
    lang: AppLanguage = 'vi',
  ): string {
    const title = pickLocalizedText(
      lang,
      'Lời mời tham gia team',
      'Team invitation',
    );
    const greeting = pickLocalizedText(lang, 'Xin chào,', 'Hello,');
    const intro = pickLocalizedText(
      lang,
      `<strong style="color:#f1f5f9;">${inviterName}</strong> đã mời bạn tham gia team <strong style="color:#f1f5f9;">${teamName}</strong> với vai trò <strong style="color:#f1f5f9;">${this.getRoleLabel(role, lang)}</strong>.`,
      `<strong style="color:#f1f5f9;">${inviterName}</strong> invited you to join <strong style="color:#f1f5f9;">${teamName}</strong> as <strong style="color:#f1f5f9;">${this.getRoleLabel(role, lang)}</strong>.`,
    );
    const cta = pickLocalizedText(
      lang,
      'Mở Data Explorer',
      'Open Data Explorer',
    );
    const instructions = pickLocalizedText(
      lang,
      'Nếu bạn đã có tài khoản với email này, chỉ cần đăng nhập là team sẽ xuất hiện tự động. Nếu chưa có tài khoản, hãy đăng ký bằng đúng email này để được thêm vào team sau khi đăng nhập.',
      'If you already have an account with this email, just sign in and the team will appear automatically. If not, sign up with this exact email to be added after login.',
    );
    const outro = pickLocalizedText(
      lang,
      'Nếu bạn không mong đợi email này, bạn có thể bỏ qua.',
      'If you were not expecting this email, you can safely ignore it.',
    );

    const bodyContent = `
            <p style="margin-bottom:24px;">
                ${greeting}
            </p>
            <p>${intro}</p>
            <div style="margin:32px 0;text-align:center;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#3b82f6,#6366f1);border-radius:14px;color:#fff;text-decoration:none;font-weight:800;">
                    ${cta}
                </a>
            </div>
            <p style="padding:12px 16px;background-color:#1e293b;border-radius:12px;color:#cbd5e1;font-size:13px;line-height:1.6;">
                ${instructions}
            </p>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">
                ${outro}
            </p>`;

    return this.wrap(title, bodyContent, lang);
  }
}
