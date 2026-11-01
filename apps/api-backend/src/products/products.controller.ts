import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ProductsService } from './products.service';
import { CsvService } from './csv.service';
import { CreateProductDto, UpdateProductDto, CreateVariantDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private csvService: CsvService,
  ) {}

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

  // ---- CSV export / import (Shopify parity) ----
  @UseGuards(JwtAuthGuard)
  @Get('export/csv')
  async exportCsv(@CurrentUser() user, @Res() res: Response) {
    const csv = await this.csvService.exportCsv(user.tenantId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="products-export.csv"',
    );
    res.send(csv);
  }

  @UseGuards(JwtAuthGuard)
  @Post('import/csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @CurrentUser() user,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required (field name "file")');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('CSV file larger than 10MB');
    }
    return this.csvService.importCsv(user.tenantId, file.buffer);
  }

  // ---- Image upload → /uploads/<file> (served statically by the API) ----
  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@CurrentUser() user, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Image file is required (field name "file")',
      );
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXT.includes(ext)) {
      throw new BadRequestException(
        `Unsupported image type "${ext || 'unknown'}" — allowed: ${ALLOWED_IMAGE_EXT.join(', ')}`,
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image larger than 5MB');
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);

    return { url: `/uploads/${filename}`, size: file.size };
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