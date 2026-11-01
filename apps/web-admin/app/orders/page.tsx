'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Search } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Card, Empty, Pill, Spinner, btnGhost, btnPrimary, btnSm, input } from '@/components/ui';
import { api, formatPKR, formatDate, ORDER_STATUSES } from '@/lib/api';

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  shippingCity: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  riskScore: string;
  createdAt: string;
  discountAmount?: number;
};

export default function OrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p = page, st = status) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/orders?page=${p}&limit=15${st ? `&status=${st}` : ''}`;
      const res = await api<{ data: OrderRow[]; meta: any }>(url);
      let data = res.data;
      // client-side search when backend has no search param for orders
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        data = data.filter(
          (o) =>
            o.orderNumber?.toLowerCase().includes(needle) ||
            o.customerName?.toLowerCase().includes(needle) ||
            o.customerPhone?.includes(needle),
        );
      }
      setRows(data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    load(1, status);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load(page, status);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="space-y-5">
        <Card
          title="Orders"
          subtitle={meta ? `${meta.total} orders total` : '—'}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  placeholder="Search # / name / phone"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load(1, status)}
                  className={`${input} pl-8 !w-56`}
                />
              </div>
              <button onClick={() => load(page, status)} className={`${btnGhost} ${btnSm}`}>
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          }
        >
          {/* status filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                status === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {ORDER_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  status === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <Empty msg="No orders found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Order</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">City</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3">Method</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Updated</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-semibold text-slate-900">{o.orderNumber}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">{o.customerName}</div>
                        <div className="text-xs text-slate-400">{o.customerPhone}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{o.shippingCity}</td>
                      <td className="py-3 px-3 text-slate-600">{(o as any).items?.length ?? '—'}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatPKR(o.totalAmount)}
                      </td>
                      <td className="py-3 px-3">
                        <Pill value={o.paymentMethod} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Pill value={o.orderStatus} />
                          <span className="text-[10px] text-slate-400">risk {o.riskScore}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          href={`/orders/${o.id}`}
                          className="text-xs bg-slate-900 text-white hover:bg-slate-700 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-500 text-xs">
                Page {meta.page} of {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className={`${btnGhost} ${btnSm}`}
                >
                  ← Prev
                </button>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={`${btnGhost} ${btnSm}`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
