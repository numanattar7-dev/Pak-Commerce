import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StoreSettingsService } from './store-settings.service';
import { CreateStorePageDto, UpdateStorePageDto, UpsertStoreSettingsDto } from './dto';

@ApiTags('store-settings')
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly service: StoreSettingsService) {}

  // ---------------- public (storefront) ----------------

  /** Public — customization config + store identity for a storefront. */
  @Get('public/:subdomain')
  getPublic(@Param('subdomain') subdomain: string) {
    return this.service.getPublic(subdomain);
  }

  // ---------------- admin (JWT) ----------------

  @UseGuards(JwtAuthGuard)
  @Get()
  getMine(@CurrentUser() user) {
    return this.service.getMine(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  updateMine(@CurrentUser() user, @Body() dto: UpsertStoreSettingsDto) {
    return this.service.updateMine(user.tenantId, dto);
  }
}

@ApiTags('store-pages')
@Controller('store-pages')
export class StorePagesController {
  constructor(private readonly service: StoreSettingsService) {}

  // ---------------- public (storefront) ----------------

  @Get('public/:subdomain')
  listPublic(@Param('subdomain') subdomain: string) {
    return this.service.listPublicPages(subdomain);
  }

  @Get('public/:subdomain/:slug')
  getPublicOne(@Param('subdomain') subdomain: string, @Param('slug') slug: string) {
    return this.service.getPublicPage(subdomain, slug);
  }

  // ---------------- admin (JWT) ----------------

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user) {
    return this.service.listPages(user.tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateStorePageDto) {
    return this.service.createPage(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateStorePageDto) {
    return this.service.updatePage(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.service.deletePage(user.tenantId, id);
  }
}
