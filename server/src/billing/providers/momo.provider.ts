import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type VerifiedPayment,
} from './payment-provider';
import { hmacSha256Hex, signaturesMatch } from './signature.util';

interface MomoCreateResponse {
  resultCode?: number;
  message?: string;
  payUrl?: string;
  requestId?: string;
}

@Injectable()
export class MomoProvider implements PaymentProvider {
  readonly name = 'momo' as const;
  readonly displayName = 'MoMo';

  constructor(private readonly config: ConfigService) {}

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const cfg = this.getConfig();
    const requestId = `${input.providerOrderId}_request`;
    const requestType = 'payWithMethod';
    const orderInfo = input.planName;
    const redirectUrl = this.buildReturnUrl('momo', input.paymentId);
    const ipnUrl = `${cfg.apiBaseUrl}/billing/webhooks/momo`;
    const extraData = Buffer.from(
      JSON.stringify({
        paymentId: input.paymentId,
        userId: input.userId,
        planCode: input.planCode,
      }),
    ).toString('base64');

    const rawSignature =
      `accessKey=${cfg.accessKey}&amount=${input.amountVnd}&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}&orderId=${input.providerOrderId}&orderInfo=${orderInfo}` +
      `&partnerCode=${cfg.partnerCode}&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}&requestType=${requestType}`;

    const payload = {
      partnerCode: cfg.partnerCode,
      requestId,
      amount: input.amountVnd,
      orderId: input.providerOrderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData,
      lang: 'vi',
      signature: hmacSha256Hex(cfg.secretKey, rawSignature),
    };

    const response = await fetch(cfg.createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as MomoCreateResponse;

    if (!response.ok || data.resultCode !== 0 || !data.payUrl) {
      throw new ServiceUnavailableException(
        data.message || 'MoMo checkout unavailable',
      );
    }

    return {
      providerOrderId: input.providerOrderId,
      providerRequestId: data.requestId || requestId,
      checkoutUrl: data.payUrl,
      rawResponse: data,
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPayment> {
    const cfg = this.getConfig();
    const data = this.asRecord(payload);
    const amount = this.stringValue(data, 'amount');
    const extraData = this.stringValue(data, 'extraData');
    const message = this.stringValue(data, 'message');
    const orderId = this.stringValue(data, 'orderId');
    const orderInfo = this.stringValue(data, 'orderInfo');
    const orderType = this.stringValue(data, 'orderType');
    const partnerCode = this.stringValue(data, 'partnerCode');
    const payType = this.stringValue(data, 'payType');
    const requestId = this.stringValue(data, 'requestId');
    const responseTime = this.stringValue(data, 'responseTime');
    const resultCodeValue = this.stringValue(data, 'resultCode');
    const transId = this.stringValue(data, 'transId');
    const rawSignature =
      `accessKey=${cfg.accessKey}&amount=${amount}&extraData=${extraData}` +
      `&message=${message}&orderId=${orderId}` +
      `&orderInfo=${orderInfo}&orderType=${orderType}` +
      `&partnerCode=${partnerCode}&payType=${payType}` +
      `&requestId=${requestId}&responseTime=${responseTime}` +
      `&resultCode=${resultCodeValue}&transId=${transId}`;

    const expectedSignature = hmacSha256Hex(cfg.secretKey, rawSignature);
    const isValid = signaturesMatch(expectedSignature, data.signature);
    const resultCode = Number(resultCodeValue);

    return {
      isValid,
      status: resultCode === 0 ? 'paid' : 'failed',
      providerOrderId: orderId,
      providerTransactionId: transId || undefined,
      paidAt: resultCode === 0 ? new Date() : undefined,
      rawPayload: payload,
    };
  }

  private getConfig() {
    const partnerCode = this.config.get<string>('MOMO_PARTNER_CODE');
    const accessKey = this.config.get<string>('MOMO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MOMO_SECRET_KEY');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const apiBaseUrl =
      this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:3001/api';
    const createUrl =
      this.config.get<string>('MOMO_CREATE_URL') ||
      'https://test-payment.momo.vn/v2/gateway/api/create';

    if (!partnerCode || !accessKey || !secretKey) {
      throw new ServiceUnavailableException(
        'MoMo credentials are not configured',
      );
    }

    return {
      partnerCode,
      accessKey,
      secretKey,
      frontendUrl,
      apiBaseUrl,
      createUrl,
    };
  }

  private buildReturnUrl(provider: string, paymentId: string) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return `${frontendUrl}/billing/return?provider=${provider}&paymentId=${paymentId}`;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(data: Record<string, unknown>, key: string) {
    const value = data[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    return '';
  }
}
