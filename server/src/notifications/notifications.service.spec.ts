import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { firstValueFrom, timer } from 'rxjs';
import { map, take } from 'rxjs/operators';

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
          useValue: { get: jest.fn().mockReturnValue('redis://localhost:6379') },
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
        'notifications',
        expect.stringContaining('Test message')
    );
  });

  it('should stream events filtered by userId', async () => {
    const userId = 'user-1';
    const streamPromise = firstValueFrom(service.eventStream(userId));

    // Simulate Redis message arrival
    const messageHandler = subClientMock.on.mock.calls.find(c => c[0] === 'message')[1];
    
    // First message: wrong userId (should be filtered out by service)
    messageHandler('notifications', JSON.stringify({ userId: 'other-user', data: { message: 'Ignored' } }));
    
    // Send matching message shortly after
    setTimeout(() => {
        messageHandler('notifications', JSON.stringify({ userId: 'user-1', data: { message: 'Matched' } }));
    }, 10);

    const event: any = await streamPromise;
    expect(event.data.message).toBe('Matched');
  });
});
