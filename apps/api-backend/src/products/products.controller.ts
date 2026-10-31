import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, CreateVariantDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productsService.findAll(
      user.tenantId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.productsService.findOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@CurrentUser() user, @Param('id') id: string) {
    return this.productsService.delete(user.tenantId, id);
  }

  // Variants
  @UseGuards(JwtAuthGuard)
  @Post(':productId/variants')
  async addVariant(
    @CurrentUser() user,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.addVariant(user.tenantId, productId, dto);
  }

  // Public Storefront Endpoints
  @Get('store/:subdomain')
  async findBySubdomain(
    @Param('subdomain') subdomain: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productsService.findBySubdomain(
      subdomain,
      parseInt(page),
      parseInt(limit),
    );
  }
}