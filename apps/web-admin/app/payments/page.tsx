'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Card, Spinner, Empty, btnGhost, btnPrimary, btnDanger, btnSm, Pill } from '@/components/ui';
import { api, formatPKR, formatDate } from '@/lib/api';

type AdminPayment = {
  id: string;
  method: string;
  status: string;
  amount: number;
  gatewayTxRef: string;
  providerRef?: string | null;
  redirectUrl?: string | null;
  instructions?: string | null;
  errorMessage?: string | null;
  markedPaidAt?: string | null;
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    paymentMethod: string;
    paymentStatus: string;
    orderStatus: string;
    totalAmount: number;
    bankProof?: {
      bankName: string;
      transactionRef: string;
      receiptImageUrl: string;
      isApproved: boolean;
    } | null;
  };
};

const TX_STATUSES = ['ALL', 'INITIATED', 'AWAITING_PROOF', 'SUCCEEDED', 'FAILED'];
const ACTIONABLE = ['INITIATED', 'AWAITING_PROOF'];

export default function PaymentsPage() {
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = status === 'ALL' ? '' : `?status=${status}`;
      const data = await api<AdminPayment[]>(`/payments${q}`);
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (p: AdminPayment) => {
    const proof = p.order.bankProof;
    const msg = proof
      ? `Approve bank transfer from ${proof.bankName} (${proof.transactionRef}) for ${p.order.orderNumber}?`
      : `Mark ${p.gatewayTxRef} as PAID for order ${p.order.orderNumber}?`;
    if (!confirm(msg)) return;
    setBusyId(p.id);
    setError(null);
    try {
      await api(`/payments/${p.id}/approve`, { method: 'POST' });
      setNotice(`Payment approved — order ${p.order.orderNumber} is now PAID`);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (p: AdminPayment) => {
    const reason = prompt(`Reason for rejecting ${p.gatewayTxRef}?`, 'No payment received');
    if (reason === null) return;
    setBusyId(p.id);
    setError(null);
    try {
      await api(`/payments/${p.id}/reject`, { method: 'POST', body: { reason: reason || undefined } });
      setNotice(`Payment ${p.gatewayTxRef} rejected`);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Reject failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-sm font-medium">
            {notice}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>
        )}

        <Card
          title="Payments"
          subtitle="Gateway transactions, wallet checkouts and bank-transfer proofs (IBFT / RAAST)"
          action={
            <button onClick={load} className={`${btnGhost} ${btnSm}`}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          }
        >
          {/* status filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {TX_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                  status === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <Empty msg="No payment transactions yet. Place an order with JazzCash, Easypaisa, IBFT or RAAST." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="pb-2">Created</th>
                    <th className="pb-2">Order / Customer</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Reference / Proof</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="py-3">
                        <a href={`/orders/${p.order.id}`} className="font-bold text-emerald-700 hover:underline">
                          {p.order.orderNumber}
                        </a>
                        <p className="text-xs text-slate-500">{p.order.customerName}</p>
                        <p className="text-[10px] text-slate-400">{p.order.customerPhone}</p>
                      </td>
                      <td className="py-3"><Pill value={p.method} /></td>
                      <td className="py-3 text-right font-bold text-slate-800 whitespace-nowrap">{formatPKR(p.amount)}</td>
                      <td className="py-3">
                        <Pill value={p.status} />
                        {p.markedPaidAt && (
                          <p className="text-[10px] text-slate-400 mt-1">{formatDate(p.markedPaidAt)}</p>
                        )}
                        {p.errorMessage && (
                          <p className="text-[10px] text-red-500 mt-1 max-w-[180px]">{p.errorMessage}</p>
                        )}
                      </td>
                      <td className="py-3">
                        <p className="font-mono text-[11px] text-slate-600 max-w-[200px] truncate" title={p.gatewayTxRef}>
                          {p.gatewayTxRef}
                        </p>
                        {p.providerRef && p.providerRef !== 'MERCHANT-APPROVED' && (
                          <p className="text-[10px] text-slate-400">ref: {p.providerRef}</p>
                        )}
                        {p.order.bankProof && (
                          <div className="mt-1 text-[10px]">
                            <p className="text-slate-600">
                              {p.order.bankProof.bankName} · {p.order.bankProof.transactionRef}
                            </p>
                            <span
                              className={`font-bold ${
                                p.order.bankProof.isApproved ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {p.order.bankProof.isApproved ? 'proof approved' : 'proof unverified'}
                            </span>
                            {p.order.bankProof.receiptImageUrl && (
                              <a
                                href={p.order.bankProof.receiptImageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 text-blue-600 underline"
                              >
                                receipt ↗
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ACTIONABLE.includes(p.status) ? (
                            <>
                              <button
                                onClick={() => approve(p)}
                                disabled={busyId === p.id}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                                title="Approve — mark this payment as received"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => reject(p)}
                                disabled={busyId === p.id}
                                className="bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-3">
            Approve only after funds are confirmed in your bank / wallet. Approved payments flip the order to
            PAID (customers see it instantly on the order-status page).
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
