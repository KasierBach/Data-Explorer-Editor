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
}
