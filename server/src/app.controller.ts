import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Đầu API dành riêng cho UptimeRobot / BetterUptime Ping chống buồn ngủ Server
  @Get('health')
  checkHealth() {
    return {
      status: 'ok',
      message: 'Server is alive',
      timestamp: new Date().toISOString()
    };
  }

  // API an toàn để test xem trên Render có dán đúng biến môi trường Brevo chưa
  @Get('mail/debug')
  debugMailConfig() {
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;
    return {
        message: 'Mail Config Debug Status',
        isMailUserConfigured: !!mailUser,
        isMailPassConfigured: !!mailPass,
        senderEmail: mailUser || 'Chưa cấu hình!',
        apiKeyLength: mailPass ? mailPass.length : 0,
        hint: (!mailUser || !mailPass) ? '⚠️ Bạn quên Add biến môi trường trên mục Environment của Render rồi!' : '✅ Tuyệt vời, Biến môi trường đã được nhận!',
        provider: 'Brevo API (v3) qua Cổng 443 (Không bị Render block)'
    };
  }
}
