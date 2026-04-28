import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { MailTemplates } from './mail.templates';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly apiKey: string;
    private readonly senderEmail: string;

    constructor(private readonly configService: ConfigService) {
        // Aggressive sanitize: Remove spaces, newlines, and any accidental quotes
        this.apiKey = (this.configService.get<string>('MAIL_PASS') || '')
            .replace(/['"]/g, '')
            .trim();
            
        this.senderEmail = (this.configService.get<string>('MAIL_USER') || '').trim();

        if (!this.apiKey || !this.senderEmail) {
            this.logger.warn('MAIL_USER or MAIL_PASS (API Key) not set. Emails will be logged to console only.');
        } else {
            const maskedKey = this.apiKey.substring(0, 10) + '...' + this.apiKey.substring(this.apiKey.length - 4);
            this.logger.log(`Mail service initialized using Brevo REST API. Sender: ${this.senderEmail}, Key: ${maskedKey} (Length: ${this.apiKey.length})`);
        }
    }

    /**
     * Sends an email via Brevo REST API using native fetch.
     */
    private async send(to: string, subject: string, html: string): Promise<void> {
        if (!this.apiKey || !this.senderEmail) {
            this.logger.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
            this.logger.debug(html);
            return;
        }

        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': this.apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: 'Data Explorer', email: this.senderEmail },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html,
                })
            });

            if (response.ok) {
                this.logger.log(`Email sent to ${to}: "${subject}"`);
            } else {
                const errorData = await response.text();
                const errorMsg = `Brevo API Error (${response.status}): ${errorData}`;
                this.logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            this.logger.error(`Failed to send email to ${to} via API: ${error.message}`);
            throw error;
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

    async sendTeamInvitationEmail(to: string, teamName: string, inviterName: string, role: string, loginUrl: string): Promise<void> {
        const html = MailTemplates.getTeamInvitationEmail(teamName, inviterName, role, loginUrl);
        await this.send(to, `Lời mời tham gia team ${teamName}`, html);
    }
}
