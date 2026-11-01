import { Module } from '@nestjs/common';
import { ShippingRulesController } from './shipping-rules.controller';
import { ShippingRulesService } from './shipping-rules.service';

@Module({
  controllers: [ShippingRulesController],
  providers: [ShippingRulesService],
  exports: [ShippingRulesService],
})
export class ShippingRulesModule {}
