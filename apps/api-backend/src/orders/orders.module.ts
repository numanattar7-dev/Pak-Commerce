import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { NotificationModule } from '../notifications/notification.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [NotificationModule, DiscountsModule, WebhooksModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}