import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [HttpModule, PrismaModule, WebhooksModule],
  controllers: [PaymentsController, IntegrationsController],
  providers: [PaymentsService, IntegrationsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
