import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  PaymentProvider,
  VerifiedPayment,
} from './providers/payment-provider';

describe('BillingService', () => {
  const providerResult = {
    providerOrderId: 'momo_order_1',
    providerRequestId: 'momo_request_1',
    checkoutUrl: 'https://momo.test/checkout',
  };

  const createProvider = (
    verifiedPayment?: VerifiedPayment,
  ): PaymentProvider => ({
    name: 'momo',
    displayName: 'MoMo',
    createCheckout: jest.fn().mockResolvedValue(providerResult),
    verifyWebhook: jest.fn().mockResolvedValue(
      verifiedPayment ?? {
        isValid: true,
        status: 'paid',
        providerOrderId: 'momo_order_1',
        amountVnd: 149000,
        providerTransactionId: 'txn_1',
        paidAt: new Date('2026-05-18T10:00:00.000Z'),
        rawPayload: { resultCode: 0 },
      },
    ),
  });

  const createPrisma = () => {
    const payment = {
      id: 'payment_1',
      userId: 'user_1',
      provider: 'momo',
      planCode: 'pro_monthly',
      amountVnd: 149000,
      displayAmountUsd: '~$5.99',
      status: 'pending',
      providerOrderId: 'momo_order_1',
    };

    const prisma = {
      payment: {
        create: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue({
          ...payment,
          checkoutUrl: providerResult.checkoutUrl,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(payment),
        findMany: jest.fn().mockResolvedValue([payment]),
      },
      billingSubscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'subscription_1',
          userId: 'user_1',
          planCode: 'pro_monthly',
          status: 'active',
        }),
      },
      user: {
        update: jest.fn().mockResolvedValue({
          id: 'user_1',
          plan: 'pro',
          subscriptionStatus: 'active',
        }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    return prisma as unknown as PrismaService;
  };

  it('creates checkout from the server-side plan catalog amount only', async () => {
    const prisma = createPrisma();
    const provider = createProvider();
    const service = new BillingService(prisma, [provider]);

    const checkout = await service.createCheckout('user_1', {
      provider: 'momo',
      planCode: 'pro_monthly',
    });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        provider: 'momo',
        planCode: 'pro_monthly',
        amountVnd: 149000,
        displayAmountUsd: '~$5.99',
        status: 'pending',
      }),
    });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amountVnd: 149000,
        providerOrderId: expect.stringMatching(/^de_momo_\d+_[a-f0-9]{16}$/),
        planCode: 'pro_monthly',
        userId: 'user_1',
      }),
    );
    expect(checkout).toEqual(
      expect.objectContaining({
        paymentId: 'payment_1',
        checkoutUrl: providerResult.checkoutUrl,
      }),
    );
  });

  it('activates Pro only after a valid provider webhook', async () => {
    const prisma = createPrisma();
    const provider = createProvider();
    const service = new BillingService(prisma, [provider]);

    const result = await service.handleProviderWebhook('momo', {
      resultCode: 0,
    });

    expect(provider.verifyWebhook).toHaveBeenCalledWith({ resultCode: 0 });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: expect.objectContaining({
        plan: 'pro',
        subscriptionStatus: 'active',
        paymentProvider: 'MoMo',
      }),
      select: expect.any(Object),
    });
    expect(result).toEqual(expect.objectContaining({ status: 'paid' }));
  });

  it('rejects forged provider webhooks', async () => {
    const prisma = createPrisma();
    const provider = createProvider({
      isValid: false,
      status: 'failed',
      providerOrderId: 'momo_order_1',
      amountVnd: 149000,
      rawPayload: {},
    });
    const service = new BillingService(prisma, [provider]);

    await expect(service.handleProviderWebhook('momo', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a signed webhook when its amount differs from checkout', async () => {
    const prisma = createPrisma();
    const provider = createProvider({
      isValid: true,
      status: 'paid',
      providerOrderId: 'momo_order_1',
      amountVnd: 1000,
      rawPayload: {},
    });
    const service = new BillingService(prisma, [provider]);

    await expect(service.handleProviderWebhook('momo', {})).rejects.toThrow(
      'Payment amount does not match checkout',
    );
    expect(prisma.billingSubscription.upsert).not.toHaveBeenCalled();
  });

  it('does not extend a subscription twice when another webhook won the race', async () => {
    const prisma = createPrisma();
    (prisma.payment.updateMany as jest.Mock).mockResolvedValueOnce({
      count: 0,
    });
    const service = new BillingService(prisma, [createProvider()]);

    await expect(service.handleProviderWebhook('momo', {})).resolves.toEqual({
      paymentId: 'payment_1',
      status: 'paid',
      idempotent: true,
    });
    expect(prisma.billingSubscription.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
