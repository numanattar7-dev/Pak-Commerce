'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Phone } from 'lucide-react';
import { useCart, getLastOrder } from '@/lib/cart';

export default function TrackPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prefill with the last order placed on this device
  React.useEffect(() => {
    const last = getLastOrder();
    if (last) {
      setOrderNumber((v) => v || last.orderNumber);
      setPhone((v) => v || last.phone);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = orderNumber.trim();
    if (!/^PK-[A-Z0-9]+$/i.test(num)) {
      setError('Order number looks like PK-XXXXXXX (check your confirmation SMS)');
      return;
    }
    if (!/^03\d{9}$/.test(phone.trim())) {
      setError('Enter the 11-digit phone number used at checkout (starting with 03)');
      return;
    }
    router.push(`/order/${encodeURIComponent(num.toUpperCase())}?phone=${encodeURIComponent(phone.trim())}`);
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-16 w-full">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-7 h-7 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Track Your Order</h1>
        <p className="text-sm text-slate-500 mt-2">
          Enter the order number from your confirmation SMS and the phone number you
          used at checkout.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Order Number *
          </label>
          <input
            required
            value={orderNumber}
            onChange={(e) =>
              setOrderNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
            }
            placeholder="PK-KKKSS9ZF"
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 font-mono font-bold tracking-wide"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              required
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="03001234567"
              className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          Track Order
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          Need help? Contact the store on WhatsApp with your order number.
        </p>
      </form>

      <p className="text-center text-xs text-slate-400 mt-6">
        Haven&apos;t ordered yet?{' '}
        <Link href="/products" className="font-bold text-emerald-600 hover:underline">
          Browse the collection
        </Link>
      </p>
    </main>
  );
}
