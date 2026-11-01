import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  CollectionProductsDto,
} from './dto';

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------
  // Admin CRUD (tenant-scoped)
  // ------------------------------------------------------

  list(tenantId: string) {
    return this.prisma.collection.findMany({
      where: { tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { position: 'asc' },
          include: { product: { include: { variants: true } } },
        },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.tenantId !== tenantId) throw new ForbiddenException();
    return collection;
  }

  async create(tenantId: string, dto: CreateCollectionDto) {
    const handle = await this.normalizeHandle(tenantId, dto.handle, dto.title);
    await this.assertProductsBelongToTenant(tenantId, dto.productIds ?? []);

    const collection = await this.prisma.collection.create({
      data: {
        tenantId,
        title: dto.title,
        handle,
        isActive: dto.isActive ?? true,
        products: {
          create: (dto.productIds ?? []).map((productId, position) => ({
            productId,
            position,
          })),
        },
      },
      include: { products: { orderBy: { position: 'asc' } } },
    });
    return collection;
  }

  async update(tenantId: string, id: string, dto: UpdateCollectionDto) {
    await this.findOwned(tenantId, id);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.handle !== undefined && dto.handle !== '') {
      const handle = await this.normalizeHandle(tenantId, dto.handle, dto.handle);
      if (handle.toLowerCase() !== '') data.handle = handle;
    }

    // productIds present ⇒ Shopify-style full replacement of membership
    if (dto.productIds !== undefined) {
      await this.assertProductsBelongToTenant(tenantId, dto.productIds);
      data.products = {
        deleteMany: {},
        create: dto.productIds.map((productId, position) => ({
          productId,
          position,
        })),
      };
    }

    const updated = await this.prisma.collection.update({
      where: { id },
      data,
      include: { products: { orderBy: { position: 'asc' }, include: { product: true } } },
    });
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.prisma.collection.delete({ where: { id } });
    return { deleted: true };
  }

  async addProducts(tenantId: string, id: string, dto: CollectionProductsDto) {
    await this.findOwned(tenantId, id);
    await this.assertProductsBelongToTenant(tenantId, dto.productIds);

    const existing = await this.prisma.collectionProduct.count({
      where: { collectionId: id },
    });

    await this.prisma.collectionProduct.createMany({
      data: dto.productIds.map((productId, i) => ({
        collectionId: id,
        productId,
        position: existing + i,
      })),
      skipDuplicates: true,
    });
    return this.findOne(tenantId, id);
  }

  async removeProducts(tenantId: string, id: string, dto: CollectionProductsDto) {
    await this.findOwned(tenantId, id);
    const res = await this.prisma.collectionProduct.deleteMany({
      where: { collectionId: id, productId: { in: dto.productIds } },
    });
    return { removed: res.count };
  }

  // ------------------------------------------------------
  // Public storefront endpoint — server-sells products, active only
  // ------------------------------------------------------

  async findByStore(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { subdomain } });
    if (!tenant) return { store: null, data: [] };

    const collections = await this.prisma.collection.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        products: {
          orderBy: { position: 'asc' },
          include: { product: { include: { variants: true } } },
        },
      },
    });

    // Keep only memberships whose product is active
    return {
      store: {
        name: tenant.name,
        subdomain: tenant.subdomain,
        bannerUrl: tenant.bannerUrl,
      },
      data: collections
        .map((c) => ({
          id: c.id,
          title: c.title,
          handle: c.handle,
          products: c.products
            .filter((cp) => cp.product !== null && cp.product.isActive)
            .map((cp) => cp.product),
        }))
        .filter((c) => c.products.length > 0),
    };
  }

  // ------------------------------------------------------
  // Helpers
  // ------------------------------------------------------

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\u0600-\u06FF\s-]/g, '') // keep letters (incl Arabic/Urdu), numbers, space, dash
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async normalizeHandle(
    tenantId: string,
    explicit: string | undefined,
    title: string,
  ) {
    const base =
      this.slugify(explicit ?? title) || `collection-${Date.now().toString(36)}`;
    let candidate = base;
    let n = 2;
    // Uniqueness is per tenant (Shopify parity)
    while (
      await this.prisma.collection.findFirst({
        where: { tenantId, handle: candidate },
      })
    ) {
      candidate = `${base}-${n++}`;
    }
    return candidate;
  }

  private async assertProductsBelongToTenant(
    tenantId: string,
    productIds: string[],
  ) {
    if (!productIds.length) return;
    const owned = await this.prisma.product.count({
      where: { id: { in: productIds }, tenantId },
    });
    if (owned !== productIds.length) {
      throw new BadRequestException(
        'One or more products do not belong to this store',
      );
    }
  }

  private async findOwned(tenantId: string, id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.tenantId !== tenantId) throw new ForbiddenException();
    return collection;
  }
}
