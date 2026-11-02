import { randomUUID, createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  ConsoleLogger,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, type Payment } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  BillingService,
  PAYMENT_PROVIDER_ADAPTERS,
} from '../src/billing/billing.service';
import { MomoProvider } from '../src/billing/providers/momo.provider';
import { ZaloPayProvider } from '../src/billing/providers/zalopay.provider';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { closeE2eApp } from './e2e-app';
import { UsersService } from '../src/users/users.service';

const DAY = 86400000;
const ANCHOR = new Date('2030-01-01T00:00:00.000Z');
const MOMO_SECRET = 'r06-local-momo-secret';
const ZALO_SECRET = 'r06-local-zalo-key2';

// Independent fixture signing: calling the provider's verifier to sign would hide signature regressions.
function momoPayload(
  payment: Payment,
  options: { amount?: number; resultCode?: number } = {},
) {
  const data = {
    amount: options.amount ?? payment.amountVnd,
    extraData: '',
    message: 'fixture',
    orderId: payment.providerOrderId,
    orderInfo: 'R06 local test',
    orderType: 'momo_wallet',
    partnerCode: 'r06-partner',
    payType: 'qr',
    requestId: `${payment.id}-request`,
    responseTime: Date.now(),
    resultCode: options.resultCode ?? 0,
    transId: `${payment.id}-transaction`,
  };
  const value = `accessKey=r06-access&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;
  return {
    ...data,
    signature: createHmac('sha256', MOMO_SECRET).update(value).digest('hex'),
  };
}

function zaloPayload(payment: Payment) {
  const data = JSON.stringify({
    app_id: 2606,
    app_trans_id: payment.providerOrderId,
    amount: payment.amountVnd,
    zp_trans_id: `${payment.id}-transaction`,
    server_time: Date.now(),
  });
  return {
    data,
    mac: createHmac('sha256', ZALO_SECRET).update(data).digest('hex'),
  };
}

describe('R06 native PostgreSQL entitlement and signed local-provider webhooks', () => {
  const suffix = randomUUID().replace(/-/g, ''),
    tag = `r06_${suffix}`;
  const userIds = [randomUUID(), randomUUID()];
  const clients: PrismaClient[] = [];
  const services: BillingService[] = [];
  let admin: Pool, app: INestApplication;

  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const config = new ConfigService({
      MOMO_PARTNER_CODE: 'r06-partner',
      MOMO_ACCESS_KEY: 'r06-access',
      MOMO_SECRET_KEY: MOMO_SECRET,
      ZALOPAY_APP_ID: '2606',
      ZALOPAY_KEY1: 'r06-local-key1',
      ZALOPAY_KEY2: ZALO_SECRET,
    });
    const providers = [new MomoProvider(config), new ZaloPayProvider(config)];
    for (let i = 0; i < 4; i++) {
      const client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: process.env.E2E_DATABASE_URL,
          application_name: `${tag}_${i}`,
          max: 2,
        }),
      });
      await client.$connect();
      clients.push(client);
      services.push(new BillingService(client as PrismaService, providers));
    }
    await clients[0].user.createMany({
      data: userIds.map((id, i) => ({
        id,
        email: `${tag}_${i}@example.test`,
        isEmailVerified: true,
      })),
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .setLogger(new ConsoleLogger({ logLevels: [] }))
      .overrideProvider(PrismaService)
      .useValue(clients[0])
      .overrideProvider(PAYMENT_PROVIDER_ADAPTERS)
      .useValue(providers)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  }, 20000);

  beforeEach(async () => {
    await clients[0].payment.deleteMany({ where: { userId: { in: userIds } } });
    await clients[0].billingSubscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await clients[0].user.updateMany({
      where: { id: { in: userIds } },
      data: {
        plan: 'free',
        billingDate: null,
        planExpiresAt: null,
        subscriptionStatus: 'inactive',
        paymentProvider: null,
        paymentMethod: null,
      },
    });
  });

  afterAll(async () => {
    try {
      if (app) await closeE2eApp(app);
      if (clients[0])
        await clients[0].user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
      await admin?.end();
    }
  });

  async function seedPayment(
    userId = userIds[0],
    planCode = 'pro_monthly',
    provider = 'momo',
  ) {
    return clients[0].payment.create({
      data: {
        userId,
        planCode,
        provider,
        amountVnd: planCode === 'pro_monthly' ? 149000 : 1490000,
        displayAmountUsd: 'fixture',
        providerOrderId: `${tag}_${randomUUID()}`,
      },
    });
  }

  async function seedActive() {
    await clients[0].billingSubscription.create({
      data: {
        userId: userIds[0],
        planCode: 'pro_monthly',
        status: 'active',
        expiresAt: ANCHOR,
        startsAt: new Date('2029-12-02T00:00:00Z'),
      },
    });
    await clients[0].user.update({
      where: { id: userIds[0] },
      data: {
        plan: 'pro',
        subscriptionStatus: 'active',
        planExpiresAt: ANCHOR,
        billingDate: ANCHOR,
      },
    });
  }

  async function waitForBlocked(count: number) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const result = await admin.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name LIKE $1 AND wait_event_type='Lock'`,
        [`${tag}%`],
      );
      if (result.rows[0].count >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `Expected ${count} native transactions to reach a lock wait`,
    );
  }

  async function concurrentCredits(payments: Payment[]) {
    const held = await admin.connect();
    let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await held.query('BEGIN');
      await held.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [
        userIds[0],
      ]);
      pending = Promise.allSettled(
        payments.map((payment, i) =>
          services[i].handleProviderWebhook(
            payment.provider as 'momo' | 'zalopay',
            payment.provider === 'momo'
              ? momoPayload(payment)
              : zaloPayload(payment),
          ),
        ),
      );
      await waitForBlocked(payments.length);
    } finally {
      await held.query('ROLLBACK');
      held.release();
    }
    const results = await pending;
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
  }

  async function expectEntitlement(
    days: number,
    initial?: Date,
    userId = userIds[0],
  ) {
    const subscription = await clients[0].billingSubscription.findUniqueOrThrow(
      { where: { userId } },
    );
    const user = await clients[0].user.findUniqueOrThrow({
      where: { id: userId },
    });
    const payments = await clients[0].payment.findMany({
      where: { userId, status: 'paid' },
    });
    const possibleStarts = initial
      ? [initial]
      : payments.map((payment) => payment.paidAt!);
    expect(
      possibleStarts.some(
        (start) =>
          subscription.expiresAt!.getTime() === start.getTime() + days * DAY,
      ),
    ).toBe(true);
    expect(user.planExpiresAt).toEqual(subscription.expiresAt);
    expect(user.billingDate).toEqual(subscription.expiresAt);
    expect(user.plan).toBe('pro');
    expect(user.subscriptionStatus).toBe('active');
    expect(subscription.status).toBe('active');
    expect(
      payments.some((payment) => payment.id === subscription.lastPaymentId),
    ).toBe(true);
  }

  it.each([false, true])(
    'credits four monthly orders exactly 120 days with existing subscription=%s',
    async (existing) => {
      if (existing) await seedActive();
      const payments = await Promise.all(
        Array.from({ length: 4 }, () => seedPayment()),
      );
      await concurrentCredits(payments);
      expect(
        await clients[0].payment.count({
          where: { userId: userIds[0], status: 'paid' },
        }),
      ).toBe(4);
      await expectEntitlement(120, existing ? ANCHOR : undefined);
    },
  );

  it('adds mixed monthly/yearly orders from both providers without losing duration', async () => {
    await seedActive();
    const payments = await Promise.all([
      seedPayment(),
      seedPayment(userIds[0], 'pro_yearly', 'zalopay'),
      seedPayment(),
    ]);
    await concurrentCredits(payments);
    await expectEntitlement(425, ANCHOR);
    expect(
      await clients[0].payment.count({
        where: { userId: userIds[0], status: 'paid' },
      }),
    ).toBe(3);
  });

  it('credits concurrent and sequential duplicates of one monthly order only once', async () => {
    const payment = await seedPayment();
    await concurrentCredits(Array.from({ length: 4 }, () => payment));
    const replay = await services[0].handleProviderWebhook(
      'momo',
      momoPayload(payment),
    );
    expect(replay).toMatchObject({ status: 'paid', idempotent: true });
    await expectEntitlement(30);
    expect(
      await clients[0].payment.count({
        where: { userId: userIds[0], status: 'paid' },
      }),
    ).toBe(1);
  });

  it.each(['signature', 'amount', 'provider'])(
    'rejects a %s mismatch before crediting',
    async (failure) => {
      const payment = await seedPayment();
      let endpoint = 'momo',
        payload: Record<string, unknown> = momoPayload(payment);
      if (failure === 'signature')
        payload = { ...momoPayload(payment), signature: '00' };
      if (failure === 'amount') payload = momoPayload(payment, { amount: 1 });
      if (failure === 'provider') {
        endpoint = 'zalopay';
        payload = zaloPayload(payment);
      }
      await request(app.getHttpServer())
        .post(`/api/billing/webhooks/${endpoint}`)
        .send(payload)
        .expect(400);
      expect(
        (
          await clients[0].payment.findUniqueOrThrow({
            where: { id: payment.id },
          })
        ).status,
      ).toBe('pending');
      expect(
        await clients[0].billingSubscription.count({
          where: { userId: userIds[0] },
        }),
      ).toBe(0);
      expect(
        (await clients[0].user.findUniqueOrThrow({ where: { id: userIds[0] } }))
          .plan,
      ).toBe('free');
    },
  );

  it('ignores a delayed signed failure after payment succeeded', async () => {
    const payment = await seedPayment();
    await request(app.getHttpServer())
      .post('/api/billing/webhooks/momo')
      .send(momoPayload(payment))
      .expect(201);
    const before = await clients[0].billingSubscription.findUniqueOrThrow({
      where: { userId: userIds[0] },
    });
    await request(app.getHttpServer())
      .post('/api/billing/webhooks/momo')
      .send(momoPayload(payment, { resultCode: 1006 }))
      .expect(201);
    const after = await clients[0].billingSubscription.findUniqueOrThrow({
      where: { userId: userIds[0] },
    });
    expect(after).toEqual(before);
    expect(
      (
        await clients[0].payment.findUniqueOrThrow({
          where: { id: payment.id },
        })
      ).status,
    ).toBe('paid');
  });

  it('rolls back payment and subscription if the final user update fails, then allows a valid retry', async () => {
    const payment = await seedPayment();
    const constraint = `${tag}_reject_pro`;
    await admin.query(
      `ALTER TABLE "User" ADD CONSTRAINT "${constraint}" CHECK (id <> '${userIds[0]}' OR plan <> 'pro')`,
    );
    try {
      await expect(
        services[0].handleProviderWebhook('momo', momoPayload(payment)),
      ).rejects.toThrow();
      expect(
        (
          await clients[0].payment.findUniqueOrThrow({
            where: { id: payment.id },
          })
        ).status,
      ).toBe('pending');
      expect(
        await clients[0].billingSubscription.count({
          where: { userId: userIds[0] },
        }),
      ).toBe(0);
      expect(
        (await clients[0].user.findUniqueOrThrow({ where: { id: userIds[0] } }))
          .plan,
      ).toBe('free');
    } finally {
      await admin.query(`ALTER TABLE "User" DROP CONSTRAINT "${constraint}"`);
    }
    await services[0].handleProviderWebhook('momo', momoPayload(payment));
    await expectEntitlement(30);
  });

  it('keeps a new payment active when a stale profile-expiry check was already waiting', async () => {
    const expired = new Date('2020-01-01T00:00:00Z');
    await clients[0].billingSubscription.create({
      data: {
        userId: userIds[0],
        planCode: 'pro_monthly',
        status: 'active',
        expiresAt: expired,
      },
    });
    await clients[0].user.update({
      where: { id: userIds[0] },
      data: {
        plan: 'pro',
        planExpiresAt: expired,
        billingDate: expired,
        subscriptionStatus: 'active',
      },
    });
    const payment = await seedPayment(),
      held = await admin.connect();
    let credit: PromiseSettledResult<unknown>[] = [],
      profile: PromiseSettledResult<unknown>[] = [];
    let creditTask: Promise<PromiseSettledResult<unknown>[]> | undefined,
      profileTask: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await held.query('BEGIN');
      await held.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [
        userIds[0],
      ]);
      creditTask = Promise.allSettled([
        services[0].handleProviderWebhook('momo', momoPayload(payment)),
      ]);
      await waitForBlocked(1);
      profileTask = Promise.allSettled([
        new UsersService(clients[1] as PrismaService).findById(userIds[0]),
      ]);
      await waitForBlocked(2);
    } finally {
      await held.query('ROLLBACK');
      held.release();
      if (creditTask) credit = await creditTask;
      if (profileTask) profile = await profileTask;
    }
    expect(credit[0].status).toBe('fulfilled');
    expect(profile[0]).toMatchObject({
      status: 'fulfilled',
      value: { plan: 'pro', subscriptionStatus: 'active' },
    });
    await expectEntitlement(30);
  });

  it('does not block another user while the first user is locked', async () => {
    const [first, second] = await Promise.all([
      seedPayment(),
      seedPayment(userIds[1]),
    ]);
    const held: PoolClient = await admin.connect();
    let firstResult: PromiseSettledResult<unknown>[] | undefined;
    let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
    try {
      await held.query('BEGIN');
      await held.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE', [
        userIds[0],
      ]);
      pending = Promise.allSettled([
        services[0].handleProviderWebhook('momo', momoPayload(first)),
      ]);
      await waitForBlocked(1);
      await services[1].handleProviderWebhook('momo', momoPayload(second));
      await expectEntitlement(30, undefined, userIds[1]);
      expect(
        (
          await clients[0].payment.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).status,
      ).toBe('pending');
    } finally {
      await held.query('ROLLBACK');
      held.release();
      if (pending) firstResult = await pending;
    }
    expect(firstResult?.[0].status).toBe('fulfilled');
    await expectEntitlement(30);
  }, 10000);
});
