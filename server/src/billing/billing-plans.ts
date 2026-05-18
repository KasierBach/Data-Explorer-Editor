import { BadRequestException } from '@nestjs/common';

export const PAID_PLAN_CODES = ['pro_monthly', 'pro_yearly'] as const;
export type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];

export interface BillingPlan {
  code: PaidPlanCode;
  name: string;
  amountVnd: number;
  displayAmountUsd: string;
  durationDays: number;
}

export const paidBillingPlans: BillingPlan[] = [
  {
    code: 'pro_monthly',
    name: 'Data Explorer Pro Monthly',
    amountVnd: 149000,
    displayAmountUsd: '~$5.99',
    durationDays: 30,
  },
  {
    code: 'pro_yearly',
    name: 'Data Explorer Pro Yearly',
    amountVnd: 1490000,
    displayAmountUsd: '~$59.99',
    durationDays: 365,
  },
];

export function getBillingPlan(code: string) {
  const plan = paidBillingPlans.find((item) => item.code === code);
  if (!plan) {
    throw new BadRequestException('Unsupported billing plan');
  }
  return plan;
}
