import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject, Observable } from 'rxjs';

type NotificationPayload = {
  userId?: string;
  data: any;
};

type UserNotificationStream = {
  subject: Subject<{ data: any }>;
  subscribers: number;
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private pubClient: Redis;
  private subClient: Redis;
  private readonly userStreams = new Map<string, UserNotificationStream>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);

    this.subClient.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message) as NotificationPayload;
        const userId = payload.userId ?? this.userIdFromChannel(channel);
        if (!userId) {
          return;
        }

        const stream = this.userStreams.get(userId);
        if (!stream) {
          return;
        }

        stream.subject.next({ data: payload.data });
      } catch (error) {
        this.logger.error(
          'Failed to parse notification message',
          error instanceof Error ? error.stack : String(error),
        );
      }
    });
  }

  onModuleDestroy() {
    this.userStreams.forEach(({ subject }) => subject.complete());
    this.userStreams.clear();
    this.pubClient.quit();
    this.subClient.quit();
  }

  private channelForUser(userId: string) {
    return `notifications:user:${userId}`;
  }

  private userIdFromChannel(channel: string) {
    if (!channel.startsWith('notifications:user:')) {
      return null;
    }

    return channel.slice('notifications:user:'.length) || null;
  }

  private ensureStream(userId: string): UserNotificationStream {
    const existing = this.userStreams.get(userId);
    if (existing) {
      return existing;
    }

    const stream: UserNotificationStream = {
      subject: new Subject<{ data: any }>(),
      subscribers: 0,
    };
    this.userStreams.set(userId, stream);
    return stream;
  }

  private async subscribeToUser(userId: string) {
    const channel = this.channelForUser(userId);
    await this.subClient.subscribe(channel);
    this.logger.debug(`Subscribed to notifications channel ${channel}`);
  }

  private async unsubscribeFromUser(userId: string) {
    const channel = this.channelForUser(userId);
    await this.subClient.unsubscribe(channel);
    this.logger.debug(`Unsubscribed from notifications channel ${channel}`);
  }

  private releaseStream(userId: string) {
    const stream = this.userStreams.get(userId);
    if (!stream) {
      return;
    }

    stream.subscribers = Math.max(0, stream.subscribers - 1);
    if (stream.subscribers > 0) {
      return;
    }

    this.userStreams.delete(userId);
    stream.subject.complete();

    void this.unsubscribeFromUser(userId).catch((error) => {
      this.logger.error(
        `Failed to unsubscribe notifications channel for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
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
    await this.pubClient.publish(
      this.channelForUser(userId),
      JSON.stringify(payload),
    );
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
    return new Observable((subscriber) => {
      const stream = this.ensureStream(userId);
      stream.subscribers += 1;

      const subjectSubscription = stream.subject.subscribe({
        next: (event) => subscriber.next(event),
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete(),
      });

      void this.subscribeToUser(userId).catch((error) => {
        this.logger.error(
          `Failed to subscribe notifications channel for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
        subscriber.error(error);
      });

      return () => {
        subjectSubscription.unsubscribe();
        this.releaseStream(userId);
      };
    });
  }
}
