import { Controller, Post, Body, Get, Param, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // Initialize JazzCash payment
  @UseGuards(JwtAuthGuard)
  @Post('jazzcash/initiate')
  @ApiOperation({ summary: 'Initiate JazzCash payment' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  async initiateJazzCashPayment(
    @CurrentUser() user,
    @Body() body: { orderId: string }
  ) {
    return this.paymentsService.initializeJazzCashPayment(body.orderId);
  }

  // Initialize Easypaisa payment
  @UseGuards(JwtAuthGuard)
  @Post('easypaisa/initiate')
  @ApiOperation({ summary: 'Initiate Easypaisa payment' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  async initiateEasypaisaPayment(
    @CurrentUser() user,
    @Body() body: { orderId: string }
  ) {
    return this.paymentsService.initializeEasypaisaPayment(body.orderId);
  }

  // JazzCash callback endpoint (external)
  @Post('jazzcash/callback')
  @ApiOperation({ summary: 'JazzCash payment callback' })
  @ApiResponse({ status: 200, description: 'Callback processed successfully' })
  async processJazzCashCallback(@Body() callbackData: any) {
    return this.paymentsService.processJazzCashCallback(callbackData);
  }

  // Easypaisa callback endpoint (external)
  @Post('easypaisa/callback')
  @ApiOperation({ summary: 'Easypaisa payment callback' })
  @ApiResponse({ status: 200, description: 'Callback processed successfully' })
  async processEasypaisaCallback(@Body() callbackData: any) {
    return this.paymentsService.processEasypaisaCallback(callbackData);
  }

  // Get payment configurations for frontend
  @UseGuards(JwtAuthGuard)
  @Get('configs')
  @ApiOperation({ summary: 'Get payment gateway configurations' })
  @ApiResponse({ status: 200, description: 'Payment configs retrieved successfully' })
  async getPaymentConfigs(@CurrentUser() user) {
    return this.paymentsService.getPaymentConfigs();
  }

  // Webhook for payment status updates (if available)
  @Patch('webhook/:gateway')
  @ApiOperation({ summary: 'Handle payment gateway webhook' })
  async handleWebhook(
    @Param('gateway') gateway: 'jazzcash' | 'easypaisa',
    @Body() data: any
  ) {
    if (gateway === 'jazzcash') {
      return this.paymentsService.processJazzCashCallback(data);
    } else if (gateway === 'easypaisa') {
      return this.paymentsService.processEasypaisaCallback(data);
    }
    throw new Error('Invalid gateway');
  }
}