import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStorePageDto, UpdateStorePageDto, UpsertStoreSettingsDto } from './dto';

const MAX_CONFIG_SIZE = 65536; // 64 KB — rich section/block content needs headroom
const MAX_PAGE_CONTENT = 20000;

@Injectable()
export class StoreSettingsService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------
  // Settings
  // ------------------------------------------------------

  /** Admin — own tenant's customization config (deep-merged with {} on first read). */
  async getMine(tenantId: string) {
    const row = await this.prisma.storeSettings.findUnique({ where: { tenantId } });
    return {
      config: row ? this.parse(row.configJson) : {},
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async updateMine(tenantId: string, dto: UpsertStoreSettingsDto) {
    const json = JSON.stringify(dto.config ?? {});
    if (json.length > MAX_CONFIG_SIZE) {
      throw new BadRequestException('Store settings payload too large');
    }
    // Keep the PUBLISHED theme in the library in sync with the live editor —
    // otherwise "published theme" and the storefront would drift apart.
    const saved = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.storeSettings.upsert({
        where: { tenantId },
        create: { tenantId, configJson: json },
        update: { configJson: json },
      });
      const published = await tx.theme.findFirst({
        where: { tenantId, status: 'PUBLISHED' },
        select: { id: true },
      });
      if (published) {
        await tx.theme.update({ where: { id: published.id }, data: { configJson: json } });
      }
      return upserted;
    });
    return { config: this.parse(saved.configJson), updatedAt: saved.updatedAt };
  }

  /** Public — full customization config for a storefront (no secrets stored here). */
  async getPublic(subdomain: string) {
    const tenant = await this.tenantBySubdomain(subdomain);
    const row = await this.prisma.storeSettings.findUnique({
      where: { tenantId: tenant.id },
    });
    return {
      store: {
        name: tenant.name,
        subdomain: tenant.subdomain,
        logoUrl: tenant.logoUrl,
        bannerUrl: tenant.bannerUrl,
        phoneSupport: tenant.phoneSupport,
      },
      config: row ? this.parse(row.configJson) : {},
    };
  }

  // ------------------------------------------------------
  // Custom pages (About Us, FAQ, Privacy…)
  // ------------------------------------------------------

  listPages(tenantId: string) {
    return this.prisma.storePage.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createPage(tenantId: string, dto: CreateStorePageDto) {
    const slug = this.slugify(dto.slug || dto.title);
    await this.assertSlugFree(tenantId, slug);
    if ((dto.content || '').length > MAX_PAGE_CONTENT) {
      throw new BadRequestException('Page content too large');
    }
    return this.prisma.storePage.create({
      data: {
        tenantId,
        slug,
        title: dto.title.trim(),
        content: dto.content || '',
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async updatePage(tenantId: string, id: string, dto: UpdateStorePageDto) {
    const page = await this.prisma.storePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Page not found');

    let slug = page.slug;
    if (dto.slug && dto.slug !== page.slug) {
      slug = this.slugify(dto.slug);
      await this.assertSlugFree(tenantId, slug, id);
    }
    if (dto.content !== undefined && dto.content.length > MAX_PAGE_CONTENT) {
      throw new BadRequestException('Page content too large');
    }

    return this.prisma.storePage.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.slug ? { slug } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });
  }

  async deletePage(tenantId: string, id: string) {
    const page = await this.prisma.storePage.findFirst({ where: { id, tenantId } });
    if (!page) throw new NotFoundException('Page not found');
    await this.prisma.storePage.delete({ where: { id } });
    return { deleted: true };
  }

  listPublicPages(subdomain: string) {
    return this.prisma.storePage.findMany({
      where: {
        isPublished: true,
        tenant: { OR: [{ subdomain: subdomain.toLowerCase() }, { customDomain: subdomain }] },
      },
      select: { slug: true, title: true, updatedAt: true },
      orderBy: { title: 'asc' },
    });
  }

  async getPublicPage(subdomain: string, slug: string) {
    const page = await this.prisma.storePage.findFirst({
      where: {
        slug: slug.toLowerCase(),
        isPublished: true,
        tenant: { OR: [{ subdomain: subdomain.toLowerCase() }, { customDomain: subdomain }] },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  // ------------------------------------------------------
  // helpers
  // ------------------------------------------------------

  private slugify(s: string) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private async assertSlugFree(tenantId: string, slug: string, exceptId?: string) {
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
      throw new BadRequestException('Slug must be letters, numbers and dashes only');
    }
    const clash = await this.prisma.storePage.findFirst({ where: { tenantId, slug } });
    if (clash && clash.id !== exceptId) {
      throw new BadRequestException(`A page with slug "${slug}" already exists`);
    }
  }

  private async tenantBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ subdomain: subdomain.trim().toLowerCase() }, { customDomain: subdomain.trim() }] },
    });
    if (!tenant) throw new NotFoundException('Store not found');
    return tenant;
  }

  private parse(json: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
