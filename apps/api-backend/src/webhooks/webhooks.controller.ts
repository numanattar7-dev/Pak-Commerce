import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto, WEBHOOK_EVENTS } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentUser() user) {
    return this.webhooksService.list(user.tenantId);
  }

  @Get('events')
  events() {
    return { events: WEBHOOK_EVENTS };
  }

  @Post()
  create(@CurrentUser() user, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(user.tenantId, dto);
  }

  @Get(':id/deliveries')
  listDeliveries(
    @CurrentUser() user,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooksService.listDeliveries(user.tenantId, id, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/test')
  sendTest(@CurrentUser() user, @Param('id') id: string) {
    return this.webhooksService.sendTest(user.tenantId, id);
  }

  @Put(':id')
  update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.webhooksService.remove(user.tenantId, id);
  }
}
