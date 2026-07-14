import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  async checkHealth() {
    return this.checkReadiness();
  }

  @Get('health/live')
  @SkipThrottle()
  checkLiveness() {
    return {
      status: 'ok',
      message: 'Server is alive',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/ready')
  @SkipThrottle()
  async checkReadiness() {
    const [database, redis] = await Promise.allSettled([
      this.withTimeout(this.prisma.$queryRaw`SELECT 1`, 3000),
      this.withTimeout(this.redis.ping(), 3000),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };

    if (database.status === 'rejected' || redis.status === 'rejected') {
      throw new ServiceUnavailableException({
        message: 'Service dependencies are not ready.',
        details: checks,
      });
    }

    return {
      status: 'ok',
      checks,
      version: process.env.RENDER_GIT_COMMIT || 'local',
      timestamp: new Date().toISOString(),
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Health check timed out.')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
