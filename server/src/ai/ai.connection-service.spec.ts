import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiConnectionService } from './ai.connection-service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AiAccountPolicyService } from './ai-account-policy.service';

describe('R10 AI connection error contract', () => {
  const connections = { findOne: jest.fn(), getPool: jest.fn() };
  const factory = { getStrategy: jest.fn() };
  const gather = jest.fn();
  const assertEnabled = jest.fn().mockResolvedValue(undefined);
  const assertConnectionEnabled = jest.fn().mockResolvedValue(undefined);
  let service: AiConnectionService;
  beforeEach(async () => {
    jest.clearAllMocks();
    connections.findOne.mockResolvedValue({ id: 'fixture', type: 'postgres' });
    connections.getPool.mockResolvedValue({ pool: 'fixture' });
    factory.getStrategy.mockReturnValue({ strategy: 'fixture' });
    gather.mockResolvedValue('schema');
    const module = await Test.createTestingModule({
      providers: [
        AiConnectionService,
        { provide: ConnectionsService, useValue: connections },
        { provide: DatabaseStrategyFactory, useValue: factory },
        {
          provide: AiAccountPolicyService,
          useValue: { assertEnabled, assertConnectionEnabled },
        },
      ],
    }).compile();
    service = module.get(AiConnectionService);
  });

  it('rejects disabled AI before looking up or gathering connection data', async () => {
    const denied = new ForbiddenException({
      reason: 'AI_DISABLED',
      message: 'AI is disabled',
    });
    assertEnabled.mockRejectedValueOnce(denied);
    await expect(
      service.getConnectionContext('fixture', 'db', 'user', gather),
    ).rejects.toBe(denied);
    expect(connections.findOne).not.toHaveBeenCalled();
    expect(connections.getPool).not.toHaveBeenCalled();
    expect(gather).not.toHaveBeenCalled();
  });

  for (const method of [
    'getConnectionContext',
    'getConnectionContextForStream',
  ] as const) {
    it.each([
      ['lookup', new NotFoundException('missing fixture'), 404, undefined],
      ['pool', new ForbiddenException('database denied'), 403, undefined],
      [
        'pool',
        Object.assign(new Error('offline'), { code: 'ECONNREFUSED' }),
        503,
        'DATABASE_UNAVAILABLE',
      ],
      [
        'schema',
        Object.assign(new Error('missing table'), { code: '42P01' }),
        400,
        'QUERY_OBJECT_NOT_FOUND',
      ],
    ])(
      `${method} preserves %s failure without generating a fallback context`,
      async (stage, error, status, reason) => {
        const failed =
          stage === 'lookup'
            ? connections.findOne
            : stage === 'pool'
              ? connections.getPool
              : gather;
        failed.mockRejectedValueOnce(error);
        await expect(
          service[method]('fixture', 'db', 'user', gather),
        ).rejects.toMatchObject({
          status,
          ...(reason ? { response: expect.objectContaining({ reason }) } : {}),
        });
        if (stage !== 'schema') expect(gather).not.toHaveBeenCalled();
        if (stage === 'lookup')
          expect(connections.getPool).not.toHaveBeenCalled();
      },
    );

    it(`${method} passes the authorized context and database to schema gathering`, async () => {
      await expect(
        service[method]('fixture', 'db', 'user', gather),
      ).resolves.toMatchObject({ schemaContext: 'schema' });
      expect(gather).toHaveBeenCalledWith(
        { pool: 'fixture' },
        { strategy: 'fixture' },
        'db',
        'fixture',
      );
    });
  }
});
