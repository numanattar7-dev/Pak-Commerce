import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { DiscountsModule } from './discounts/discounts.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CouriersModule } from './couriers/couriers.module';
import { ShippingRulesModule } from './shipping-rules/shipping-rules.module';
import { PaymentsModule } from './payments/payments.module';
import { StoreSettingsModule } from './store-settings/store-settings.module';
import { ThemesModule } from './themes/themes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    DiscountsModule,
    WebhooksModule,
    AnalyticsModule,
    CouriersModule,
    ShippingRulesModule,
    PaymentsModule,
    StoreSettingsModule,
    ThemesModule,
  ],
})
export class AppModule {}
