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
import { CollectionsService } from './collections.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionProductsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('collections')
export class CollectionsController {
  constructor(private collectionsService: CollectionsService) {}

  // ---- Public storefront endpoint ----
  @Get('store/:subdomain')
  findByStore(@Param('subdomain') subdomain: string) {
    return this.collectionsService.findByStore(subdomain);
  }

  // ---- Admin CRUD ----
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user) {
    return this.collectionsService.list(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/:id')
  findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.collectionsService.findOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.collectionsService.remove(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/products')
  addProducts(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ) {
    return this.collectionsService.addProducts(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/products')
  removeProducts(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ) {
    return this.collectionsService.removeProducts(user.tenantId, id, dto);
  }
}
