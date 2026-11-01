import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// FBR POS sandbox: invoice listing lives under /fbr (separate resource path)
@UseGuards(JwtAuthGuard)
@Controller('fbr')
export class FbrController {
  constructor(private ordersService: OrdersService) {}

  @Get('invoices')
  listInvoices(
    @CurrentUser() user,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.ordersService.listFbrInvoices(
      user.tenantId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 20,
    );
  }
}
