import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IntegrationsService } from './integrations.service';
import { UpsertIntegrationDto } from './dto';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /** Masked credential list — field names only, never secret values. */
  @Get()
  list(@CurrentUser() user) {
    return this.integrationsService.list(user.tenantId);
  }

  /** Upsert credentials for a provider. Blank values keep stored secrets. */
  @Put(':provider')
  upsert(
    @CurrentUser() user,
    @Param('provider') provider: string,
    @Body() dto: UpsertIntegrationDto,
  ) {
    return this.integrationsService.upsert(user.tenantId, provider, dto);
  }
}
