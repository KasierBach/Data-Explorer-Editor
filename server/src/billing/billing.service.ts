import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getBillingPlan } from './billing-plans';
import type { CreateCheckoutDto } from './dto/create-checkout.dto';
import {
  createCheckoutRequest,
  type PaymentProvider,
  type PaymentProviderName,
} from './providers/payment-provider';

export const PAYMENT_PROVIDER_ADAPTERS = Symbol('PAYMENT_PROVIDER_ADAPTERS');

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly providers: PaymentProvider[],
  ) {}

  getPlans() {
    return [
      {
        code: 'free',
        name: 'Data Explorer Free',
        amountVnd: 0,
        displayAmountUsd: '$0',
        durationDays: 0,
      },
      ...['pro_monthly', 'pro_yearly'].map(getBillingPlan),
    ];
  }

  async createCheckout(userId: string, dto: CreateCheckoutDto) {
    const provider = this.getProvider(dto.provider);
    const plan = getBillingPlan(dto.planCode);
    const providerOrderId = this.createProviderOrderId(provider.name);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: provider.name,
        planCode: plan.code,
        amountVnd: plan.amountVnd,
        displayAmountUsd: plan.displayAmountUsd,
        status: 'pending',
        providerOrderId,
      },
    });

    const checkout = await provider.createCheckout(
      createCheckoutRequest(payment.id, providerOrderId, userId, plan),
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerOrderId: checkout.providerOrderId,
        checkoutUrl: checkout.checkoutUrl,
        providerRequestId: checkout.providerRequestId,
        rawPayload: this.toJson(checkout.rawResponse),
      },
    });

    return {
      paymentId: payment.id,
      provider: provider.name,
      providerOrderId: checkout.providerOrderId,
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment not found');
    }

    const subscription = await this.prisma.billingSubscription.findUnique({
      where: { userId },
    });

    return {
      payment: this.toPaymentResponse(payment),
      subscription,
      user: this.toBillingUser(payment.user),
    };
  }

  async listHistory(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    return payments.map((payment) => this.toPaymentResponse(payment));
  }

  async handleProviderWebhook(
    providerName: PaymentProviderName,
    payload: unknown,
  ) {
    const provider = this.getProvider(providerName);
    const verified = await provider.verifyWebhook(payload);

    if (!verified.isValid || !verified.providerOrderId) {
      throw new BadRequestException('Invalid payment notification signature');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerOrderId: verified.providerOrderId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'paid') {
      return { paymentId: payment.id, status: 'paid', idempotent: true };
    }

    const plan = getBillingPlan(payment.planCode);
    const failedStatus = verified.status === 'failed' ? 'failed' : 'pending';

    if (verified.status !== 'paid') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: failedStatus,
          providerTransactionId: verified.providerTransactionId,
          rawPayload: this.toJson(verified.rawPayload),
        },
      });
      return { paymentId: payment.id, status: failedStatus };
    }

    const now = verified.paidAt ?? new Date();
    const expiresAt = await this.prisma.$transaction(async (tx) => {
      const currentSubscription = await tx.billingSubscription.findUnique({
        where: { userId: payment.userId },
      });
      const startsAt =
        currentSubscription?.expiresAt && currentSubscription.expiresAt > now
          ? currentSubscription.expiresAt
          : now;
      const nextExpiresAt = new Date(
        startsAt.getTime() + plan.durationDays * DAY_MS,
      );

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          providerTransactionId: verified.providerTransactionId,
          paidAt: now,
          rawPayload: this.toJson(verified.rawPayload),
        },
      });

      await tx.billingSubscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          planCode: plan.code,
          status: 'active',
          provider: provider.name,
          startsAt,
          expiresAt: nextExpiresAt,
          lastPaymentId: payment.id,
        },
        update: {
          planCode: plan.code,
          status: 'active',
          provider: provider.name,
          startsAt,
          expiresAt: nextExpiresAt,
          lastPaymentId: payment.id,
        },
      });

      await tx.user.update({
        where: { id: payment.userId },
        data: {
          plan: 'pro',
          billingDate: nextExpiresAt,
          paymentMethod: provider.displayName,
          planExpiresAt: nextExpiresAt,
          subscriptionStatus: 'active',
          paymentProvider: provider.displayName,
        },
        select: {
          id: true,
          plan: true,
          billingDate: true,
          paymentMethod: true,
          planExpiresAt: true,
          subscriptionStatus: true,
          paymentProvider: true,
        },
      });

      return nextExpiresAt;
    });

    return {
      paymentId: payment.id,
      status: 'paid',
      planCode: plan.code,
      expiresAt,
    };
  }

  private getProvider(name: PaymentProviderName) {
    const provider = this.providers.find((item) => item.name === name);
    if (!provider) {
      throw new BadRequestException('Unsupported payment provider');
    }
    return provider;
  }

  private createProviderOrderId(provider: PaymentProviderName) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return `de_${provider}_${Date.now()}_${suffix}`;
  }

  private toPaymentResponse(payment: any) {
    return {
      id: payment.id,
      provider: payment.provider,
      planCode: payment.planCode,
      amountVnd: payment.amountVnd,
      displayAmountUsd: payment.displayAmountUsd,
      status: payment.status,
      checkoutUrl: payment.checkoutUrl,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }

  private toBillingUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      billingDate: user.billingDate,
      paymentMethod: user.paymentMethod,
      planExpiresAt: user.planExpiresAt,
      subscriptionStatus: user.subscriptionStatus,
      paymentProvider: user.paymentProvider,
    };
  }

  private toJson(value: unknown) {
    return value === undefined ? undefined : (value as any);
  }
}
