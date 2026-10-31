import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getTenant(@CurrentUser() user) {
    return this.tenantsService.findById(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/subdomains')
  async getAvailableSubdomains(@CurrentUser() user) {
    return this.tenantsService.getAvailableSubdomains(user.tenantId);
  }
}