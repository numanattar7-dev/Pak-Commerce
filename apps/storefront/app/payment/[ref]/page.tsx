'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, Loader2, ShieldAlert, Wallet } from 'lucide-react';
import { formatPKR, initiatePayment, simulatePayment } from '@/lib/api';

export default function PaymentPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-14 w-full">
      <Suspense
        fallback={
          <div className="text-center text-slate-400 text-sm py-16">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading checkout…
          </div>
        }
      >
        <SimulatedCheckout />
      </Suspense>
    </main>
  );
}

/**
 * Sandbox mock of the gateway-hosted checkout page.
 * Only reachable while the store has no live gateway credentials — the backend
 * rejects simulation the moment real credentials are configured.
 */
function SimulatedCheckout() {
  const params = useParams<{ ref: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const gatewayTxRef = (params?.ref as string) || '';
  const orderNumber = search.get('order') || '';
  const phone = search.get('phone') || '';

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<'PAY' | 'FAIL' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ method: string; amount: number; simulation: boolean } | null>(null);

  // Resume the open payment attempt to render the same transaction
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await initiatePayment(orderNumber, phone);
        if (!alive) return;
        setInfo({
          method: res.method,
          amount: res.amount,
          simulation: res.simulation ?? false,
        });
      } catch (e: any) {
        if (alive) setError(e?.message || 'Payment session not found');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (outcome: 'SUCCESS' | 'FAILED') => {
    setProcessing(outcome === 'SUCCESS' ? 'PAY' : 'FAIL');
    setError(null);
    try {
      const res = await simulatePayment({ gatewayTxRef, orderNumber, phone, outcome });
      if (res.status === 'SUCCEEDED') {
        router.replace(`/order/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`);
      } else {
        setInfo(null);
        setError('The simulated payment was declined. You can try again from the order page.');
        setProcessing(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Simulation failed');
      setProcessing(null);
    }
  };

  const gatewayLabel =
    info?.method === 'JAZZCASH' ? 'JazzCash' : info?.method === 'EASYPAISA' ? 'Easypaisa' : info?.method || 'Wallet';

  if (!orderNumber || !phone) {
    return (
      <div className="text-center py-16">
        <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-black text-slate-900">Missing payment context</h1>
        <p className="text-sm text-slate-500 mt-2">This checkout link is incomplete.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Opening {gatewayLabel} checkout…
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="text-center py-16">
        <CircleAlert className="w-10 h-10 text-red-300 mx-auto mb-4" />
        <h1 className="text-xl font-black text-slate-900">Payment unavailable</h1>
        <p className="text-sm text-slate-500 mt-2">{error}</p>
        <Link
          href={`/order/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`}
          className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition"
        >
          Back to order
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* sandbox banner */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-5">
        <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Sandbox checkout — no real money moves
        </p>
        <p className="text-[11px] text-amber-700 mt-1">
          Simulated {gatewayLabel} checkout for testing. Live {gatewayLabel} charges activate automatically once
          real merchant credentials are configured.
        </p>
      </div>

      {/* gateway chrome */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5" />
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">{gatewayLabel} Secure Checkout</p>
              <p className="text-[10px] text-slate-400">Merchant: Khaadi Store</p>
            </div>
          </div>
          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            SSL SECURED
          </span>
        </div>

        <div className="px-5 py-5 space-y-3">
          <Row label="Order" value={orderNumber} mono />
          <Row label="Reference" value={gatewayTxRef} mono />
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Amount payable</span>
            <span className="text-xl font-black text-slate-900">{formatPKR(info?.amount ?? 0)}</span>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2.5">
          <button
            onClick={() => finish('SUCCESS')}
            disabled={processing !== null}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black py-3.5 rounded-xl transition flex items-center justify-center gap-2"
          >
            {processing === 'PAY' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {processing === 'PAY' ? 'Authorizing…' : `Pay with ${gatewayLabel}`}
          </button>
          <button
            onClick={() => finish('FAILED')}
            disabled={processing !== null}
            className="w-full bg-white hover:bg-slate-50 disabled:opacity-50 text-red-600 border border-red-200 text-xs font-bold py-2.5 rounded-xl transition"
          >
            Simulate a failed payment
          </button>
          <p className="text-[10px] text-slate-400 text-center pt-1">
            Sandbox endpoint · your phone verifies this order · {gatewayTxRef.slice(0, 24)}…
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs font-bold text-red-600 mt-4 flex items-center gap-1.5 text-center justify-center">
          <XCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <div className="text-center mt-5">
        <Link
          href={`/order/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`}
          className="text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          ← Back to order status
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-bold text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
