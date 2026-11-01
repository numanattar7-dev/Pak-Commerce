import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { CsvService } from './csv.service';

@Module({
  controllers: [ProductsController, CollectionsController],
  providers: [ProductsService, CollectionsService, CsvService],
  exports: [ProductsService],
})
export class ProductsModule {}
