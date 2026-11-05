'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  Building,
  CheckCircle2,
  Loader2,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useCart, rememberLastOrder } from '@/lib/cart';
import { useStore } from '@/lib/store';
import { PAKISTANI_CITIES } from '@/lib/cities';
import {
  ApiError,
  PlaceOrderPayload,
  formatPKR,
  placeOrder,
  validateDiscount,
} from '@/lib/api';

const PAYMENT_OPTIONS: Array<{
  id: PlaceOrderPayload['paymentMethod'];
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'COD', label: 'Cash on Delivery', hint: 'Pay cash when it arrives (recommended)', icon: Banknote },
  { id: 'RAAST', label: 'Raast', hint: 'Instant PKR payment', icon: Smartphone },
  { id: 'IBFT', label: 'Bank Transfer (IBFT)', hint: 'Share transfer proof with the merchant', icon: Building },
  { id: 'JAZZCASH', label: 'JazzCash', hint: 'Mobile wallet payment', icon: Smartphone },
  { id: 'EASYPAISA', label: 'Easypaisa', hint: 'Mobile wallet payment', icon: Wallet },
];

type AppliedDiscount = { code: string; amount: number; label: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, count, clear, hydrated } = useCart();
  const { customization: cfg } = useStore();

  // merchant-enabled payment methods only (Customize Store → Payments)
  const enabledMethods = PAYMENT_OPTIONS.filter(
    (o) => cfg.payments[o.id as keyof typeof cfg.payments] !== false,
  );

  // form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingCity, setShippingCity] = useState('Karachi');
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PlaceOrderPayload['paymentMethod']>('COD');

  // keep the selected method valid when the merchant disables it
  useEffect(() => {
    if (!enabledMethods.some((o) => o.id === paymentMethod) && enabledMethods.length) {
      setPaymentMethod(enabledMethods[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.payments]);

  // discount state
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountMsg, setDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hydrated && items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center w-full">
        <h1 className="text-xl font-black text-slate-900">Nothing to check out</h1>
        <p className="text-sm text-slate-500 mt-2">Your cart is empty.</p>
        <Link
          href="/products"
          className="inline-flex mt-6 bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] text-white font-bold text-sm px-6 py-3 rounded-xl transition"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const phoneValid = /^03\d{9}$/.test(customerPhone);

  const applyDiscount = async () => {
    const code = discountInput.trim().toUpperCase();
    if (!code) return;
    setCheckingDiscount(true);
    setDiscountMsg(null);
    try {
      const res = await validateDiscount({
        code,
        subtotal,
        phone: customerPhone || undefined,
      });
      if (res.valid && res.discount) {
        setAppliedDiscount({
          code: res.discount.code,
          amount: Number(res.discountAmount ?? 0),
          label: describeDiscount(res.discount.type, res.discount.value),
        });
        setDiscountMsg({
          ok: true,
          text: `Code ${res.discount.code} applied — you save ${formatPKR(res.discountAmount ?? 0)}`,
        });
      } else {
        setAppliedDiscount(null);
        setDiscountMsg({ ok: false, text: res.reason || 'This code is not valid' });
      }
    } catch (e: any) {
      setAppliedDiscount(null);
      setDiscountMsg({ ok: false, text: e?.message || 'Could not validate the code' });
    } finally {
      setCheckingDiscount(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValid) {
      setError('Phone must be 11 digits starting with 03 (e.g. 03001234567)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: PlaceOrderPayload = {
        subdomain: 'khaadi',
        customerName: customerName.trim(),
        customerPhone,
        shippingCity,
        shippingAddress: shippingAddress.trim(),
        paymentMethod,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(appliedDiscount ? { discountCode: appliedDiscount.code } : {}),
      };
      const order = await placeOrder(payload);
      if (!order?.orderNumber) throw new Error('Order could not be placed');
      rememberLastOrder(order.orderNumber, customerPhone);
      clear();
      router.replace(`/order/${order.orderNumber}?phone=${customerPhone}`);
    } catch (err: any) {
      const detail =
        err instanceof ApiError ? err.detail || err.message : err?.message || 'Order failed';
      setError(detail);
      setSubmitting(false);
    }
  };

  const estimatedTotal = Math.max(0, subtotal - (appliedDiscount?.amount ?? 0));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Checkout</h1>
        <p className="text-xs text-slate-500 mt-1">
          {count} item{count === 1 ? '' : 's'} · totals are verified server-side
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6 flex items-start gap-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-8">
        {/* form */}
        <form onSubmit={submit} className="lg:col-span-3 space-y-6" noValidate={false}>
          {/* contact */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-4">
              Contact Information
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Ahmed Raza"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                  }
                  placeholder="03001234567"
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)] ${
                    customerPhone && !phoneValid ? 'border-red-400' : 'border-slate-300'
                  }`}
                />
                {customerPhone && !phoneValid && (
                  <p className="text-[10px] text-red-500 mt-1 font-semibold">
                    11 digits starting with 03
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)]"
                />
              </div>
            </div>
          </section>

          {/* shipping */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-4">
              Delivery Address
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City *</label>
                <select
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)]"
                >
                  {PAKISTANI_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Complete Address *
                </label>
                <textarea
                  required
                  rows={3}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="House / Street / Area — include a landmark for the courier"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)] resize-none"
                />
              </div>
              {cfg.checkout.allowNotes !== false && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Order Notes (Optional)
                  </label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Call before delivery"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)]"
                  />
                </div>
              )}
            </div>
          </section>

          {/* payment */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-widest mb-4">
              Payment Method
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {enabledMethods.map((opt) => {
                const Icon = opt.icon;
                const active = paymentMethod === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                      active
                        ? 'border-[var(--pk-primary)] bg-[var(--pk-primary-soft)] ring-2 ring-[var(--pk-primary-soft)]'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 mt-0.5 ${active ? 'text-[var(--pk-primary)]' : 'text-slate-400'}`}
                    />
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{opt.label}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{opt.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || !hydrated}
            className="w-full lg:w-auto bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] disabled:opacity-50 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Placing your order…
              </>
            ) : (
              <>Place Order · {formatPKR(estimatedTotal)}</>
            )}
          </button>
          <p className="text-[10px] text-slate-400 -mt-3">
            By placing the order you agree to the store&apos;s exchange policy. COD orders
            require OTP verification over SMS.
          </p>
        </form>

        {/* summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-24">
            <h2 className="font-black text-slate-900 mb-4">Order Summary</h2>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3 items-center">
                  <div className="w-12 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image || ''}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {item.variantTitle} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {formatPKR(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* discount */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Discount Code
              </label>
              <div className="flex gap-2">
                <input
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                  placeholder="SUMMER20"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[var(--pk-primary-soft)] focus:border-[var(--pk-primary)] font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={checkingDiscount || !discountInput.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                >
                  {checkingDiscount ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Apply'
                  )}
                </button>
              </div>
              {discountMsg && (
                <p
                  className={`text-[11px] font-bold mt-2 flex items-start gap-1.5 ${
                    discountMsg.ok ? 'text-[var(--pk-primary)]' : 'text-red-500'
                  }`}
                >
                  {discountMsg.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  )}
                  {discountMsg.text}
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">{formatPKR(subtotal)}</span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-[var(--pk-primary)]">
                  <span>Discount ({appliedDiscount.code})</span>
                  <span className="font-bold">− {formatPKR(appliedDiscount.amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-slate-400 text-xs font-semibold">
                  Calculated on placement
                </span>
              </div>
              <div className="flex justify-between font-black text-slate-900 text-base pt-3 border-t border-slate-100">
                <span>Estimated Total</span>
                <span className="text-[var(--pk-primary-text)]">{formatPKR(estimatedTotal)}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                The store server recomputes final totals from live prices — your quoted
                figures are a preview.
              </p>
            </div>

            <Link
              href="/cart"
              className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to cart
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function describeDiscount(type: string, value: number): string {
  if (type === 'PERCENTAGE') return `${value}% off`;
  if (type === 'FIXED') return `PKR ${value} off`;
  return 'Free shipping';
}
