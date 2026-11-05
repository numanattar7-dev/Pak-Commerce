import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { StorageService } from '../storage/storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [ThemesController],
  providers: [ThemesService, StorageService],
  exports: [ThemesService],
})
export class ThemesModule {}
