'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Banknote,
  Package,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  Activity,
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

type PeriodLabel = { value: number; label: string };

const PERIODS: PeriodLabel[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<RevenuePoint[]>([]);
  const [breakdown, setBreakdown] = useState<StatusRow[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, sr, sb, tp] = await Promise.all([
        api<Summary>('/analytics/summary'),
        api<RevenuePoint[] | { series: RevenuePoint[] }>(
          `/analytics/revenue-series?days=${period}`,
        ),
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
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const previousSeries = useRef<RevenuePoint[]>([]);

  const kpis = summary
    ? [
        {
          label: 'Revenue (net)',
          value: formatPKR(summary.revenue),
          icon: Banknote,
          sub: `${summary.orders} orders`,
          trend: summary.orders > 0 ? '+12%' : '—',
          trendUp: true,
        },
        {
          label: 'Average Order Value',
          value: formatPKR(summary.avgOrderValue),
          icon: TrendingUp,
          sub: `COD share ${summary.codShare}%`,
          trend: '+5%',
          trendUp: true,
        },
        {
          label: 'Delivered Orders',
          value: String(summary.deliveredOrders),
          icon: CheckCircle2,
          sub: `${summary.orders} total orders`,
          trend: '-2%',
          trendUp: false,
        },
        {
          label: 'Customers',
          value: String(summary.customers),
          icon: Users,
          sub: 'CRM profiles',
          trend: '+8%',
          trendUp: true,
        },
      ]
    : [];

  // Simple sparkline data from recent series for KPI trend mini-chart
  const sparkline = useMemo(() => {
    if (series.length < 2) return [];
    return series.slice(-7);
  }, [series]);

  return (
    <AppShell>
      {loading ? (
        <Spinner text="Loading analytics…" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className={`${btnGhost} ${btnSm}`}>
            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Overview</h1>
              <p className="text-sm text-slate-500">
                Store performance summary for the last {period} days
              </p>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl bg-white px-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    period === p.value
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {k.label}
                    </p>
                    <Icon className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                  <div className="flex items-center gap-1 mt-2.5">
                    <span
                      className={`text-xs font-bold ${k.trendUp ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {k.trendUp ? '↑' : '↓'} {k.trend}
                    </span>
                    <span className="text-xs text-slate-400">{k.sub}</span>
                  </div>
                  <div className="mt-3 h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
                    {sparkline.length > 0 ? (
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                    ) : (
                      <div className="h-full bg-slate-200" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue line chart */}
            <Card title="Revenue trend" subtitle={`Daily net revenue — last ${period} days`}>
              <div className="h-[300px] w-full">
                <RevenueLineChart series={series} period={period} />
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-6">
              {/* Status breakdown */}
              <Card title="Order pipeline" subtitle="Live status breakdown">
                {breakdown.length === 0 ? (
                  <Empty msg="No orders yet." />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-slate-400 text-xs uppercase">
                      <tr>
                        <th className="text-left pb-3">Status</th>
                        <th className="text-right pb-3">Orders</th>
                        <th className="text-right pb-3">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {breakdown.map((r) => (
                        <tr key={r.status} className="hover:bg-slate-50 transition">
                          <td className="py-3">
                            <Pill value={r.status} />
                          </td>
                          <td className="py-3 text-right font-semibold text-slate-900">
                            {r.count}
                          </td>
                          <td className="py-3 text-right text-slate-600">
                            {formatPKR(r.revenue)}
                          </td>
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
                        <th className="text-left pb-3">Product</th>
                        <th className="text-right pb-3">Units</th>
                        <th className="text-right pb-3">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {top.map((p, idx) => (
                        <tr key={p.title} className="hover:bg-slate-50 transition">
                          <td className="py-3 font-medium text-slate-800">
                            <span className="text-xs font-bold text-slate-400 mr-2">
                              #{idx + 1}
                            </span>
                            {p.title}
                          </td>
                          <td className="py-3 text-right font-semibold text-slate-900">
                            {p.unitsSold}
                          </td>
                          <td className="py-3 text-right text-slate-600">
                            {formatPKR(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function RevenueLineChart({
  series,
  period,
}: {
  series: RevenuePoint[];
  period: number;
}) {
  if (series.length === 0) return <Empty msg="No revenue data yet." />;

  const W = 700;
  const H = 260;
  const pad = 40;
  const data = series.slice(-period);
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);

  // Compute polyline points for revenue (left y-axis)
  const points = data
    .map((d, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (W - 2 * pad);
      const y = H - pad - (d.revenue / maxRev) * (H - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');

  // Area under curve (gradient fill)
  const areaPoints = `0,${H - pad} ${points} ${pad + (data.length - 1) / Math.max(data.length - 1, 1) * (W - 2 * pad)},${H - pad}`;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-2 text-xs text-slate-400">
        <span>{formatPKR(maxRev)} max</span>
        <span className="ml-auto">{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[260px]"
        preserveAspectRatio="none"
      >
        {/* Area fill */}
        <path
          d={`M${areaPoints} Z`}
          fill="url(#revGradient)"
          fillOpacity={0.15}
        />
        {/* Line */}
        <path
          d={`M${points}`}
          fill="none"
          stroke="#059669"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Gradient defs */}
        <defs>
          <linearGradient id="revGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Axis ticks */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0).map((d, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * (W - 2 * pad);
          return (
            <g key={d.date}>
              <line
                x1={x}
                y1={H - pad}
                x2={x}
                y2={H - pad + 4}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <text
                x={x}
                y={H - pad + 16}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize="10"
              >
                {d.date}
              </text>
            </g>
          );
        })}
        {/* Dots on line */}
        {data.map((d, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * (W - 2 * pad);
          const y = H - pad - (d.revenue / maxRev) * (H - 2 * pad);
          return (
            <circle
              key={d.date}
              cx={x}
              cy={y}
              r={3}
              fill="#059669"
              stroke="#ffffff"
              strokeWidth={1.5}
            >
              <title>{`${d.date}: ${formatPKR(d.revenue)} (${d.orders} orders)`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
