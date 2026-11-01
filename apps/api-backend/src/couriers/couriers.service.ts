import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { BookShipmentDto, Courier, COURIERS } from './dto';

interface RateTier {
  base: number; // first kg
  perExtraKg: number;
  codFee: number; // flat COD collection fee
  etaMinDays: number; // metro delivery window
  etaMaxDays: number;
}

// Sandbox rate card (PKR). Real courier APIs replace this in live mode.
const MOCK_RATE_CARD: Record<Courier, RateTier> = {
  TCS: { base: 220, perExtraKg: 90, codFee: 120, etaMinDays: 2, etaMaxDays: 3 },
  LEOPARDS: { base: 190, perExtraKg: 80, codFee: 100, etaMinDays: 2, etaMaxDays: 4 },
  POSTEX: { base: 170, perExtraKg: 70, codFee: 90, etaMinDays: 2, etaMaxDays: 4 },
  TRAX: { base: 200, perExtraKg: 85, codFee: 110, etaMinDays: 3, etaMaxDays: 5 },
};

const METRO_CITIES = [
  'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad', 'multan',
  'peshawar', 'quetta', 'sialkot', 'gujranwala', 'hyderabad', 'sargodha',
];

const REMOTE_CITIES = [
  'gilgit', 'skardu', 'turbat', 'gwadar', 'chitral', 'khuzdar', 'kohat',
  'dera ghazi khan', 'dera ismail khan', 'zhob', 'dalbandin', 'charsha',
];

@Injectable()
export class CouriersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private webhooksService: WebhooksService,
  ) {}

  // ------------------------------------------------------
  // Rate quotes — deterministic mock table by city group + weight
  // ------------------------------------------------------

  rates(city: string, weightGrams = 500) {
    const normalized = city.trim().toLowerCase();
    const isMetro = METRO_CITIES.includes(normalized);
    const isRemote = REMOTE_CITIES.includes(normalized);

    const extraKg = Math.max(0, Math.ceil(weightGrams / 1000) - 1);

    const data = COURIERS.map((courier) => {
      const tier = MOCK_RATE_CARD[courier];
      const surcharge = isRemote ? 150 : isMetro ? 0 : 30;
      const etaExtra = isRemote ? 2 : 0;

      return {
        courier,
        serviceCharge: tier.base + tier.perExtraKg * extraKg + surcharge,
        codFee: tier.codFee,
        estimatedDays: {
          min: tier.etaMinDays + etaExtra,
          max: tier.etaMaxDays + etaExtra,
        },
      };
    });

    return {
      mode: 'SANDBOX',
      city,
      cityGroup: isRemote ? 'REMOTE' : isMetro ? 'METRO' : 'STANDARD',
      weightGrams,
      rates: data,
    };
  }

  // ------------------------------------------------------
  // Booking — writes tracking number onto the order's latest fulfillment
  // ------------------------------------------------------

  async bookShipment(tenantId: string, dto: BookShipmentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId },
      include: { fulfillments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RTO') {
      throw new BadRequestException('Order is closed — cannot book a shipment');
    }

    const fulfillment = order.fulfillments?.[0];
    if (!fulfillment) {
      throw new BadRequestException(
        'Order has no fulfillment yet — fulfill the order first, then book the shipment',
      );
    }
    if (fulfillment.trackingNumber) {
      throw new BadRequestException(
        `Shipment already booked — tracking ${fulfillment.trackingNumber} (${fulfillment.carrier})`,
      );
    }

    const trackingNumber = this.generateTrackingNumber(dto.courier);
    const updated = await this.prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: { trackingNumber, carrier: dto.courier },
    });

    // order.shipped webhook + customer notification (both non-blocking)
    void this.webhooksService.dispatchEvent(tenantId, 'order.shipped', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfillmentId: fulfillment.id,
      courier: dto.courier,
      trackingNumber,
    });
    void this.notificationService
      .notifyStatusUpdate(order.customerPhone, 'DISPATCHED', {
        orderNumber: order.orderNumber,
        trackingNumber,
        carrier: dto.courier,
      })
      .catch(() => undefined);

    return {
      id: updated.id,
      trackingNumber,
      carrier: dto.courier,
      mode: 'SANDBOX',
      orderNumber: order.orderNumber,
    };
  }

  // ------------------------------------------------------
  // Tracking — deterministic timeline derived from booking time
  // ------------------------------------------------------

  async track(trackingNumber: string) {
    const fulfillment = await this.prisma.fulfillment.findFirst({
      where: { trackingNumber },
      include: { order: true, items: true },
    });
    if (!fulfillment) {
      throw new NotFoundException('Tracking number not found');
    }

    const order = fulfillment.order;
    const t0 = fulfillment.createdAt.getTime();
    const HOUR = 3_600_000;

    const timeline: Array<{ status: string; at: Date; detail: string }> = [
      { status: 'BOOKED', at: new Date(t0), detail: `Shipment booked with ${fulfillment.carrier || 'courier'} (sandbox)` },
      { status: 'PICKED_UP', at: new Date(t0 + 6 * HOUR), detail: 'Parcel picked up by courier from the merchant' },
      { status: 'IN_TRANSIT', at: new Date(t0 + 24 * HOUR), detail: `In transit towards ${order.shippingCity}` },
      { status: 'OUT_FOR_DELIVERY', at: new Date(t0 + 36 * HOUR), detail: 'Out for delivery' },
    ];

    const isDelivered = order.orderStatus === 'DELIVERED';
    if (isDelivered) {
      timeline.push({
        status: 'DELIVERED',
        at: fulfillment.deliveredAt ?? new Date(t0 + 48 * HOUR),
        detail: 'Delivered successfully',
      });
    }

    const events = timeline
      .filter((e) => e.at.getTime() <= Date.now())
      .map((e) => ({
        status: e.status,
        detail: e.detail,
        at: e.at.toISOString(),
      }));

    return {
      mode: 'SANDBOX',
      trackingNumber,
      carrier: fulfillment.carrier,
      orderNumber: order.orderNumber,
      destination: order.shippingCity,
      fulfillmentStatus: fulfillment.status,
      delivered: isDelivered,
      estimatedDeliveryAt: isDelivered ? null : new Date(t0 + 48 * HOUR).toISOString(),
      events,
    };
  }

  private generateTrackingNumber(courier: Courier): string {
    switch (courier) {
      case 'TCS':
        return String(crypto.randomInt(100_000_000, 999_999_999_999));
      case 'LEOPARDS':
        return String(crypto.randomInt(100_000_000_000, 999_999_999_999));
      case 'POSTEX':
        return `PXE${crypto.randomInt(100_000_000, 999_999_999)}`;
      case 'TRAX':
        return `TRX${crypto.randomInt(10_000_000, 99_999_999)}`;
    }
  }
}
