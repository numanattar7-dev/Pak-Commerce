import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { DiscountsService } from '../discounts/discounts.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CreateOrderDto, VerifyOtpDto, UpdateOrderStatusDto, CreateFulfillmentDto, CreateRefundDto } from './dto';
import { Discount } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private discountsService: DiscountsService,
    private webhooksService: WebhooksService,
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
    const pricedItems: { variantId: string; title: string; quantity: number; price: number }[] = [];
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

    // Discounts: evaluated server-side ONLY — the client just sends the code string
    let discount: Discount | null = null;
    let discountAmount = 0;
    if (dto.discountCode) {
      const evaluation = await this.discountsService.evaluateForTenant(
        targetTenantId,
        {
          code: dto.discountCode,
          subtotal,
          shippingFee,
          customerPhone: dto.customerPhone,
        },
      );
      if (!evaluation.valid) {
        throw new BadRequestException(evaluation.reason || 'Invalid discount code');
      }
      discount = evaluation.discount ?? null;
      discountAmount = evaluation.discountAmount ?? 0;
    }

    // total = subtotal + shipping − discount (discount is capped, so never negative)
    const totalAmount = this.discountsService.round2(
      subtotal + shippingFee - discountAmount,
    );

    // Determine risk score based on server-verified data
    const riskScore = this.calculateRiskScore(dto, subtotal);

    // Create order with items in transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Link/ hydrate CRM customer by phone (Shopify-style: checkout builds the customer base)
      const customer = await tx.customer.upsert({
        where: {
          tenantId_phone: { tenantId: targetTenantId, phone: dto.customerPhone },
        },
        create: {
          tenantId: targetTenantId,
          name: dto.customerName,
          phone: dto.customerPhone,
          email: dto.customerEmail || null,
          ordersCount: 1,
          totalSpent: totalAmount,
        },
        update: {
          name: dto.customerName,
          email: dto.customerEmail || undefined,
          ordersCount: { increment: 1 },
          totalSpent: { increment: totalAmount },
        },
      });

      const newOrder = await tx.order.create({
        data: {
          tenantId: targetTenantId,
          orderNumber,
          customerId: customer.id,
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
          discountId: discount?.id,
          discountAmount,
          totalAmount,
          notes: dto.notes,
        },
      });

      // Consume ONE usage of the discount atomically (race-safe against maxUses)
      if (discount) {
        const bumped = await tx.discount.updateMany({
          where: {
            id: discount.id,
            ...(discount.maxUses !== null
              ? { usedCount: { lt: discount.maxUses } }
              : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (bumped.count === 0) {
          // Throwing rolls back the whole order transaction
          throw new BadRequestException(
            'Discount code limit reached during checkout — please retry without the code.',
          );
        }
      }

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

      // Generate OTP for COD orders (5-minute validity window)
      if (dto.paymentMethod === 'COD') {
        const otpCode = this.generateOTP();
        await tx.codVerification.create({
          data: {
            orderId: newOrder.id,
            otpCode,
            isVerified: false,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
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

    // order.created webhook (never blocks checkout)
    const createdFull = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    if (createdFull) {
      this.emitOrderCreated(targetTenantId, createdFull);
    }

    return {
      ...order,
      otpRequired: dto.paymentMethod === 'COD',
    };
  }

  // order.created webhook — fired outside the transaction, non-blocking
  private emitOrderCreated(tenantId: string, order: any) {
    void this.webhooksService.dispatchEvent(tenantId, 'order.created', {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      shippingCity: order.shippingCity,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      items: order.items,
    });
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

    if (
      order.codVerification.attempts >= 5
    ) {
      throw new BadRequestException(
        'Too many attempts. Request a new OTP (resend) and try again.',
      );
    }

    if (
      order.codVerification.expiresAt &&
      order.codVerification.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'OTP expired. Please use the "Resend OTP" option and try the new code.',
      );
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

  // ------------------------------------------------------
  // Resend COD OTP (Pakistan COD flow) — regenerates code + 5 min window
  // ------------------------------------------------------

  async resendOtp(tenantId: string, orderId: string) {
    const order = await this.findOne(tenantId, orderId);

    if (order.paymentMethod !== 'COD') {
      throw new BadRequestException('OTP resend applies to COD orders only');
    }
    if (
      order.orderStatus === 'CANCELLED' ||
      order.orderStatus === 'RTO'
    ) {
      throw new BadRequestException('Order is closed — OTP resend not allowed');
    }

    const existing = await this.prisma.codVerification.findUnique({
      where: { orderId },
    });
    if (existing?.isVerified) {
      throw new BadRequestException('Order is already OTP-verified');
    }

    const otpCode = this.generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.codVerification.upsert({
      where: { orderId },
      create: {
        orderId,
        otpCode,
        isVerified: false,
        expiresAt,
      },
      update: {
        otpCode,
        expiresAt,
        attempts: 0, // fresh window starts with a clean slate
      },
    });

    // Notify via both channels (simulation logs when Twilio is not configured)
    try {
      await Promise.all([
        this.notificationService.sendOtpSms(order.customerPhone, otpCode, order.orderNumber),
        this.notificationService.sendWhatsAppOtp(order.customerPhone, otpCode, order.orderNumber),
      ]);
    } catch (err) {
      console.error('[COD OTP Resend Notification] Failed:', err);
    }
    console.log(`[COD OTP Resend] Order ${order.orderNumber}: ${otpCode} (expires ${expiresAt.toISOString()})`);

    return {
      success: true,
      message: 'A new OTP has been sent via SMS and WhatsApp',
      otpExpiresAt: expiresAt,
    };
  }

  // ------------------------------------------------------
  // FBR POS integration (sandbox) — invoice number is issued per order
  // ------------------------------------------------------

  async createFbrInvoice(tenantId: string, orderId: string, processedBy?: string) {
    const order = await this.findOne(tenantId, orderId);

    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RTO') {
      throw new BadRequestException(
        'FBR invoice not allowed — order is closed (CANCELLED/RTO)',
      );
    }
    if (order.paymentStatus === 'REFUNDED') {
      throw new BadRequestException('FBR invoice not allowed — payment refunded');
    }

    // Idempotent: re-issuing returns the original invoice
    if (order.fbrInvoiceNo) {
      return {
        invoiceNo: order.fbrInvoiceNo,
        invoiceAt: order.fbrInvoiceAt,
        orderNumber: order.orderNumber,
        idempotent: true,
      };
    }

    const stamp = new Date();
    const datePart = `${stamp.getUTCFullYear().toString().slice(2)}${String(stamp.getUTCMonth() + 1).padStart(2, '0')}${String(stamp.getUTCDate()).padStart(2, '0')}`;
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    const invoiceNo = `FBR-${datePart}-${randomPart}`;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { fbrInvoiceNo: invoiceNo, fbrInvoiceAt: stamp },
    });

    console.log(
      `[FBR SANDBOX] Invoice ${invoiceNo} issued for ${order.orderNumber} by ${processedBy || 'merchant'}`,
    );

    return {
      invoiceNo: updated.fbrInvoiceNo,
      invoiceAt: updated.fbrInvoiceAt,
      orderNumber: updated.orderNumber,
      idempotent: false,
    };
  }

  listFbrInvoices(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { tenantId, fbrInvoiceNo: { not: null } };

    return Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          fbrInvoiceNo: true,
          fbrInvoiceAt: true,
          totalAmount: true,
          paymentMethod: true,
          paymentStatus: true,
          orderStatus: true,
          customerName: true,
          customerPhone: true,
        },
        orderBy: { fbrInvoiceAt: 'desc' as const },
      }),
      this.prisma.order.count({ where }),
    ]).then(([data, total]) => ({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }));
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
        fulfillments: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        refunds: true,
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

    // Stamp delivered time on outstanding fulfillments
    if (dto.status === 'DELIVERED') {
      await this.prisma.fulfillment.updateMany({
        where: { orderId: id },
        data: { deliveredAt: new Date() },
      });
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

    const updated = await this.prisma.order.update({
      where: { id },
      data,
    });

    // order.status_changed webhook (never blocks admin action)
    void this.webhooksService.dispatchEvent(tenantId, 'order.status_changed', {
      id: updated.id,
      orderNumber: updated.orderNumber,
      from: order.orderStatus,
      to: updated.orderStatus,
      paymentStatus: updated.paymentStatus,
    });

    // English SMS/WhatsApp status update to the customer (non-blocking)
    if (order.customerPhone) {
      void this.notificationService
        .notifyStatusUpdate(order.customerPhone, updated.orderStatus, {
          orderNumber: updated.orderNumber,
        })
        .catch(() => undefined);
    }

    return updated;
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

  // ------------------------------------------------------
  // Fulfillment (shipping & packing) — Shopify parity
  // ------------------------------------------------------

  async listFulfillments(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.prisma.fulfillment.findMany({
      where: { orderId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFulfillment(
    tenantId: string,
    id: string,
    dto: CreateFulfillmentDto,
  ) {
    const order = await this.findOne(tenantId, id);

    if (['CANCELLED', 'RTO', 'DELIVERED'].includes(order.orderStatus)) {
      throw new BadRequestException(
        `Cannot fulfill an order in ${order.orderStatus} state`,
      );
    }

    // How much of each order item has already been fulfilled?
    const existing = await this.prisma.fulfillment.findMany({
      where: { orderId: order.id },
      include: { items: true },
    });
    const fulfilledQty = new Map<string, number>();
    for (const f of existing) {
      for (const fi of f.items) {
        fulfilledQty.set(fi.orderItemId, (fulfilledQty.get(fi.orderItemId) || 0) + fi.quantity);
      }
    }

    const openItems = order.items.filter(
      (oi) => oi.quantity - (fulfilledQty.get(oi.id) || 0) > 0,
    );

    // Plan this fulfillment (explicit lines, or ALL remaining by default)
    const planned = new Map<string, number>();
    if (dto.items && dto.items.length) {
      for (const line of dto.items) {
        const oi = order.items.find((o) => o.id === line.orderItemId);
        if (!oi) {
          throw new BadRequestException(`Order item ${line.orderItemId} is not part of this order`);
        }
        const remaining = oi.quantity - (fulfilledQty.get(oi.id) || 0);
        if (line.quantity > remaining) {
          throw new BadRequestException(
            `Cannot fulfill ${line.quantity} of "${oi.title}" — only ${remaining} remaining`,
          );
        }
        planned.set(oi.id, (planned.get(oi.id) || 0) + line.quantity);
      }
    } else {
      for (const oi of openItems) {
        planned.set(oi.id, oi.quantity - (fulfilledQty.get(oi.id) || 0));
      }
    }

    if (planned.size === 0) {
      throw new BadRequestException('Nothing left to fulfill on this order');
    }

    const stillOpen = openItems.some(
      (oi) =>
        oi.quantity - (fulfilledQty.get(oi.id) || 0) - (planned.get(oi.id) || 0) > 0,
    );
    const status = stillOpen ? 'PARTIAL' : 'FULFILLED';

    const fulfillment = await this.prisma.fulfillment.create({
      data: {
        orderId: order.id,
        status,
        trackingNumber: dto.trackingNumber,
        carrier: dto.carrier,
        items: {
          create: Array.from(planned.entries()).map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Shipping has started
    await this.prisma.order.update({
      where: { id: order.id },
      data: { orderStatus: 'DISPATCHED' },
    });

    // order.fulfilled webhook (never blocks fulfillment)
    void this.webhooksService.dispatchEvent(tenantId, 'order.fulfilled', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfillmentId: fulfillment.id,
      status: fulfillment.status,
      trackingNumber: fulfillment.trackingNumber,
      carrier: fulfillment.carrier,
      items: fulfillment.items,
    });

    // English SMS/WhatsApp "shipped" notification (non-blocking)
    void this.notificationService
      .notifyStatusUpdate(order.customerPhone, 'DISPATCHED', {
        orderNumber: order.orderNumber,
        trackingNumber: fulfillment.trackingNumber,
        carrier: fulfillment.carrier,
      })
      .catch(() => undefined);

    return fulfillment;
  }

  // ------------------------------------------------------
  // Refunds — Shopify parity
  // ------------------------------------------------------

  async createRefund(
    tenantId: string,
    id: string,
    dto: CreateRefundDto,
    processedBy?: string,
  ) {
    const order = await this.findOne(tenantId, id);

    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RTO') {
      throw new BadRequestException('Refund not allowed — order is already closed');
    }

    const fullAmount = this.discountsService.round2(order.totalAmount);
    const amount =
      dto.amount !== undefined && dto.amount !== null
        ? this.discountsService.round2(dto.amount)
        : fullAmount;

    if (amount <= 0 || amount > fullAmount) {
      throw new BadRequestException(
        `Refund amount must be between 0 and Rs.${fullAmount}`,
      );
    }

    const isFull = amount >= fullAmount;
    const restock = dto.restock ?? false;

    // Restock returned goods (only when explicitly asked — the guard above
    // guarantees the order is still open, so no double-restock risk here)
    if (restock && order.items && order.items.length) {
      await this.prisma.$transaction(
        order.items.map((item) =>
          this.prisma.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          }),
        ),
      );
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId: order.id,
        amount,
        reason: dto.reason,
        restock,
        processedBy,
      },
    });

    // Business rule: full refund closes the order financially & administratively
    const orderData: any = {};
    if (isFull) {
      orderData.paymentStatus = 'REFUNDED';
      orderData.orderStatus = 'CANCELLED';
    }
    if (Object.keys(orderData).length) {
      await this.prisma.order.update({ where: { id: order.id }, data: orderData });
    }

    // order.refunded webhook (never blocks refunds)
    void this.webhooksService.dispatchEvent(tenantId, 'order.refunded', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      refundId: refund.id,
      amount: refund.amount,
      reason: refund.reason,
      restocked: restock,
      isFullRefund: isFull,
    });

    return {
      refund,
      applied: {
        paymentStatus: isFull ? 'REFUNDED' : order.paymentStatus,
        orderStatus: isFull ? 'CANCELLED' : order.orderStatus,
        restocked: restock,
      },
    };
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
