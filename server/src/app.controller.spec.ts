import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController health', () => {
  const appService = { getHello: jest.fn(() => 'Hello World!') };
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };
  const controller = new AppController(
    appService as never,
    prisma as never,
    redis as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('reports readiness only when PostgreSQL and Redis respond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    redis.ping.mockResolvedValue('PONG');

    await expect(controller.checkReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('returns an unavailable error when a dependency is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database down'));
    redis.ping.mockResolvedValue('PONG');

    await expect(controller.checkReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
