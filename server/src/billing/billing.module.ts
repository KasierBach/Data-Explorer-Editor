import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService, PAYMENT_PROVIDER_ADAPTERS } from './billing.service';
import { MomoProvider } from './providers/momo.provider';
import { ZaloPayProvider } from './providers/zalopay.provider';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    MomoProvider,
    ZaloPayProvider,
    {
      provide: PAYMENT_PROVIDER_ADAPTERS,
      useFactory: (momo: MomoProvider, zaloPay: ZaloPayProvider) => [
        momo,
        zaloPay,
      ],
      inject: [MomoProvider, ZaloPayProvider],
    },
  ],
})
export class BillingModule {}
