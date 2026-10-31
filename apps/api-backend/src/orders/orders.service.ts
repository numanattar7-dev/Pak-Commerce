import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateOrderDto, VerifyOtpDto, UpdateOrderStatusDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(tenantId: string, dto: CreateOrderDto) {
    // Resolve tenant: authenticated tenantId wins, otherwise subdomain is REQUIRED
    // (no more silent fallback to a random tenant)
    let targetTenantId = tenantId;
    if (!targetTenantId && dto.subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain: dto.subdomain },
      });
      if (!tenant) {
        throw new BadRequestException('Store not found for this subdomain');
      }
      targetTenantId = tenant.id;
    }

    if (!targetTenantId) {
      throw new BadRequestException('Store context missing: login or provide store subdomain');
    }

    // SECURITY: prices/titles always come from the database — client values are ignored
    const variantIds = dto.items.map((item) => item.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    const pricedItems = [];
    for (const item of dto.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        throw new BadRequestException(`Product variant not found: ${item.variantId}`);
      }
      // Prevent cross-tenant orders (variant of another store)
      if (variant.product.tenantId !== targetTenantId) {
        throw new BadRequestException('This product does not belong to this store');
      }
      // Stock pre-check
      if (variant.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${variant.title}" (available: ${variant.stockQuantity})`,
        );
      }
      subtotal += variant.price * item.quantity;
      pricedItems.push({ ...item, title: variant.title, price: variant.price });
    }

    // Generate unique order number
    const orderNumber = `PK-${Date.now().toString(36).toUpperCase()}`;

    // Get shipping fee based on city
    const shippingFee = await this.getShippingFee(targetTenantId, dto.shippingCity);
    const totalAmount = subtotal + shippingFee;

    // Determine risk score based on server-verified data
    const riskScore = this.calculateRiskScore(dto, subtotal);

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

      // Create order items and deduct stock atomically (oversell guard)
      for (const item of pricedItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            variantId: item.variantId,
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          },
        });

        // Atomic decrement only if stock is still sufficient
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });
        if (updated.count === 0) {
          // Throwing inside $transaction rolls back the whole order
          throw new BadRequestException(
            `Stock changed while placing order for "${item.title}". Please retry.`,
          );
        }
      }

      // Generate OTP for COD orders
      if (dto.paymentMethod === 'COD') {
        const otpCode = this.generateOTP();
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
    const order = await this.findOne(tenantId, id);

    const data: any = { orderStatus: dto.status };

    // Business rule: COD cash is physically collected at delivery
    if (dto.status === 'DELIVERED' && order.paymentMethod === 'COD') {
      data.paymentStatus = 'PAID';
    }

    // Restore stock when an active order is cancelled/RTO'd
    const wasActive = order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'RTO';
    const nowClosed = dto.status === 'CANCELLED' || dto.status === 'RTO';
    if (nowClosed && wasActive) {
      await this.prisma.$transaction(
        order.items.map((item) =>
          this.prisma.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          }),
        ),
      );
    }

    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  // Public: Get order by phone for tracking
  async trackOrder(subdomain: string, orderNumber: string, phone: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (!tenant) {
      throw new NotFoundException('Store not found');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
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

  private calculateRiskScore(
    dto: CreateOrderDto,
    subtotal: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    // Simple risk scoring logic (uses server-computed subtotal)
    let score = 0;

    // Phone pattern check
    if (!dto.customerPhone.match(/^03\d{9}$/)) {
      score += 1;
    }

    // Short address
    if (dto.shippingAddress.length < 15) {
      score += 1;
    }

    // High value order
    if (subtotal > 50000) {
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
