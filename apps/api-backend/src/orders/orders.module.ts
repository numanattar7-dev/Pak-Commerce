import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { NotificationModule } from '../notifications/notification.module';
import { DiscountsModule } from '../discounts/discounts.module';

@Module({
  imports: [NotificationModule, DiscountsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}