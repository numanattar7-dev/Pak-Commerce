import { Module } from '@nestjs/common';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [WebhooksModule, NotificationModule],
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
