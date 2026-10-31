import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    options: {
      page: number;
      limit: number;
      search?: string;
    },
  ) {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        addresses: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentMethod: true,
            paymentStatus: true,
            orderStatus: true,
            riskScore: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async create(tenantId: string, dto: CreateCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { tenantId, phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException('Customer with this phone already exists');
    }

    const normalizedEmail = dto.email?.trim() || null;

    return this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: normalizedEmail,
        tags: dto.tags || [],
        notes: dto.notes,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(tenantId, id);

    return this.prisma.customer.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);

    // Orders keep integrity via onDelete: SetNull on customerId
    await this.prisma.customer.delete({ where: { id } });
    return { success: true };
  }

  private async ensureExists(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }
}
