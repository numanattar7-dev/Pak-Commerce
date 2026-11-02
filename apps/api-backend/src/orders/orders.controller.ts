import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  VerifyOtpDto,
  PublicVerifyOtpDto,
  PublicResendOtpDto,
  UpdateOrderStatusDto,
  CreateFulfillmentDto,
  CreateRefundDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async createUnauthenticated(@Body() dto: CreateOrderDto) {
    return this.ordersService.create('', dto);
  }

  // ---- Public COD OTP (customer side) — owned via order number + phone ----
  @Post('verify-otp')
  async verifyOtpPublic(@Body() dto: PublicVerifyOtpDto) {
    return this.ordersService.verifyOtpPublic(
      dto.subdomain,
      dto.orderNumber,
      dto.phone,
      dto.otpCode,
    );
  }

  @Post('resend-otp')
  async resendOtpPublic(@Body() dto: PublicResendOtpDto) {
    return this.ordersService.resendOtpPublic(
      dto.subdomain,
      dto.orderNumber,
      dto.phone,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll(
      user.tenantId,
      parseInt(page),
      parseInt(limit),
      status,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.ordersService.findOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/status')
  async updateStatus(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/verify-otp')
  async verifyOtp(@CurrentUser() user, @Body() dto: VerifyOtpDto) {
    return this.ordersService.verifyOtp(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/resend-otp')
  async resendOtp(@CurrentUser() user, @Param('id') id: string) {
    return this.ordersService.resendOtp(user.tenantId, id);
  }

  // ---- FBR POS (sandbox) ----
  @UseGuards(JwtAuthGuard)
  @Post(':id/fbr-invoice')
  async createFbrInvoice(@CurrentUser() user, @Param('id') id: string) {
    return this.ordersService.createFbrInvoice(user.tenantId, id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/fulfillments')
  async listFulfillments(@CurrentUser() user, @Param('id') id: string) {
    return this.ordersService.listFulfillments(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/fulfillments')
  async createFulfillment(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: CreateFulfillmentDto,
  ) {
    return this.ordersService.createFulfillment(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/refund')
  async refund(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.ordersService.createRefund(user.tenantId, id, dto, user.id);
  }

  // Public order tracking
  @Get('track/:orderNumber/:phone')
  async trackOrder(
    @Param('orderNumber') orderNumber: string,
    @Param('phone') phone: string,
    @Query('subdomain') subdomain?: string,
  ) {
    if (!subdomain) {
      throw new BadRequestException('subdomain query parameter is required');
    }
    return this.ordersService.trackOrder(subdomain, orderNumber, phone);
  }
}