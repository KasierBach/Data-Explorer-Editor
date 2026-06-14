import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

jest.mock('ioredis');

describe('RedisService', () => {
  let service: RedisService;
  let clientMock: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    service.onModuleInit();
    clientMock = service.getClient();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.clearAllMocks();
  });

  it('scans keys incrementally across multiple cursor pages', async () => {
    clientMock.scan
      .mockResolvedValueOnce([
        '1',
        ['search:user-1:item-a', 'search:user-1:item-b'],
      ])
      .mockResolvedValueOnce([
        '0',
        ['search:user-1:item-b', 'search:user-1:item-c'],
      ]);

    const keys = await service.scanKeys('search:user-1:*', 50);

    expect(clientMock.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'search:user-1:*',
      'COUNT',
      50,
    );
    expect(clientMock.scan).toHaveBeenNthCalledWith(
      2,
      '1',
      'MATCH',
      'search:user-1:*',
      'COUNT',
      50,
    );
    expect(keys).toEqual([
      'search:user-1:item-a',
      'search:user-1:item-b',
      'search:user-1:item-c',
    ]);
  });

  it('keeps keys() as a compatibility wrapper around scanKeys()', async () => {
    clientMock.scan.mockResolvedValueOnce(['0', ['presence:org-1']]);

    await expect(service.keys('presence:*')).resolves.toEqual([
      'presence:org-1',
    ]);
  });
});
