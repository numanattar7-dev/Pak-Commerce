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
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto, UpdateDiscountDto, ValidateDiscountDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('discounts')
export class DiscountsController {
  constructor(private discountsService: DiscountsService) {}

  // ---------------- Admin (JWT-protected) ----------------

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user, @Body() dto: CreateDiscountDto) {
    return this.discountsService.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.discountsService.findAll(user.tenantId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status: status || undefined,
      search: search || undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.discountsService.findOne(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/usage')
  async usage(@CurrentUser() user, @Param('id') id: string) {
    return this.discountsService.getUsage(user.tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountsService.update(user.tenantId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() user, @Param('id') id: string) {
    return this.discountsService.remove(user.tenantId, id);
  }

  // ---------------- Public (storefront checkout preview) ----------------

  @Post('validate')
  async validate(@Body() dto: ValidateDiscountDto) {
    return this.discountsService.validateForStore(dto.subdomain, {
      code: dto.code,
      subtotal: dto.subtotal,
      shippingFee: dto.shippingFee ?? 0,
      customerPhone: dto.phone,
    });
  }
}
