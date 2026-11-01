import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShippingRuleDto, UpdateShippingRuleDto } from './dto';

@Injectable()
export class ShippingRulesService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const rules = await this.prisma.shippingRule.findMany({
      where: { tenantId },
      orderBy: [{ city: 'asc' }],
    });
    return rules;
  }

  async create(tenantId: string, dto: CreateShippingRuleDto) {
    // one rule per city per tenant — upsert semantics on re-adding
    const existing = await this.prisma.shippingRule.findFirst({
      where: { tenantId, city: dto.city },
    });
    if (existing) {
      return this.prisma.shippingRule.update({
        where: { id: existing.id },
        data: { rate: dto.rate, isFreeAbove: dto.isFreeAbove ?? null },
      });
    }
    return this.prisma.shippingRule.create({
      data: {
        tenantId,
        city: dto.city,
        rate: dto.rate,
        isFreeAbove: dto.isFreeAbove ?? null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateShippingRuleDto) {
    const rule = await this.prisma.shippingRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Shipping rule not found');
    const data: any = {};
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.rate !== undefined) data.rate = dto.rate;
    if (dto.isFreeAbove !== undefined) data.isFreeAbove = dto.isFreeAbove;
    return this.prisma.shippingRule.update({ where: { id: rule.id }, data });
  }

  async remove(tenantId: string, id: string) {
    const rule = await this.prisma.shippingRule.findFirst({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('Shipping rule not found');
    await this.prisma.shippingRule.delete({ where: { id: rule.id } });
    return { deleted: true, id: rule.id };
  }
}
