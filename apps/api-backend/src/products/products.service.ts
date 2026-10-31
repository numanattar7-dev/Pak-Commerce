import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, CreateVariantDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        tenantId,
        title: dto.title,
        titleUrdu: dto.titleUrdu,
        description: dto.description,
        descriptionUr: dto.descriptionUr,
        category: dto.category,
        tags: dto.tags || [],
        isHalal: dto.isHalal ?? true,
        images: dto.images || [],
      },
    });

    // Create default variant if price provided
    if (dto.price) {
      await this.prisma.productVariant.create({
        data: {
          productId: product.id,
          title: 'Default',
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
          stockQuantity: dto.stockQuantity ?? 0,
        },
      });
    }

    return this.findOne(tenantId, product.id);
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId },
        skip,
        take: limit,
        include: {
          variants: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { tenantId } }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(tenantId, id); // Verify ownership

    return this.prisma.product.update({
      where: { id },
      data: {
        title: dto.title,
        titleUrdu: dto.titleUrdu,
        description: dto.description,
        descriptionUr: dto.descriptionUr,
        category: dto.category,
        tags: dto.tags,
        isHalal: dto.isHalal,
        images: dto.images,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  // Variant Management
  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    await this.findOne(tenantId, productId);

    return this.prisma.productVariant.create({
      data: {
        productId,
        title: dto.title,
        sku: dto.sku,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        stockQuantity: dto.stockQuantity ?? 0,
        weightGrams: dto.weightGrams ?? 500,
      },
    });
  }

  async updateVariantStock(tenantId: string, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant || variant.product.tenantId !== tenantId) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: quantity },
    });
  }

  // Public storefront methods (no tenant filter needed for subdomain-based lookup)
  async findBySubdomain(subdomain: string, page = 1, limit = 20) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain, status: { in: ['ACTIVE', 'TRIAL'] } },
    });

    if (!tenant) {
      throw new NotFoundException('Store not found');
    }

    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId: tenant.id, isActive: true },
        skip,
        take: limit,
        include: { variants: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { tenantId: tenant.id, isActive: true } }),
    ]);

    return {
      store: { name: tenant.name, subdomain: tenant.subdomain },
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}