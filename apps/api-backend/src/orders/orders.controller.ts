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
import { CreateOrderDto, VerifyOtpDto, UpdateOrderStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async createUnauthenticated(@Body() dto: CreateOrderDto) {
    return this.ordersService.create('', dto);
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