import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

jest.mock('ioredis');

describe('NotificationsService', () => {
  let service: NotificationsService;
  let pubClientMock: any;
  let subClientMock: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    // Setup Redis mocks
    service.onModuleInit();
    pubClientMock = (service as any).pubClient;
    subClientMock = (service as any).subClient;
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish message to Redis on emit', async () => {
    await service.emit('user-1', 'info', 'Test message');
    expect(pubClientMock.publish).toHaveBeenCalledWith(
      'notifications:user:user-1',
      expect.stringContaining('Test message'),
    );
  });

  it('should stream events through a per-user Redis channel', async () => {
    const userId = 'user-1';
    const streamPromise = firstValueFrom(service.eventStream(userId));
    expect(subClientMock.subscribe).toHaveBeenCalledWith(
      'notifications:user:user-1',
    );

    // Simulate Redis message arrival
    const messageHandler = subClientMock.on.mock.calls.find(
      (c) => c[0] === 'message',
    )[1];

    // First message: different channel (should be ignored by service)
    messageHandler(
      'notifications:user:other-user',
      JSON.stringify({ userId: 'other-user', data: { message: 'Ignored' } }),
    );

    // Send matching message shortly after
    setTimeout(() => {
      messageHandler(
        'notifications:user:user-1',
        JSON.stringify({ userId: 'user-1', data: { message: 'Matched' } }),
      );
    }, 10);

    const event: any = await streamPromise;
    expect(event.data.message).toBe('Matched');
    expect(subClientMock.unsubscribe).toHaveBeenCalledWith(
      'notifications:user:user-1',
    );
  });
});
