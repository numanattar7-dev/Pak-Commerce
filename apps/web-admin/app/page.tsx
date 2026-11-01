'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Banknote,
  Package,
  Users,
  CheckCircle2,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Card, Spinner, Empty, Pill, btnGhost, btnSm } from '@/components/ui';
import { api, formatPKR, formatDate } from '@/lib/api';

type Summary = {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  customers: number;
  codShare: number;
  deliveredOrders: number;
};

type RevenuePoint = { date: string; revenue: number; orders: number };
type StatusRow = { status: string; count: number; revenue: number };
type TopProduct = { title: string; unitsSold: number; revenue: number };

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [breakdown, setBreakdown] = useState<StatusRow[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, sr, sb, tp] = await Promise.all([
        api<Summary>('/analytics/summary'),
        api<RevenuePoint[] | { series: RevenuePoint[] }>('/analytics/revenue-series?days=30'),
        api<StatusRow[] | { breakdown: StatusRow[] }>('/analytics/status-breakdown'),
        api<TopProduct[] | { items: TopProduct[] }>('/analytics/top-products?limit=5'),
      ]);
      setSummary(s);
      setSeries(Array.isArray(sr) ? sr : sr.series || []);
      setBreakdown(
        (Array.isArray(sb) ? sb : sb.breakdown || []).map((r) => ({
          status: r.status,
          count: Number((r as any).count ?? 0),
          revenue: Number((r as any).value ?? (r as any).revenue ?? 0),
        })),
      );
      setTop(Array.isArray(tp) ? tp : tp.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kpis = summary
    ? [
        {
          label: 'Revenue (excl. cancelled/RTO)',
          value: formatPKR(summary.revenue),
          icon: Banknote,
          sub: `${summary.orders} orders`,
        },
        {
          label: 'Average Order Value',
          value: formatPKR(summary.avgOrderValue),
          icon: TrendingUp,
          sub: `COD share ${summary.codShare}%`,
        },
        {
          label: 'Delivered Orders',
          value: String(summary.deliveredOrders),
          icon: CheckCircle2,
          sub: `${summary.orders} total orders`,
        },
        {
          label: 'Customers',
          value: String(summary.customers),
          icon: Users,
          sub: 'CRM profiles',
        },
      ]
    : [];

  return (
    <AppShell>
      {loading ? (
        <Spinner text="Loading analytics…" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className={`${btnGhost} ${btnSm}`}>
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {k.label}
                    </p>
                    <Icon className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{k.value}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{k.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Revenue 30d */}
          <Card
            title="Revenue — last 30 days"
            subtitle="Server-computed gross revenue per day (cancelled/RTO excluded)"
          >
            <RevenueChart series={series} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <Card title="Order pipeline" subtitle="Live status breakdown">
              {breakdown.length === 0 ? (
                <Empty msg="No orders yet." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="text-left pb-2">Status</th>
                      <th className="text-right pb-2">Orders</th>
                      <th className="text-right pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {breakdown.map((r) => (
                      <tr key={r.status}>
                        <td className="py-2">
                          <Pill value={r.status} />
                        </td>
                        <td className="py-2 text-right font-semibold">{r.count}</td>
                        <td className="py-2 text-right text-slate-600">{formatPKR(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Top products */}
            <Card title="Top products" subtitle="Units sold across all fulfillments">
              {top.length === 0 ? (
                <Empty msg="No sales data yet." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="text-left pb-2">Product</th>
                      <th className="text-right pb-2">Units</th>
                      <th className="text-right pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {top.map((p) => (
                      <tr key={p.title}>
                        <td className="py-2 font-medium text-slate-800">{p.title}</td>
                        <td className="py-2 text-right font-semibold">{p.unitsSold}</td>
                        <td className="py-2 text-right text-slate-600">{formatPKR(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RevenueChart({ series }: { series: RevenuePoint[] }) {
  const W = 900;
  const H = 220;
  const data = series.slice(-30);
  if (data.length === 0) return <Empty msg="No revenue data yet." />;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const bw = W / Math.max(data.length, 1);
  const chartH = H - 28;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = Math.round((d.revenue / max) * chartH);
        const x = i * bw;
        return (
          <g key={d.date}>
            <rect
              x={x + bw * 0.15}
              y={chartH - h}
              width={bw * 0.7}
              height={h}
              rx={3}
              fill={h > 0 ? '#059669' : '#e2e8f0'}
              opacity={0.9}
            >
              <title>{`${d.date}: ${formatPKR(d.revenue)} (${d.orders} orders)`}</title>
            </rect>
          </g>
        );
      })}
      <text x={4} y={H - 8} className="fill-slate-400" fontSize="10">
        {data[0]?.date}
      </text>
      <text x={W - 4} y={H - 8} textAnchor="end" className="fill-slate-400" fontSize="10">
        {data[data.length - 1]?.date}
      </text>
      <text x={4} y={12} className="fill-slate-400" fontSize="10">
        max {formatPKR(max)}
      </text>
    </svg>
  );
}
