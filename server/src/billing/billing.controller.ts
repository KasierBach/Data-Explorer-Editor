import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) { }

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckout(req.user.id, dto);
  }

  @Get('status/:paymentId')
  @UseGuards(JwtAuthGuard)
  getPaymentStatus(
    @Request() req: AuthenticatedRequest,
    @Param('paymentId') paymentId: string,
  ) {
    return this.billingService.getPaymentStatus(req.user.id, paymentId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  listHistory(@Request() req: AuthenticatedRequest) {
    return this.billingService.listHistory(req.user.id);
  }

  @Post('webhooks/momo')
  async handleMomoWebhook(@Body() payload: unknown) {
    return await this.billingService.handleProviderWebhook('momo', payload);
  }

  @Post('webhooks/zalopay')
  async handleZaloPayWebhook(@Body() payload: unknown) {
    await this.billingService.handleProviderWebhook('zalopay', payload);
    return { return_code: 1, return_message: 'success' };
  }
}
