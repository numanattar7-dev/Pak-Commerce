import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getAvailableSubdomains(tenantId: string) {
    // Generate some sample subdomains
    return {
      available: [
        `store1`,
        `shop2`,
        `marketplace`,
        `brandofficial`,
        `shopnow`,
      ],
      taken: [],
    };
  }
}