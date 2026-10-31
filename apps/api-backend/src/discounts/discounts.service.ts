import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountDto, UpdateDiscountDto } from './dto';
import { Discount } from '@prisma/client';

export interface DiscountEvaluation {
  valid: boolean;
  reason?: string;
  discount?: Discount;
  discountAmount?: number;
}

interface EvaluateInput {
  code: string;
  subtotal: number;
  shippingFee: number;
  customerPhone?: string;
}

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------
  // Admin CRUD
  // ------------------------------------------------------

  async create(tenantId: string, dto: CreateDiscountDto) {
    const code = this.normalizeCode(dto.code);

    if (dto.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const existing = await this.prisma.discount.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new ConflictException(`Discount code "${code}" already exists`);
    }

    return this.prisma.discount.create({
      data: {
        tenantId,
        code,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        minSubtotal: dto.minSubtotal ?? null,
        maxUses: dto.maxUses ?? null,
        firstOnly: dto.firstOnly ?? false,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: true,
      },
    });
  }

  async findAll(
    tenantId: string,
    options: { page: number; limit: number; status?: string; search?: string },
  ) {
    const { page, limit, status, search } = options;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = { tenantId };
    if (search) {
      where.code = { contains: search, mode: 'insensitive' };
    }
    if (status === 'active') {
      where.isActive = true;
      where.OR = [
        { endsAt: null },
        { endsAt: { gte: now } },
      ];
    } else if (status === 'expired') {
      where.OR = [
        { isActive: false },
        { AND: [{ endsAt: { not: null } }, { endsAt: { lt: now } }] },
      ];
    }

    const [discounts, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.discount.count({ where }),
    ]);

    return {
      data: discounts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const discount = await this.prisma.discount.findFirst({
      where: { id, tenantId },
    });
    if (!discount) {
      throw new NotFoundException('Discount not found');
    }
    return discount;
  }

  async update(tenantId: string, id: string, dto: UpdateDiscountDto) {
    const discount = await this.findOne(tenantId, id);

    if (dto.value !== undefined && discount.type === 'PERCENTAGE' && dto.value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const data: any = { ...dto };
    if (dto.startsAt === null) {
      data.startsAt = null;
    } else if (dto.startsAt !== undefined) {
      data.startsAt = new Date(dto.startsAt);
    }
    if (dto.endsAt === null) {
      data.endsAt = null;
    } else if (dto.endsAt !== undefined) {
      data.endsAt = new Date(dto.endsAt);
    }

    return this.prisma.discount.update({
      where: { id: discount.id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const discount = await this.findOne(tenantId, id);

    // Orders keep their snapshot via onDelete: SetNull on discountId
    const usedCount = await this.prisma.order.count({
      where: { discountId: discount.id },
    });

    // Soft-safety: orders reference it; only hard-delete when never used
    if (usedCount > 0) {
      await this.prisma.discount.update({
        where: { id: discount.id },
        data: { isActive: false },
      });
      return {
        success: true,
        mode: 'deactivated',
        message: 'Discount was used in existing orders — deactivated instead of deleting.',
      };
    }

    await this.prisma.discount.delete({ where: { id: discount.id } });
    return { success: true, mode: 'deleted' };
  }

  async getUsage(tenantId: string, id: string) {
    const discount = await this.findOne(tenantId, id);

    const ordersAgg = await this.prisma.order.aggregate({
      where: { discountId: discount.id },
      _count: { _all: true },
      _sum: { discountAmount: true, totalAmount: true },
    });

    return {
      discount: {
        id: discount.id,
        code: discount.code,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
      },
      ordersUsing: ordersAgg._count._all,
      totalSaved: ordersAgg._sum.discountAmount || 0,
      totalOrderValue: ordersAgg._sum.totalAmount || 0,
    };
  }

  // ------------------------------------------------------
  // Checkout evaluation (used by validate endpoint + orders.create)
  // ------------------------------------------------------

  /**
   * Storefront checkout preview: resolve store by subdomain, then evaluate.
   * Never throws — returns a friendly evaluation.
   */
  async validateForStore(
    subdomain: string,
    input: EvaluateInput,
  ): Promise<DiscountEvaluation> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (!tenant) {
      return { valid: false, reason: 'Store not found' };
    }
    return this.evaluateForTenant(tenant.id, input);
  }

  /**
   * Tenant-safe evaluation — use from controllers/views.
   * Pure check: does this code apply to THIS cart (no usage consumption).
   * Returns a friendly evaluation — never throws. Tenant scoping enforced.
   */
  async evaluateForTenant(
    tenantId: string,
    input: EvaluateInput,
  ): Promise<DiscountEvaluation> {
    const code = this.normalizeCode(input.code);
    if (!code) {
      return { valid: false, reason: 'Discount code is required' };
    }

    const discount = await this.prisma.discount.findFirst({
      where: { tenantId, code },
    });

    if (!discount) {
      return { valid: false, reason: 'Discount code not found' };
    }

    const now = new Date();

    if (!discount.isActive) {
      return { valid: false, reason: 'This discount code is paused' };
    }
    if (discount.startsAt && now < discount.startsAt) {
      return { valid: false, reason: 'This code is not active yet' };
    }
    if (discount.endsAt && now > discount.endsAt) {
      return { valid: false, reason: 'This code has expired' };
    }
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      return { valid: false, reason: 'This code has reached its usage limit' };
    }
    if (
      discount.minSubtotal !== null &&
      input.subtotal < discount.minSubtotal
    ) {
      return {
        valid: false,
        reason: `Minimum order of Rs.${discount.minSubtotal} required for this code`,
      };
    }
    if (discount.firstOnly && input.customerPhone) {
      const priorOrders = await this.prisma.order.count({
        where: { tenantId, customerPhone: input.customerPhone },
      });
      if (priorOrders > 0) {
        return { valid: false, reason: 'This code is valid for first orders only' };
      }
    }

    const discountAmount = this.computeDiscountAmount(
      discount,
      input.subtotal,
      input.shippingFee,
    );

    return { valid: true, discount, discountAmount };
  }

  /**
   * Server-side money math — the ONLY place discount amounts are computed.
   */
  computeDiscountAmount(
    discount: Discount,
    subtotal: number,
    shippingFee: number,
  ): number {
    let amount = 0;
    switch (discount.type) {
      case 'PERCENTAGE':
        amount = subtotal * (discount.value / 100);
        break;
      case 'FIXED':
        amount = discount.value;
        break;
      case 'FREE_SHIPPING':
        amount = shippingFee;
        break;
    }
    // Cap so totals can never go negative
    const maxPossible = subtotal + shippingFee;
    return this.round2(Math.max(0, Math.min(amount, maxPossible)));
  }

  round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  normalizeCode(code: string): string {
    return (code || '').trim().toUpperCase();
  }
}
