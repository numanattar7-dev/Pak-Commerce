import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user) {
    return this.analyticsService.summary(user.tenantId);
  }

  @Get('revenue-series')
  revenueSeries(
    @CurrentUser() user,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.revenueSeries(user.tenantId, days ? parseInt(days, 10) : 30);
  }

  @Get('top-products')
  topProducts(
    @CurrentUser() user,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.topProducts(user.tenantId, limit ? parseInt(limit, 10) : 5);
  }

  @Get('status-breakdown')
  statusBreakdown(@CurrentUser() user) {
    return this.analyticsService.statusBreakdown(user.tenantId);
  }
}
