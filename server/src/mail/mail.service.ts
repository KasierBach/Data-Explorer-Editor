import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;

    constructor(private readonly configService: ConfigService) {
        const mailUser = this.configService.get<string>('MAIL_USER');
        const mailPass = this.configService.get<string>('MAIL_PASS');

        if (mailUser && mailPass) {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: mailUser, pass: mailPass },
            });
            this.logger.log('Mail transporter initialized with Gmail.');
        } else {
            this.logger.warn('MAIL_USER or MAIL_PASS not set. Emails will be logged to console only.');
        }
    }

    /**
     * Sends an email. Falls back to console logging if transporter is not configured.
     */
    private async send(to: string, subject: string, html: string): Promise<void> {
        const from = `"Data Explorer" <${this.configService.get('MAIL_USER') || 'noreply@dataexplorer.com'}>`;

        if (!this.transporter) {
            this.logger.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
            this.logger.debug(html);
            return;
        }

        try {
            await this.transporter.sendMail({ from, to, subject, html });
            this.logger.log(`Email sent to ${to}: "${subject}"`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error);
        }
    }

    /**
     * Builds a consistent HTML email wrapper with Data Explorer branding.
     */
    private buildTemplate(title: string, bodyContent: string): string {
        return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
        <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:520px;margin:40px auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:28px 32px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🛢️ Data Explorer</h1>
                </div>
                <!-- Body -->
                <div style="padding:32px;">
                    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 16px;">${title}</h2>
                    ${bodyContent}
                </div>
                <!-- Footer -->
                <div style="padding:20px 32px;border-top:1px solid #334155;text-align:center;">
                    <p style="margin:0;color:#64748b;font-size:11px;">© ${new Date().getFullYear()} Data Explorer. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>`;
    }

    // ─── Public Methods ─────────────────────────────────────────────

    async sendVerificationEmail(to: string, name: string, otp: string): Promise<void> {
        const body = `
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Cảm ơn bạn đã đăng ký tài khoản trên Data Explorer! Vui lòng sử dụng mã OTP bên dưới để xác minh địa chỉ email của bạn:
            </p>
            <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;background:#0f172a;border:2px solid #8b5cf6;padding:16px 40px;border-radius:12px;letter-spacing:8px;">
                    <span style="color:#8b5cf6;font-size:32px;font-weight:800;">${otp}</span>
                </div>
            </div>
            <p style="color:#f59e0b;font-size:13px;line-height:1.6;text-align:center;">
                ⏱️ Mã này sẽ hết hạn sau <strong>15 phút</strong>.
            </p>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;">
                Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email.
            </p>`;

        await this.send(to, 'Xác minh địa chỉ Email - Data Explorer ✉️', this.buildTemplate('Xác nhận tài khoản', body));
    }

    async sendPasswordResetEmail(to: string, name: string, otp: string): Promise<void> {
        const body = `
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Sử dụng mã OTP bên dưới để tiếp tục:
            </p>
            <div style="text-align:center;margin:24px 0;">
                <div style="display:inline-block;background:#0f172a;border:2px solid #3b82f6;padding:16px 40px;border-radius:12px;letter-spacing:8px;">
                    <span style="color:#3b82f6;font-size:32px;font-weight:800;">${otp}</span>
                </div>
            </div>
            <p style="color:#f59e0b;font-size:13px;line-height:1.6;text-align:center;">
                ⏱️ Mã này sẽ hết hạn sau <strong>5 phút</strong>.
            </p>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
            </p>`;

        await this.send(to, 'Mã OTP đặt lại mật khẩu - Data Explorer 🔑', this.buildTemplate('Đặt lại mật khẩu', body));
    }

    async sendSecurityAlertEmail(to: string, name: string, ip: string, time: string): Promise<void> {
        const body = `
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Xin chào <strong style="color:#f1f5f9;">${name}</strong>,
            </p>
            <p style="color:#cbd5e1;font-size:14px;line-height:1.6;">
                Chúng tôi phát hiện một lượt đăng nhập mới vào tài khoản của bạn từ một địa chỉ IP chưa được ghi nhận trước đó.
            </p>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin:20px 0;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="color:#94a3b8;font-size:13px;padding:6px 0;">📍 Địa chỉ IP</td>
                        <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${ip}</td>
                    </tr>
                    <tr>
                        <td style="color:#94a3b8;font-size:13px;padding:6px 0;">🕐 Thời gian</td>
                        <td style="color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${time}</td>
                    </tr>
                </table>
            </div>
            <p style="color:#ef4444;font-size:13px;line-height:1.6;">
                ⚠️ Nếu đây không phải bạn, hãy đổi mật khẩu ngay lập tức!
            </p>
            <p style="color:#94a3b8;font-size:13px;line-height:1.6;">
                Nếu đây là bạn, bạn có thể bỏ qua email này.
            </p>`;

        await this.send(to, '🚨 Cảnh báo bảo mật - Đăng nhập từ IP mới', this.buildTemplate('Cảnh báo bảo mật', body));
    }
}
