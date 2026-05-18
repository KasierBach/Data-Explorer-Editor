import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type VerifiedPayment,
} from './payment-provider';
import { hmacSha256Hex, signaturesMatch } from './signature.util';

interface ZaloPayCreateResponse {
  return_code?: number;
  returncode?: number;
  return_message?: string;
  returnmessage?: string;
  order_url?: string;
  orderurl?: string;
}

@Injectable()
export class ZaloPayProvider implements PaymentProvider {
  readonly name = 'zalopay' as const;
  readonly displayName = 'ZaloPay';

  constructor(private readonly config: ConfigService) {}

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    const cfg = this.getConfig();
    const appTransId = this.buildAppTransId(input.providerOrderId);
    const appTime = Date.now();
    const item = JSON.stringify([
      {
        itemid: input.planCode,
        itemname: input.planName,
        itemprice: input.amountVnd,
        itemquantity: 1,
      },
    ]);
    const embedData = JSON.stringify({
      redirecturl: this.buildReturnUrl('zalopay', input.paymentId),
      paymentId: input.paymentId,
      planCode: input.planCode,
    });
    const data =
      `${cfg.appId}|${appTransId}|${input.userId}|${input.amountVnd}|` +
      `${appTime}|${embedData}|${item}`;

    const form = new URLSearchParams({
      app_id: cfg.appId,
      app_trans_id: appTransId,
      app_user: input.userId,
      app_time: String(appTime),
      amount: String(input.amountVnd),
      description: input.planName,
      bank_code: 'zalopayapp',
      item,
      embed_data: embedData,
      callback_url: `${cfg.apiBaseUrl}/billing/webhooks/zalopay`,
      mac: hmacSha256Hex(cfg.key1, data),
    });

    const response = await fetch(cfg.createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const result = (await response.json()) as ZaloPayCreateResponse;
    const returnCode = result.return_code ?? result.returncode;
    const checkoutUrl = result.order_url ?? result.orderurl;

    if (!response.ok || returnCode !== 1 || !checkoutUrl) {
      throw new ServiceUnavailableException(
        result.return_message ||
          result.returnmessage ||
          'ZaloPay checkout unavailable',
      );
    }

    return {
      providerOrderId: appTransId,
      providerRequestId: appTransId,
      checkoutUrl,
      rawResponse: result,
    };
  }

  async verifyWebhook(payload: unknown): Promise<VerifiedPayment> {
    const cfg = this.getConfig();
    const body = this.asRecord(payload);
    const dataString = typeof body.data === 'string' ? body.data : '';
    const expectedSignature = hmacSha256Hex(cfg.key2, dataString);
    const isValid = signaturesMatch(expectedSignature, body.mac);
    const data = this.parseData(dataString);
    const providerOrderId = this.stringValue(data, 'app_trans_id');
    const providerTransactionId = this.stringValue(data, 'zp_trans_id');
    const serverTime = this.stringValue(data, 'server_time');

    return {
      isValid,
      status: isValid ? 'paid' : 'failed',
      providerOrderId,
      providerTransactionId: providerTransactionId || undefined,
      paidAt: serverTime ? new Date(Number(serverTime)) : new Date(),
      rawPayload: payload,
    };
  }

  private getConfig() {
    const appId = this.config.get<string>('ZALOPAY_APP_ID');
    const key1 = this.config.get<string>('ZALOPAY_KEY1');
    const key2 = this.config.get<string>('ZALOPAY_KEY2');
    const apiBaseUrl =
      this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:3001/api';
    const createUrl =
      this.config.get<string>('ZALOPAY_CREATE_URL') ||
      'https://sb-openapi.zalopay.vn/v2/create';

    if (!appId || !key1 || !key2) {
      throw new ServiceUnavailableException(
        'ZaloPay credentials are not configured',
      );
    }

    return { appId, key1, key2, apiBaseUrl, createUrl };
  }

  private buildAppTransId(providerOrderId: string) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}_${providerOrderId}`;
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

  private parseData(value: string): Record<string, unknown> {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
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
