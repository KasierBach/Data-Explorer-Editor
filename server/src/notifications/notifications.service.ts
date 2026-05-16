import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private pubClient: Redis;
  private subClient: Redis;
  private readonly notificationSubject = new Subject<{
    userId: string;
    data: any;
  }>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);

    this.subClient.subscribe('notifications', (err) => {
      if (err) {
        this.logger.error(
          'Failed to subscribe to notifications channel',
          err.stack,
        );
      } else {
        this.logger.log('Subscribed to Redis notifications channel');
      }
    });

    this.subClient.on('message', (channel, message) => {
      if (channel === 'notifications') {
        try {
          const payload = JSON.parse(message);
          this.notificationSubject.next(payload);
        } catch (e) {
          this.logger.error('Failed to parse notification message', e);
        }
      }
    });
  }

  onModuleDestroy() {
    this.pubClient.quit();
    this.subClient.quit();
  }

  async emit(userId: string, type: string, message: string, extra?: any) {
    const payload = {
      userId,
      data: {
        type,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
      },
    };
    await this.pubClient.publish('notifications', JSON.stringify(payload));
  }

  async emitMany(
    userIds: string[],
    type: string,
    message: string,
    extra?: any,
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    await Promise.all(
      uniqueUserIds.map((userId) => this.emit(userId, type, message, extra)),
    );
  }

  eventStream(userId: string): Observable<any> {
    return this.notificationSubject.asObservable().pipe(
      map((payload) => {
        if (!payload.userId || payload.userId === userId) {
          return { data: payload.data };
        }
        return null;
      }),
      filter((event) => event !== null),
    );
  }
}
