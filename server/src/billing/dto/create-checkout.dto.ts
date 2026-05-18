import { IsIn } from 'class-validator';
import { PAID_PLAN_CODES, type PaidPlanCode } from '../billing-plans';
import {
  PAYMENT_PROVIDERS,
  type PaymentProviderName,
} from '../providers/payment-provider';

export class CreateCheckoutDto {
  @IsIn(PAID_PLAN_CODES)
  planCode: PaidPlanCode;

  @IsIn(PAYMENT_PROVIDERS)
  provider: PaymentProviderName;
}
