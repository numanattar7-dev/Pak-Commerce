import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

const MAX_ATTEMPTS = 5;
// 30s → 2m → 10m → 30m → 2h
const BACKOFF_SECONDS = [30, 120, 600, 1800, 7200];

@Injectable()
export class WebhooksService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhooksService.name);
  private workerTimer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    // Retry worker: scans for due PENDING deliveries every 10s
    this.workerTimer = setInterval(() => {
      void this.processDueDeliveries();
    }, 10_000);
  }

  onModuleDestroy() {
    if (this.workerTimer) clearInterval(this.workerTimer);
  }

  // ------------------------------------------------------
  // Admin CRUD
  // ------------------------------------------------------

  list(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    this.assertValidUrl(dto.url);
    return this.prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        events: dto.events,
        status: dto.status ?? 'ACTIVE',
        secret: crypto.randomBytes(24).toString('hex'),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWebhookDto) {
    await this.findOwned(tenantId, id);
    if (dto.url) this.assertValidUrl(dto.url);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...(dto.url ? { url: dto.url } : {}),
        ...(dto.events ? { events: dto.events } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.prisma.webhook.delete({ where: { id } });
    return { deleted: true };
  }

  listDeliveries(tenantId: string, id: string, limit = 50) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhook: { id, tenantId } },
      orderBy: { lastAttempt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  // Fire a test event so the merchant can verify the endpoint end-to-end
  async sendTest(tenantId: string, id: string) {
    const webhook = await this.findOwned(tenantId, id);
    return this.enqueueForWebhook(webhook, 'webhook.test', {
      test: true,
      message: 'Test webhook from Pak Commerce',
      sentAt: new Date().toISOString(),
    });
  }

  // ------------------------------------------------------
  // Event dispatch — called by domain services
  // payload must be a plain JSON-serializable object
  // ------------------------------------------------------

  async dispatchEvent(tenantId: string, event: string, payload: unknown) {
    try {
      const webhooks = await this.prisma.webhook.findMany({
        where: { tenantId, status: 'ACTIVE', events: { has: event } },
      });
      for (const webhook of webhooks) {
        await this.enqueueForWebhook(webhook, event, payload);
      }
      if (webhooks.length) {
        this.logger.log(`[Webhook] dispatched "${event}" to ${webhooks.length} endpoint(s)`);
      }
    } catch (err) {
      // Never let webhook fan-out break the domain flow
      this.logger.error(`[Webhook] dispatch failed for "${event}": ${(err as Error).message}`);
    }
  }

  private async enqueueForWebhook(
    webhook: { id: string; url: string; secret: string; events: string[] },
    event: string,
    payload: unknown,
  ) {
    const body = JSON.stringify({ event, data: payload, sentAt: new Date().toISOString() });
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: body,
        status: 'PENDING',
      },
    });
    // First attempt right away (fire-and-forget)
    void this.attemptDelivery(delivery.id).catch(() => undefined);
    return delivery;
  }

  // ------------------------------------------------------
  // Delivery attempt + retries with exponential backoff
  // ------------------------------------------------------

  private async attemptDelivery(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });
    if (!delivery || delivery.status === 'DELIVERED') return;

    const payload = delivery.payload;
    const signature = crypto
      .createHmac('sha256', delivery.webhook.secret)
      .update(payload)
      .digest('hex');

    try {
      const res = await axios.post(delivery.webhook.url, payload, {
        timeout: 10_000,
        validateStatus: null, // inspect status manually below
        headers: {
          'Content-Type': 'application/json',
          'X-Pak-Commerce-Signature': `sha256=${signature}`,
          'X-Pak-Commerce-Topic': delivery.event,
          'X-Pak-Commerce-Delivery-Id': delivery.id,
        },
      });

      if (res.status >= 200 && res.status < 300) {
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'DELIVERED',
            success: true,
            responseCode: res.status,
            attempts: { increment: 1 },
            lastAttempt: new Date(),
            error: null,
            nextRetryAt: null,
          },
        });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      const message = (err as Error).message?.slice(0, 300) || 'delivery failed';
      const attempts = delivery.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      const nextRetryAt = exhausted
        ? null
        : new Date(Date.now() + BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)] * 1000);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          success: false,
          attempts,
          lastAttempt: new Date(),
          nextRetryAt,
          error: message,
        },
      });
      if (exhausted) {
        this.logger.warn(`[Webhook] delivery ${delivery.id} FAILED after ${attempts} attempts: ${message}`);
      }
    }
  }

  private async processDueDeliveries() {
    try {
      const due = await this.prisma.webhookDelivery.findMany({
        where: {
          status: 'PENDING',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
        },
        orderBy: { lastAttempt: 'asc' },
        take: 20,
      });
      for (const delivery of due) {
        await this.attemptDelivery(delivery.id);
      }
    } catch (err) {
      this.logger.error(`[Webhook] worker error: ${(err as Error).message}`);
    }
  }

  private assertValidUrl(url: string) {
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException('Webhook URL must start with http:// or https://');
    }
  }

  private async findOwned(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.tenantId !== tenantId) throw new ForbiddenException();
    return webhook;
  }
}
