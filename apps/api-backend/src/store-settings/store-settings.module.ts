import { Module } from '@nestjs/common';
import { StoreSettingsController, StorePagesController } from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StoreSettingsController, StorePagesController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
