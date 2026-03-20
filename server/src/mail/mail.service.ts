import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailTemplates } from './mail.templates';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;

    constructor(private readonly configService: ConfigService) {
        const mailUser = this.configService.get<string>('MAIL_USER');
        const mailPass = this.configService.get<string>('MAIL_PASS');

        if (mailUser && mailPass) {
            this.transporter = nodemailer.createTransport({
                host: 'smtp-relay.brevo.com',
                port: 587,
                secure: false, // STARTTLS
                auth: { user: mailUser, pass: mailPass },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
                // Force IPv4 for Render environment stability
                family: 4, 
            } as any);
            this.logger.log('Mail transporter initialized with Brevo SMTP.');
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

    // ─── Public Methods ─────────────────────────────────────────────

    async sendVerificationEmail(to: string, name: string, otp: string): Promise<void> {
        const html = MailTemplates.getVerificationEmail(name, otp);
        await this.send(to, 'Xác minh địa chỉ Email - Data Explorer ✉️', html);
    }

    async sendPasswordResetEmail(to: string, name: string, otp: string): Promise<void> {
        const html = MailTemplates.getPasswordResetEmail(name, otp);
        await this.send(to, 'Mã OTP đặt lại mật khẩu - Data Explorer 🔑', html);
    }

    async sendSecurityAlertEmail(to: string, name: string, ip: string, time: string): Promise<void> {
        const html = MailTemplates.getSecurityAlertEmail(name, ip, time);
        await this.send(to, '🚨 Cảnh báo bảo mật - Đăng nhập từ IP mới', html);
    }
}
