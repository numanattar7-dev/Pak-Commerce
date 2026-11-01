'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  Truck,
  RotateCcw,
  RefreshCw,
  FileCheck2,
  Send,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import {
  Card,
  Modal,
  Pill,
  Spinner,
  Empty,
  btnGhost,
  btnPrimary,
  btnDanger,
  btnSm,
  input,
  label,
} from '@/components/ui';
import { api, formatPKR, formatDate, ORDER_STATUSES } from '@/lib/api';

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  shippingCity: string;
  shippingAddress: string;
  shippingFee: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  riskScore: string;
  notes?: string | null;
  fbrInvoiceNo?: string | null;
  fbrInvoiceAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{ id: string; title: string; quantity: number; price: number; variantId: string }>;
  fulfillments: Array<{
    id: string;
    status: string;
    trackingNumber?: string | null;
    carrier?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
    createdAt: string;
    items: Array<{ orderItemId: string; quantity: number }>;
  }>;
  refunds: Array<{ id: string; amount: number; reason?: string | null; restock: boolean; createdAt: string }>;
  codVerification?: { isVerified: boolean; attempts: number; expiresAt?: string | null; verifiedAt?: string | null } | null;
};

type Rate = {
  courier: string;
  serviceCharge: number;
  codFee: number;
  etaMin: number;
  etaMax: number;
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // modals/dialog state
  const [otp, setOtp] = useState('');
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [cityGroup, setCityGroup] = useState<string>('STANDARD');
  const [tracking, setTracking] = useState<any>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRestock, setRefundRestock] = useState(false);
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialQty, setPartialQty] = useState<Record<string, string>>({});
  const [trackNumber, setTrackNumber] = useState('');
  const [carrier, setCarrier] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrder(await api<Order>(`/orders/${id}`));
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      setNotice(label);
      await load();
      return res;
    } catch (e: any) {
      setError(e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Spinner text="Loading order…" />
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error || 'Order not found.'}{' '}
          <Link href="/orders" className="underline">
            back
          </Link>
        </div>
      </AppShell>
    );
  }

  const weightGrams = Math.max(100, order.items.reduce((w, i) => w + 500 * i.quantity, 0));
  const fullyFulfilled = order.fulfillments.some((f) => f.status === 'FULFILLED');

  const setStatus = (status: string) =>
    run(`Status → ${status}`, () => api(`/orders/${order.id}/status`, { method: 'PUT', body: { status } }));

  const bookCourier = (courier: string) =>
    run(`Shipment booked with ${courier}`, () =>
      api<any>('/couriers/shipments', { method: 'POST', body: { orderId: order.id, courier } }).then(async (res) => {
        setTracking(res);
        return res;
      }),
    );

  const track = (trackingNumber: string) =>
    run('Tracking updated', () =>
      api(`/couriers/track/${trackingNumber}`).then((res) => {
        setTracking((prev: any) => ({ ...prev, ...(res as any) }));
        return res;
      }),
    );

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/orders')} className={`${btnGhost} ${btnSm}`}>
              <ArrowLeft className="w-3.5 h-3.5" /> Orders
            </button>
            <h1 className="text-xl font-bold text-slate-900">{order.orderNumber}</h1>
            <Pill value={order.orderStatus} />
            <Pill value={order.paymentMethod} />
            <span className="text-xs text-slate-400">risk {order.riskScore}</span>
          </div>
          <button onClick={load} disabled={busy} className={`${btnGhost} ${btnSm}`}>
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {notice}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: info + items */}
          <div className="lg:col-span-2 space-y-5">
            <Card title="Summary">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Customer</p>
                  <p className="font-semibold text-slate-800">{order.customerName}</p>
                  <p className="text-slate-500">{order.customerPhone}</p>
                  {order.customerEmail && <p className="text-slate-400 text-xs">{order.customerEmail}</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase">Ship to</p>
                  <p className="font-semibold text-slate-800">{order.shippingCity}</p>
                  <p className="text-slate-500">{order.shippingAddress}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase">Created</p>
                  <p className="text-slate-600">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase">Payment</p>
                  <div className="flex gap-1.5">
                    <Pill value={order.paymentMethod} />
                    <Pill value={order.paymentStatus} />
                  </div>
                </div>
                {order.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 uppercase">Notes</p>
                    <p className="text-slate-600">{order.notes}</p>
                  </div>
                )}
                {order.fbrInvoiceNo && (
                  <div className="col-span-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center gap-2 text-sm">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-800">
                      FBR invoice <b>{order.fbrInvoiceNo}</b> · {formatDate(order.fbrInvoiceAt)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <Card title={`Items (${order.items.length})`}>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="pb-2">Item</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td className="py-2 font-medium text-slate-800">{i.title}</td>
                      <td className="py-2 text-right">{i.quantity}</td>
                      <td className="py-2 text-right text-slate-600">{formatPKR(i.price)}</td>
                      <td className="py-2 text-right font-semibold">{formatPKR(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-sm">
                <Row l="Subtotal" v={formatPKR(order.subtotal)} />
                {order.discountAmount > 0 && (
                  <Row l="Discount" v={`− ${formatPKR(order.discountAmount)}`} />
                )}
                <Row l="Shipping fee" v={formatPKR(order.shippingFee)} />
                <Row l="Total" v={formatPKR(order.totalAmount)} bold />
              </div>
            </Card>

            {/* Fulfillments */}
            <Card
              title={`Fulfillments (${order.fulfillments.length})`}
              subtitle={
                order.fulfillments.length === 0
                  ? 'Not packed yet — use the actions panel'
                  : undefined
              }
            >
              {order.fulfillments.length === 0 ? (
                <Empty msg="No shipments yet." />
              ) : (
                <div className="space-y-2.5">
                  {order.fulfillments.map((f) => (
                    <div key={f.id} className="border border-slate-100 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 items-center">
                          <Pill value={f.status} />
                          {f.carrier && <span className="font-semibold text-slate-700">{f.carrier}</span>}
                          {f.trackingNumber && (
                            <span className="text-slate-500 mono">{f.trackingNumber}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(f.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {f.items.map((fi) => {
                          const item = order.items.find((i) => i.id === fi.orderItemId);
                          return `${item?.title ?? 'item'} × ${fi.quantity}`;
                        }).join(' · ')}
                      </p>
                      {f.shippedAt && (
                        <p className="text-xs text-slate-400">shipped {formatDate(f.shippedAt)}</p>
                      )}
                      {f.deliveredAt && (
                        <p className="text-xs text-emerald-600">delivered {formatDate(f.deliveredAt)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Refunds */}
            {order.refunds.length > 0 && (
              <Card title={`Refunds (${order.refunds.length})`}>
                <div className="space-y-2 text-sm">
                  {order.refunds.map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                      <div>
                        <span className="font-semibold text-slate-800">{formatPKR(r.amount)}</span>
                        {r.reason && <span className="text-slate-500"> — {r.reason}</span>}
                        {r.restock && <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 rounded">restocked</span>}
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: actions */}
          <div className="space-y-5">
            <Card title="Actions">
              <div className="space-y-4">
                {/* status flow */}
                <div>
                  <p className={label}>Update status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDER_STATUSES.filter((s) => s !== order.orderStatus).map((s) => (
                      <button
                        key={s}
                        disabled={busy}
                        onClick={() => setStatus(s)}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-emerald-600 hover:text-white transition disabled:opacity-40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COD OTP */}
                {order.paymentMethod === 'COD' && order.codVerification && !order.codVerification.isVerified && order.orderStatus === 'PENDING' && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-800 uppercase mb-2">COD OTP verification</p>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      className={`${input} mb-2`}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || otp.length !== 6}
                        onClick={() =>
                          run('OTP verified', () =>
                            api(`/orders/${order.id}/verify-otp`, {
                              method: 'POST',
                              body: { orderId: order.id, otpCode: otp },
                            }),
                          )
                        }
                        className={`${btnPrimary} ${btnSm} flex-1`}
                      >
                        Verify OTP
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => run('OTP resent', () => api(`/orders/${order.id}/resend-otp`, { method: 'POST' }))}
                        className={`${btnGhost} ${btnSm}`}
                      >
                        <Send className="w-3.5 h-3.5" /> Resend
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1">
                      attempts used: {order.codVerification.attempts}
                      {order.codVerification.expiresAt ? ` · expires ${formatDate(order.codVerification.expiresAt)}` : ''}
                    </p>
                  </div>
                )}
                {order.codVerification?.isVerified && (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> OTP verified {formatDate(order.codVerification.verifiedAt)}
                  </p>
                )}

                {/* courier rates + booking */}
                {!tracking && (
                  <div>
                    <p className={label}>Courier — compare & book</p>
                    {rates === null ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          run('Rates fetched', () =>
                            api<any>('/couriers/rates', {
                              method: 'POST',
                              body: { city: order.shippingCity, weightGrams },
                            }).then((res) => {
                              const list = res.rates || res;
                              setRates(
                                (Array.isArray(list) ? list : list.rates || []).map((r: any) => ({
                                  courier: r.courier,
                                  serviceCharge: r.serviceCharge ?? r.rate ?? 0,
                                  codFee: r.codFee ?? 0,
                                  etaMin: r.estimatedDays?.min ?? r.etaMin ?? 0,
                                  etaMax: r.estimatedDays?.max ?? r.etaMax ?? 0,
                                })),
                              );
                              setCityGroup(res.cityGroup || 'STANDARD');
                            }),
                          )
                        }
                        className={`${btnGhost} w-full`}
                      >
                        <Truck className="w-4 h-4" /> Get rates ({weightGrams}g → {order.shippingCity})
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Group: {cityGroup}</p>
                        {rates.map((r) => (
                          <button
                            key={r.courier}
                            disabled={busy}
                            onClick={() => bookCourier(r.courier)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-sm transition disabled:opacity-40"
                          >
                            <span>
                              <span className="font-semibold text-slate-800">{r.courier}</span>
                              <span className="ml-1.5 text-[10px] text-slate-400">
                                {r.etaMin}-{r.etaMax} days
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="font-bold">{formatPKR(r.serviceCharge)}</span>
                              {r.codFee > 0 && (
                                <span className="block text-[10px] text-slate-400">+COD fee {formatPKR(r.codFee)}</span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tracking && (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-sm">
                    <p className="font-bold text-emerald-800">
                      Booked: {tracking.carrier ?? tracking.courier}
                    </p>
                    <p className="text-emerald-700">Tracking #: {tracking.trackingNumber}</p>
                    {Array.isArray(tracking.events) && tracking.events.length > 0 && (
                      <ul className="text-xs text-emerald-700 mt-1 list-disc pl-4 space-y-0.5">
                        {tracking.events
                          .slice(0, 4)
                          .reverse()
                          .map((ev: any, i: number) => (
                            <li key={i}>
                              {ev.label ?? ev.note ?? ''}
                              {ev.at ? ` — ${formatDate(ev.at)}` : ''}
                            </li>
                          ))}
                      </ul>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => track(tracking.trackingNumber)}
                        disabled={busy || !tracking.trackingNumber}
                        className={`${btnGhost} ${btnSm}`}
                      >
                        <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} /> Refresh tracking
                      </button>
                    </div>
                  </div>
                )}

                {/* fulfill */}
                <div>
                  <p className={label}>Fulfillment</p>
                  <div className="flex gap-2">
                    <button
                      disabled={busy || fullyFulfilled}
                      onClick={() =>
                        run('Order fulfilled', () =>
                          api(`/orders/${order.id}/fulfillments`, {
                            method: 'POST',
                            body: trackNumber || carrier ? { trackingNumber: trackNumber || undefined, carrier: carrier || undefined } : {},
                          }),
                        )
                      }
                      className={`${btnPrimary} flex-1`}
                    >
                      <Package className="w-4 h-4" /> {fullyFulfilled ? 'Fulfilled' : 'Fulfill all'}
                    </button>
                    <button
                      onClick={() => {
                        setPartialQty(Object.fromEntries(order.items.map((i) => [i.id, String(i.quantity)])));
                        setPartialOpen(true);
                      }}
                      className={btnGhost}
                    >
                      <Plus className="w-4 h-4" /> Partial
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      placeholder="Tracking # (optional)"
                      value={trackNumber}
                      onChange={(e) => setTrackNumber(e.target.value)}
                      className={input}
                    />
                    <input
                      placeholder="Courier"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className={`${input} !w-28`}
                    />
                  </div>
                </div>

                {/* refund + FBR */}
                <div>
                  <p className={label}>Refund & compliance</p>
                  <div className="flex gap-2">
                    <button onClick={() => setRefundOpen(true)} className={`${btnDanger} flex-1`}>
                      <RotateCcw className="w-4 h-4" /> Refund
                    </button>
                    <button
                      disabled={busy || !!order.fbrInvoiceNo}
                      onClick={() =>
                        run('FBR invoice issued', () =>
                          api(`/orders/${order.id}/fbr-invoice`, { method: 'POST' }),
                        )
                      }
                      className={btnGhost}
                      title={order.fbrInvoiceNo ? 'Already issued' : 'Issue FBR sandbox invoice'}
                    >
                      <FileCheck2 className="w-4 h-4" /> FBR
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Refund modal */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title={`Refund ${order.orderNumber}`}>
        <div className="space-y-3">
          <div>
            <p className={label}>Amount (blank = full {formatPKR(order.totalAmount)})</p>
            <input
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder={String(order.totalAmount)}
              className={input}
            />
          </div>
          <div>
            <p className={label}>Reason</p>
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className={input} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={refundRestock} onChange={(e) => setRefundRestock(e.target.checked)} />
            Restock returned items (default: money-only)
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              const body: any = {};
              if (refundAmount) body.amount = Number(refundAmount);
              if (refundReason) body.reason = refundReason;
              if (refundRestock) body.restock = true;
              await run('Refund processed', () =>
                api(`/orders/${order.id}/refund`, { method: 'POST', body }),
              );
              setRefundOpen(false);
            }}
            className={`${btnDanger} w-full`}
          >
            Process refund
          </button>
        </div>
      </Modal>

      {/* Partial fulfillment modal */}
      <Modal open={partialOpen} onClose={() => setPartialOpen(false)} title="Partial fulfillment">
        <div className="space-y-2 mb-4">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex-1 font-medium text-slate-700">{i.title}</span>
              <span className="text-xs text-slate-400">ordered {i.quantity}</span>
              <input
                value={partialQty[i.id] ?? ''}
                onChange={(e) =>
                  setPartialQty((p) => ({ ...p, [i.id]: e.target.value.replace(/\D/g, '') }))
                }
                className={`${input} !w-20 text-right`}
              />
            </div>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            const items = order.items
              .map((i) => ({ orderItemId: i.id, quantity: Number(partialQty[i.id] || 0) }))
              .filter((x) => x.quantity > 0 && x.quantity <= (order.items.find((i) => i.id === x.orderItemId)?.quantity ?? 0));
            if (items.length === 0) return;
            await run('Partial fulfillment created', () =>
              api(`/orders/${order.id}/fulfillments`, {
                method: 'POST',
                body: { items, trackingNumber: trackNumber || undefined, carrier: carrier || undefined },
              }),
            );
            setPartialOpen(false);
          }}
          className={`${btnPrimary} w-full`}
        >
          Create partial fulfillment
        </button>
      </Modal>
    </AppShell>
  );
}

function Row({ l, v, bold = false }: { l: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{l}</span>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-700'}>{v}</span>
    </div>
  );
}
