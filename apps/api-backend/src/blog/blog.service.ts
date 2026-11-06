import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto';

const MAX_CONTENT = 40000;
const MAX_HANDLE = 80;

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────
  // Public storefront
  // ─────────────────────────────────────────────────────────────────────
  async listPublic(subdomain: string, page = 1, limit = 12) {
    const take = Math.min(Math.max(Number(limit) || 12, 1), 24);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ subdomain: subdomain.toLowerCase() }, { customDomain: subdomain }] },
      select: { id: true },
    });
    if (!tenant) return { data: [], meta: { total: 0, page: 1, limit: take, totalPages: 0 } };
    const where = { tenantId: tenant.id, isPublished: true };
    const [total, posts] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        select: {
          id: true, title: true, handle: true, excerpt: true, author: true,
          imageUrl: true, publishedAt: true, createdAt: true,
        },
      }),
    ]);
    return {
      data: posts,
      meta: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  async getPublic(subdomain: string, handle: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ subdomain: subdomain.toLowerCase() }, { customDomain: subdomain }] },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Store not found');
    const post = await this.prisma.blogPost.findFirst({
      where: { tenantId: tenant.id, handle: handle.toLowerCase(), isPublished: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Admin (tenant-scoped)
  // ─────────────────────────────────────────────────────────────────────
  async list(tenantId: string, q = '', status: 'all' | 'published' | 'draft' = 'all', page = 1, limit = 20) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const where: any = { tenantId };
    if (status === 'published') where.isPublished = true;
    else if (status === 'draft') where.isPublished = false;
    if (q.trim()) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { handle: { contains: q.trim(), mode: 'insensitive' } },
        { author: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const [total, posts] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take,
      }),
    ]);
    return { data: posts, meta: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.max(1, Math.ceil(total / take)) } };
  }

  async getOne(tenantId: string, id: string) {
    const p = await this.prisma.blogPost.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Post not found');
    return p;
  }

  async create(tenantId: string, dto: CreateBlogPostDto) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Title is required');
    const handle = await this.normalizeHandle(tenantId, dto.handle, title);
    if (dto.content.length > MAX_CONTENT) {
      throw new BadRequestException('Content too large');
    }
    this.assertImageUrl(dto.imageUrl);
    return this.prisma.blogPost.create({
      data: {
        id: randomUUID(),
        tenantId,
        title,
        handle,
        excerpt: dto.excerpt.trim(),
        content: dto.content,
        author: dto.author?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        seoTitle: dto.seoTitle?.trim() || null,
        seoDescription: dto.seoDescription?.trim() || null,
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBlogPostDto) {
    const existing = await this.prisma.blogPost.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Post not found');
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Title is required');
    }

    let handle = existing.handle;
    if (dto.handle !== undefined && dto.handle !== existing.handle) {
      handle = await this.normalizeHandle(tenantId, dto.handle, dto.handle);
    }
    if (dto.content !== undefined && dto.content.length > MAX_CONTENT) {
      throw new BadRequestException('Content too large');
    }
    if (dto.imageUrl !== undefined) {
      this.assertImageUrl(dto.imageUrl);
    }

    const willPublish = dto.isPublished === true && !existing.isPublished;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.handle !== undefined ? { handle } : {}),
        ...(dto.excerpt !== undefined ? { excerpt: dto.excerpt.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.author !== undefined ? { author: dto.author?.trim() || null } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl?.trim() || null } : {}),
        ...(dto.seoTitle !== undefined ? { seoTitle: dto.seoTitle?.trim() || null } : {}),
        ...(dto.seoDescription !== undefined ? { seoDescription: dto.seoDescription?.trim() || null } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(willPublish ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async duplicate(tenantId: string, id: string) {
    const src = await this.prisma.blogPost.findFirst({ where: { id, tenantId } });
    if (!src) throw new NotFoundException('Post not found');
    const handle = await this.normalizeHandle(tenantId, undefined, `${src.title} copy`);
    return this.prisma.blogPost.create({
      data: {
        id: randomUUID(),
        tenantId,
        title: `${src.title} (copy)`.slice(0, 200),
        handle,
        excerpt: src.excerpt,
        content: src.content,
        author: src.author,
        imageUrl: src.imageUrl,
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
        isPublished: false,
        publishedAt: null,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const p = await this.prisma.blogPost.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Post not found');
    await this.prisma.blogPost.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────────────
  // helpers
  // ─────────────────────────────────────────────────────────────────────
  private slugify(s: string) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_HANDLE);
  }

  /** Featured images may be absolute http(s) URLs or root-relative upload paths. */
  private assertImageUrl(url?: string) {
    if (url === undefined) return;
    const value = url.trim();
    if (!value) return;
    if (value.length > 500 || /[<>"'\\]/.test(value) || !/^(https?:\/\/|\/(?!\/))/i.test(value)) {
      throw new BadRequestException('imageUrl must be an http(s) URL or a root-relative path');
    }
  }

  private async normalizeHandle(tenantId: string, explicit: string | undefined, fallbackTitle: string) {
    const base =
      (this.slugify(explicit ?? fallbackTitle) || `post-${Date.now().toString(36)}`).slice(
        0,
        MAX_HANDLE - 10,
      );
    let candidate = base;
    let n = 2;
    while (
      await this.prisma.blogPost.findFirst({ where: { tenantId, handle: candidate } })
    ) {
      candidate = `${base}-${n++}`.slice(0, MAX_HANDLE);
    }
    return candidate;
  }
}
