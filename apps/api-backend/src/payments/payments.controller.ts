import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import {
  InitiatePaymentDto,
  ListPaymentsQueryDto,
  RejectPaymentDto,
  SimulatePaymentDto,
  SubmitBankProofDto,
} from './dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ------------------------------------------------------------
  // Public (storefront) — ownership = subdomain + orderNumber + phone
  // ------------------------------------------------------------

  @Post('public/initiate')
  @ApiOperation({ summary: 'Start or resume payment for an order (wallet redirect / IBFT instructions)' })
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePublic(dto);
  }

  @Post('public/simulate/:gatewayTxRef')
  @ApiOperation({ summary: 'Sandbox simulation of the hosted checkout (disabled once real credentials exist)' })
  simulate(@Param('gatewayTxRef') gatewayTxRef: string, @Body() dto: SimulatePaymentDto) {
    return this.paymentsService.simulatePublic(gatewayTxRef, dto);
  }

  @Post('public/bank-proof')
  @ApiOperation({ summary: 'Submit bank-transfer proof for an IBFT/RAAST payment' })
  bankProof(@Body() dto: SubmitBankProofDto) {
    return this.paymentsService.submitBankProofPublic(dto);
  }

  // ------------------------------------------------------------
  // Gateway callbacks (server-to-server)
  // ------------------------------------------------------------

  @Post('callback/:gateway')
  callback(@Param('gateway') gateway: string, @Body() body: any) {
    return this.paymentsService.gatewayCallback(gateway, body);
  }

  // ------------------------------------------------------------
  // Admin (JWT)
  // ------------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user, @Query() query: ListPaymentsQueryDto) {
    return this.paymentsService.adminList(user.tenantId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  get(@CurrentUser() user, @Param('id') id: string) {
    return this.paymentsService.adminGet(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  approve(@CurrentUser() user, @Param('id') id: string) {
    return this.paymentsService.adminApprove(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reject')
  reject(@CurrentUser() user, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.paymentsService.adminReject(user.tenantId, id, dto.reason);
  }
}
