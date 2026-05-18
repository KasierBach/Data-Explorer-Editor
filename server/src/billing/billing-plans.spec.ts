import { BadRequestException } from '@nestjs/common';
import { getBillingPlan, paidBillingPlans } from './billing-plans';

describe('billing plans', () => {
  it('keeps Vietnamese-friendly Pro prices with USD display copy', () => {
    expect(paidBillingPlans).toEqual([
      expect.objectContaining({
        code: 'pro_monthly',
        amountVnd: 149000,
        displayAmountUsd: '~$5.99',
        durationDays: 30,
      }),
      expect.objectContaining({
        code: 'pro_yearly',
        amountVnd: 1490000,
        displayAmountUsd: '~$59.99',
        durationDays: 365,
      }),
    ]);
  });

  it('rejects unknown paid plan codes', () => {
    expect(() => getBillingPlan('enterprise')).toThrow(BadRequestException);
  });
});
