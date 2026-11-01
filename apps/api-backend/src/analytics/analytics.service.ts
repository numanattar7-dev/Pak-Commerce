import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Numberish = number | bigint | null | undefined;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Revenue excludes closed/failed orders (CANCELLED, RTO)
  async summary(tenantId: string) {
    const [revenueRow, customers, statusRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ revenue: Numberish; orders: number; codOrders: number; delivered: number; pending: number }>>`
        SELECT
          COALESCE(SUM("totalAmount"), 0)::float8 AS revenue,
          COUNT(*)::int AS orders,
          COUNT(*) FILTER (WHERE "paymentMethod" = 'COD')::int AS "codOrders",
          COUNT(*) FILTER (WHERE "orderStatus" = 'DELIVERED')::int AS delivered,
          COUNT(*) FILTER (WHERE "orderStatus" IN ('PENDING','VERIFIED','PROCESSING'))::int AS pending
        FROM orders
        WHERE "tenantId" = ${tenantId}
          AND "orderStatus" NOT IN ('CANCELLED', 'RTO')`,
      this.prisma.$queryRaw<Array<{ c: number }>>`SELECT COUNT(*)::int AS c FROM customers WHERE "tenantId" = ${tenantId}`,
      this.prisma.$queryRaw<Array<{ status: string; c: number }>>`
        SELECT "orderStatus" AS status, COUNT(*)::int AS c
        FROM orders WHERE "tenantId" = ${tenantId} GROUP BY "orderStatus"`,
    ]);

    const row = revenueRow[0] || { revenue: 0, orders: 0, codOrders: 0, delivered: 0, pending: 0 };
    const revenue = Number(row.revenue || 0);
    const orders = Number(row.orders || 0);

    const statusBreakdown: Record<string, number> = {};
    for (const s of statusRows) statusBreakdown[s.status] = Number(s.c);

    return {
      revenue,
      orders,
      avgOrderValue: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
      customers: Number((customers[0]?.c as number) ?? 0),
      codShare: orders > 0 ? Math.round((Number(row.codOrders) / orders) * 100) : 0,
      deliveredOrders: Number(row.delivered || 0),
      pendingOrders: Number(row.pending || 0),
      statusBreakdown,
    };
  }

  async revenueSeries(tenantId: string, days: number) {
    const safeDays = Math.min(Math.max(days, 1), 180);
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; orders: number; revenue: Numberish }>
    >`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS orders,
             COALESCE(SUM("totalAmount"), 0)::float8 AS revenue
      FROM orders
      WHERE "tenantId" = ${tenantId}
        AND "orderStatus" NOT IN ('CANCELLED', 'RTO')
        AND "createdAt" >= now() - ${safeDays} * interval '1 day'
      GROUP BY 1
      ORDER BY 1`;

    return rows.map((r) => ({
      date: (r.day as Date).toISOString().slice(0, 10),
      orders: Number(r.orders),
      revenue: Number(r.revenue || 0),
    }));
  }

  async topProducts(tenantId: string, limit: number) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.$queryRaw<
      Array<{ title: string; qty: number; revenue: Numberish }>
    >`SELECT COALESCE(p.title || ' / ' || pv.title, oi."title") AS title,
             SUM(oi.quantity)::int AS qty,
             COALESCE(SUM(oi."price" * oi.quantity), 0)::float8 AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi."orderId"
      LEFT JOIN product_variants pv ON pv.id = oi."variantId"
      LEFT JOIN products p ON p.id = pv."productId"
      WHERE o."tenantId" = ${tenantId}
        AND o."orderStatus" NOT IN ('CANCELLED', 'RTO')
      GROUP BY p.title, pv.title, oi."title"
      ORDER BY revenue DESC
      LIMIT ${safeLimit}`;

    return rows.map((r) => ({
      title: r.title,
      unitsSold: Number(r.qty),
      revenue: Number(r.revenue || 0),
    }));
  }

  async statusBreakdown(tenantId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ status: string; c: number; value: Numberish }>
    >`
      SELECT "orderStatus" AS status, COUNT(*)::int AS c,
             COALESCE(SUM("totalAmount"), 0)::float8 AS value
      FROM orders
      WHERE "tenantId" = ${tenantId}
      GROUP BY "orderStatus"
      ORDER BY c DESC`;

    return rows.map((r) => ({
      status: r.status,
      count: Number(r.c),
      value: Number(r.value || 0),
    }));
  }
}
