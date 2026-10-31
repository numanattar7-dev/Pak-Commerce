import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateOrderDto, VerifyOtpDto, UpdateOrderStatusDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(tenantId: string, dto: CreateOrderDto) {
    // Determine tenantId from subdomain if provided or fallback
    let targetTenantId = tenantId;
    if (!targetTenantId && dto.subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain: dto.subdomain },
      });
      if (tenant) {
        targetTenantId = tenant.id;
      }
    }

    if (!targetTenantId) {
      const firstTenant = await this.prisma.tenant.findFirst();
      targetTenantId = firstTenant?.id || '';
    }

    // Generate unique order number
    const orderNumber = `PK-${Date.now().toString(36).toUpperCase()}`;

    // Calculate totals
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Get shipping fee based on city
    const shippingFee = await this.getShippingFee(targetTenantId, dto.shippingCity);
    const totalAmount = subtotal + shippingFee;

    // Determine risk score based on phone/address patterns
    const riskScore = this.calculateRiskScore(dto);

    // Create order with items in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: targetTenantId,
          orderNumber,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail,
          shippingCity: dto.shippingCity,
          shippingAddress: dto.shippingAddress,
          paymentMethod: dto.paymentMethod,
          paymentStatus: 'PENDING',
          orderStatus: 'PENDING',
          riskScore,
          subtotal,
          shippingFee,
          totalAmount,
          notes: dto.notes,
        },
      });

      // Create order items and deduct stock
      for (const item of dto.items) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            variantId: item.variantId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          },
        });

        // Deduct stock
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
      }

      // Generate OTP for COD orders
      let otpCode = '';
      if (dto.paymentMethod === 'COD') {
        otpCode = this.generateOTP();
        await tx.codVerification.create({
          data: {
            orderId: newOrder.id,
            otpCode,
            isVerified: false,
          },
        });

        // Send OTP via SMS/WhatsApp (async, non-blocking)
        try {
          await Promise.all([
            this.notificationService.sendOtpSms(dto.customerPhone, otpCode, orderNumber),
            this.notificationService.sendWhatsAppOtp(dto.customerPhone, otpCode, orderNumber),
          ]);
        } catch (err) {
          console.error('[COD OTP Notification] Failed:', err);
        }

        console.log(`[COD OTP] Order ${orderNumber}: ${otpCode}`);
      }

      return newOrder;
    });

    return {
      ...order,
      otpRequired: dto.paymentMethod === 'COD',
    };
  }

  async verifyOtp(tenantId: string, dto: VerifyOtpDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
      include: { codVerification: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.codVerification) {
      throw new BadRequestException('COD verification not required for this order');
    }

    if (order.codVerification.isVerified) {
      throw new BadRequestException('OTP already verified');
    }

    if (order.codVerification.otpCode !== dto.otpCode) {
      // Increment attempts
      await this.prisma.codVerification.update({
        where: { id: order.codVerification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    // Mark as verified
    await this.prisma.codVerification.update({
      where: { id: order.codVerification.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'VERIFIED' },
    });

    return { success: true, message: 'Order verified successfully' };
  }

  async findAll(tenantId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (status) {
      where.orderStatus = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          codVerification: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        codVerification: true,
        bankProof: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(tenantId, id);

    return this.prisma.order.update({
      where: { id },
      data: { orderStatus: dto.status },
    });
  }

  // Public: Get order by phone for tracking
  async trackOrder(tenantId: string, orderNumber: string, phone: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber,
        customerPhone: phone,
      },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // Helper methods
  private async getShippingFee(tenantId: string, city: string) {
    const rule = await this.prisma.shippingRule.findFirst({
      where: { tenantId, city },
    });

    if (rule) {
      return Number(rule.rate);
    }

    // Default shipping fee for unknown cities
    return 200;
  }

  private calculateRiskScore(dto: CreateOrderDto): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Simple risk scoring logic
    let score = 0;

    // New phone number pattern (starts with 03 but could be fake)
    if (!dto.customerPhone.match(/^03\d{9}$/)) {
      score += 1;
    }

    // Short address
    if (dto.shippingAddress.length < 15) {
      score += 1;
    }

    // High value order
    const total = dto.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (total > 50000) {
      score += 1;
    }

    if (score >= 2) return 'HIGH';
    if (score === 1) return 'MEDIUM';
    return 'LOW';
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}