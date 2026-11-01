import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CouriersService } from './couriers.service';
import { BookShipmentDto, CourierRatesDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('couriers')
export class CouriersController {
  constructor(private couriersService: CouriersService) {}

  @Post('rates')
  rates(@Body() dto: CourierRatesDto) {
    return this.couriersService.rates(dto.city, dto.weightGrams ?? 500);
  }

  @Post('shipments')
  bookShipment(@CurrentUser() user, @Body() dto: BookShipmentDto) {
    return this.couriersService.bookShipment(user.tenantId, dto);
  }

  @Get('track/:trackingNumber')
  track(@CurrentUser() user, @Param('trackingNumber') trackingNumber: string) {
    return this.couriersService.track(trackingNumber);
  }
}
