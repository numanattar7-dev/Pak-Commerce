'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { useCart, getLastOrder } from '@/lib/cart';
import { useStore } from '@/lib/store';
import {
  PaymentInitiation,
  TrackedOrder,
  formatPKR,
  initiatePayment,
  resendOtpPublic,
  submitBankProof,
  trackOrder,
  verifyOtpPublic,
} from '@/lib/api';

const FLOW: Array<{ id: string; label: string }> = [
  { id: 'PENDING', label: 'Placed' },
  { id: 'VERIFIED', label: 'Verified' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'DISPATCHED', label: 'Dispatched' },
  { id: 'DELIVERED', label: 'Delivered' },
];

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          Loading order…
        </div>
      }
    >
      <OrderStatusInner />
    </Suspense>
  );
}

function OrderStatusInner() {
  const params = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const { customization: cfg } = useStore();
  const orderNumber = decodeURIComponent(params?.orderNumber || '');

  const queryPhone = search.get('phone') || '';
  const [fallbackPhone, setFallbackPhone] = useState('');

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // COD OTP state
  const [otp, setOtp] = useState('');
  const [otpMsg, setOtpMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Remember the phone from the last order placed on this device
  useEffect(() => {
    const last = getLastOrder();
    if (last?.orderNumber === orderNumber) setFallbackPhone(last.phone);
  }, [orderNumber]);

  const phone = queryPhone || fallbackPhone;

  const load = useCallback(async () => {
    if (!orderNumber || !phone) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await trackOrder(orderNumber, phone);
      setOrder(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Order not found');
    } finally {
      setLoading(false);
    }
  }, [orderNumber, phone]);

  useEffect(() => {
    load();
  }, [load]);

  const verifyOtp = async () => {
    setVerifying(true);
    setOtpMsg(null);
    try {
      const res = await verifyOtpPublic({ orderNumber, phone, otpCode: otp });
      setOtpMsg({ ok: true, text: res.message || 'Order verified' });
      setOtp('');
      await load();
    } catch (e: any) {
      setOtpMsg({ ok: false, text: e?.message || 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    setResending(true);
    setOtpMsg(null);
    try {
      const res = await resendOtpPublic({ orderNumber, phone });
      setOtpMsg({ ok: true, text: res.message || 'A new OTP has been sent' });
      setOtp('');
      await load();
    } catch (e: any) {
      setOtpMsg({ ok: false, text: e?.message || 'Could not resend OTP' });
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Loading order details…
      </div>
    );
  }

  if (!orderNumber || !phone) {
    return (
      <MissingOrder
        title="Missing order details"
        body="We need the phone number used at checkout to open this order."
      />
    );
  }

  if (error || !order) {
    return (
      <MissingOrder
        title="Order not found"
        body={error || 'Check the order number and phone number, then try again.'}
        showTrackLink
      />
    );
  }

  const isCancelled = order.orderStatus === 'CANCELLED' || order.orderStatus === 'RTO';
  const currentIdx = FLOW.findIndex((f) => f.id === order.orderStatus);

  const codOtpPending =
    order.paymentMethod === 'COD' &&
    order.orderStatus === 'PENDING' &&
    order.codVerification &&
    !order.codVerification.isVerified;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900">{order.orderNumber}</h1>
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                order.orderStatus === 'DELIVERED'
                  ? 'bg-[var(--pk-primary)] text-white'
                  : order.orderStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : order.orderStatus === 'CANCELLED'
                      ? 'bg-red-100 text-red-700'
                      : order.orderStatus === 'RTO'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
              }`}
            >
              {order.orderStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Placed {new Date(order.createdAt).toLocaleString('en-PK', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            · {order.paymentMethod}
          </p>
        </div>
        <button
          onClick={load}
          className="w-fit text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-white border border-slate-200 px-3.5 py-2 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {!isCancelled && <FlowBar currentIdx={currentIdx} />}

      {/* merchant confirmation message (Customize Store → Checkout) */}
      {!isCancelled && cfg.checkout.confirmationMsg && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 mb-6 text-sm text-slate-700 font-medium">
          {cfg.checkout.confirmationMsg}
        </div>
      )}

      {isCancelled && (
        <div
          className={`rounded-2xl border p-5 mb-6 text-sm font-bold ${
            order.orderStatus === 'CANCELLED'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-orange-50 border-orange-200 text-orange-700'
          }`}
        >
          {order.orderStatus === 'CANCELLED'
            ? 'This order was cancelled. If this is unexpected, contact the store.'
            : 'This shipment was returned to the origin warehouse (RTO).'}
        </div>
      )}

      {/* COD OTP panel */}
      {(codOtpPending || (order.codVerification?.isVerified && order.paymentMethod === 'COD')) && (
        <div
          className={`rounded-2xl border p-5 mb-6 ${
            order.codVerification?.isVerified
              ? 'bg-[var(--pk-primary-soft)] border-[var(--pk-primary-softer)]'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {order.codVerification?.isVerified ? (
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--pk-primary-text)]">
              <ShieldCheck className="w-5 h-5" /> COD order verified — the store can pack
              and dispatch it now.
            </p>
          ) : (
            <>
              <h2 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
                <Send className="w-4 h-4" /> Confirm your COD order
              </h2>
              <p className="text-xs text-amber-700 mt-1.5">
                Enter the 6-digit code we sent to <b>{order.customerPhone}</b> (via SMS and
                WhatsApp) to confirm your cash-on-delivery order.
              </p>
              {order.codVerification?.expiresAt && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Code expires{' '}
                  {new Date(order.codVerification.expiresAt).toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {order.codVerification.attempts > 0 &&
                    ` · ${order.codVerification.attempts} wrong attempt${order.codVerification.attempts === 1 ? '' : 's'}`}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  className="w-40 px-3.5 py-2.5 text-sm rounded-xl border border-amber-300 bg-white outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-500 font-mono font-black tracking-widest"
                />
                <button
                  onClick={verifyOtp}
                  disabled={verifying || otp.length !== 6}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-1.5"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Verify
                </button>
                <button
                  onClick={resendOtp}
                  disabled={resending}
                  className="bg-white hover:bg-amber-100 disabled:opacity-40 text-amber-700 border border-amber-300 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  {resending ? 'Resending…' : 'Resend code'}
                </button>
              </div>
              {otpMsg && (
                <p
                  className={`text-xs font-bold mt-2 flex items-center gap-1.5 ${
                    otpMsg.ok ? 'text-[var(--pk-primary-text)]' : 'text-red-600'
                  }`}
                >
                  {otpMsg.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {otpMsg.text}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* online payment panel */}
      {order.paymentMethod !== 'COD' && (
        <PaymentPanel order={order} phone={phone} />
      )}

      {/* shipments */}
      {(order.fulfillments?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[var(--pk-primary)]" /> Shipment
          </h2>
          <div className="space-y-3">
            {order.fulfillments!.map((f) => (
              <div key={f.id} className="border border-slate-100 rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">
                    {f.carrier || 'Courier'}
                    {f.trackingNumber && (
                      <span className="font-mono text-xs text-slate-500 ml-2">
                        #{f.trackingNumber}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {f.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Created{' '}
                  {new Date(f.createdAt).toLocaleString('en-PK', { dateStyle: 'medium' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* items + totals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--pk-primary)]" /> Items (
          {order.items.length})
        </h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="py-2.5 font-medium text-slate-800">{i.title}</td>
                <td className="py-2.5 text-right text-slate-500">× {i.quantity}</td>
                <td className="py-2.5 text-right font-bold text-slate-900">
                  {formatPKR(i.price * i.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatPKR(order.subtotal)} />
          {order.discountAmount > 0 && (
            <Row
              label="Discount"
              value={`− ${formatPKR(order.discountAmount)}`}
              green
            />
          )}
          <Row label="Shipping fee" value={formatPKR(order.shippingFee)} />
          <Row label="Total" value={formatPKR(order.totalAmount)} bold />
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Deliver to</p>
            <p className="font-bold text-slate-800 mt-0.5">{order.customerName}</p>
            <p className="text-slate-500">{order.customerPhone}</p>
            <p className="text-slate-500">
              {order.shippingCity} — {order.shippingAddress}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Payment</p>
            <p className="font-bold text-slate-800 mt-0.5">
              {order.paymentMethod} · {order.paymentStatus}
            </p>
            <p className="text-slate-500">
              {order.paymentMethod === 'COD'
                ? 'Pay cash at doorstep'
                : 'Share payment proof with the store'}
            </p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-[10px] font-black text-slate-400 uppercase">Notes</p>
              <p className="text-slate-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link href="/products" className="text-xs font-bold text-[var(--pk-primary)] hover:underline">
          Continue shopping →
        </Link>
      </div>
    </main>
  );
}

function FlowBar({ currentIdx }: { currentIdx: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center">
        {FLOW.map((f, i) => {
          const done = i <= currentIdx;
          const last = i === FLOW.length - 1;
          return (
            <React.Fragment key={f.id}>
              <div className="flex flex-col items-center shrink-0">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition ${
                    done
                      ? 'bg-[var(--pk-primary)] border-[var(--pk-primary)] text-white'
                      : 'bg-white border-slate-200 text-slate-300'
                  }`}
                >
                  {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </span>
                <span
                  className={`text-[9px] font-bold mt-1.5 uppercase tracking-wide ${
                    done ? 'text-[var(--pk-primary-text)]' : 'text-slate-300'
                  }`}
                >
                  {f.label}
                </span>
              </div>
              {!last && (
                <div
                  className={`flex-1 h-0.5 mx-1.5 -mt-4 ${i < currentIdx ? 'bg-[var(--pk-primary-soft)]0' : 'bg-slate-200'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold = false,
  green = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          bold
            ? 'font-black text-slate-900 text-base'
            : green
              ? 'font-bold text-[var(--pk-primary)]'
              : 'font-semibold text-slate-800'
        }
      >
        {value}
      </span>
    </div>
  );
}

function MissingOrder({
  title,
  body,
  showTrackLink = false,
}: {
  title: string;
  body: string;
  showTrackLink?: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center w-full">
      <Package className="w-10 h-10 text-slate-300 mx-auto mb-4" />
      <h1 className="text-xl font-black text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2">{body}</p>
      <Link
        href="/track"
        className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition"
      >
        Enter order details
      </Link>
      {showTrackLink && (
        <Link
          href="/products"
          className="inline-flex items-center gap-2 mt-6 ml-2 text-xs font-bold text-[var(--pk-primary)] hover:underline"
        >
          Continue shopping →
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment panel — wallet checkout redirect / bank-transfer instructions + proof
// ---------------------------------------------------------------------------

function PaymentPanel({
  order,
  phone,
}: {
  order: TrackedOrder;
  phone: string;
}) {
  const wallet =
    order.paymentMethod === 'JAZZCASH' || order.paymentMethod === 'EASYPAISA';
  const gatewayLabel =
    order.paymentMethod === 'JAZZCASH'
      ? 'JazzCash'
      : order.paymentMethod === 'EASYPAISA'
        ? 'Easypaisa'
        : order.paymentMethod;

  const [init, setInit] = useState<PaymentInitiation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  // Bank-transfer proof form
  const [bankName, setBankName] = useState('');
  const [txRef, setTxRef] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const start = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await initiatePayment(order.orderNumber, phone);
      setInit(res);
      if (res.redirectUrl && wallet) {
        window.location.href = res.redirectUrl;
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not start payment');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderNumber, phone, wallet]);

  // IBFT/RAAST — load instructions automatically once
  useEffect(() => {
    if (!wallet && order.paymentStatus !== 'PAID') {
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.orderNumber]);

  const submitProof = async () => {
    if (!init) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await submitBankProof({
        orderNumber: order.orderNumber,
        phone,
        gatewayTxRef: init.gatewayTxRef,
        bankName,
        transactionRef: txRef,
        receiptImageUrl: receiptUrl || undefined,
      });
      setDoneMsg(res.message);
    } catch (e: any) {
      setErr(e?.message || 'Could not submit proof');
    } finally {
      setBusy(false);
    }
  };

  // Paid state
  if (order.paymentStatus === 'PAID') {
    return (
      <div className="rounded-2xl border border-[var(--pk-primary-softer)] bg-[var(--pk-primary-soft)] p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--pk-primary-text)]">
          <ShieldCheck className="w-5 h-5" /> Payment of {formatPKR(order.totalAmount)} received via{' '}
          {gatewayLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
      <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
        {wallet ? (
          <CreditCard className="w-4 h-4 text-blue-600" />
        ) : (
          <Landmark className="w-4 h-4 text-blue-600" />
        )}
        Pay {formatPKR(order.totalAmount)} — {gatewayLabel}
      </h2>

      {/* wallet flow */}
      {wallet && (
        <>
          <p className="text-xs text-blue-800 mt-1.5">
            Continue to the secured {gatewayLabel} checkout to pay for this order now.
          </p>
          {init?.simulation && (
            <p className="text-[11px] text-amber-700 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              Sandbox mode: you&apos;ll see a simulated checkout page — no real charge happens until
              live {gatewayLabel} credentials are configured.
            </p>
          )}
          <button
            onClick={start}
            disabled={busy}
            className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black px-6 py-3 rounded-xl transition flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {init ? 'Resume payment' : 'Pay now'}
          </button>
        </>
      )}

      {/* manual flow — instructions + proof form */}
      {!wallet && (
        <>
          {init?.instructions && (
            <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-3.5 font-sans leading-relaxed">
              {init.instructions}
            </pre>
          )}
          {init?.gatewayTxRef && (
            <p className="text-[10px] text-slate-400 mt-2">
              Payment reference: <span className="font-mono">{init.gatewayTxRef}</span>
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Your bank (e.g. Meezan Bank)"
              className="px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
            <input
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              placeholder="Transaction reference / DIRS"
              className="px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
            />
            <input
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="Screenshot URL (optional)"
              className="px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 sm:col-span-2"
            />
          </div>
          <button
            onClick={submitProof}
            disabled={busy || !bankName.trim() || !txRef.trim()}
            className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-black px-6 py-3 rounded-xl transition flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit payment proof
          </button>
        </>
      )}

      {doneMsg && (
        <p className="text-xs font-bold text-[var(--pk-primary-text)] mt-2.5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> {doneMsg}
        </p>
      )}
      {err && (
        <p className="text-xs font-bold text-red-600 mt-2.5 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" /> {err}
        </p>
      )}
    </div>
  );
}
