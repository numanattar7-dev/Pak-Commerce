'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatPKR } from '@/lib/api';

export default function CartPage() {
  const { items, subtotal, count, setQty, remove, clear, hydrated } = useCart();

  if (!hydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 w-full">
        <div className="bg-slate-200 animate-pulse h-64 rounded-2xl max-w-md" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center w-full">
        <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-black text-slate-900">Your cart is empty</h1>
        <p className="text-sm text-slate-500 mt-2">
          Browse the collection and add something you love.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 mt-6 bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] text-white font-bold text-sm px-6 py-3 rounded-xl transition"
        >
          Start Shopping <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Your Cart</h1>
          <p className="text-xs text-slate-500 mt-1">
            {count} item{count === 1 ? '' : 's'} ·{' '}
            <Link href="/products" className="text-[var(--pk-primary)] font-bold hover:underline">
              continue shopping
            </Link>
          </p>
        </div>
        <button
          onClick={clear}
          className="text-[11px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear cart
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* line items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4"
            >
              <Link
                href={`/products/${item.productKey}`}
                className="w-20 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image || ''}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.productKey}`}
                  className="font-bold text-slate-900 text-sm hover:text-[var(--pk-primary-text)]"
                >
                  {item.title}
                </Link>
                <p className="text-xs text-slate-400 mt-0.5">{item.variantTitle}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatPKR(item.price)} each
                </p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-slate-200 rounded-lg">
                    <button
                      onClick={() => setQty(item.variantId, item.quantity - 1)}
                      className="p-2 text-slate-500 hover:text-slate-900"
                      aria-label="Decrease"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-black">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQty(item.variantId, item.quantity + 1)}
                      className="p-2 text-slate-500 hover:text-slate-900"
                      aria-label="Increase"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-900">
                      {formatPKR(item.price * item.quantity)}
                    </span>
                    <button
                      onClick={() => remove(item.variantId)}
                      className="text-slate-300 hover:text-red-500 transition"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* summary */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-24">
            <h2 className="font-black text-slate-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({count} items)</span>
                <span className="font-bold text-slate-900">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-slate-400 text-xs font-semibold">
                  Calculated at checkout
                </span>
              </div>
              <div className="flex justify-between font-black text-slate-900 text-base pt-3 border-t border-slate-100">
                <span>Total</span>
                <span className="text-[var(--pk-primary-text)]">{formatPKR(subtotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-5 w-full bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] text-white font-bold text-sm py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-4 space-y-1.5 text-[10px] text-slate-400 text-center">
              <p>Cash on Delivery available nationwide</p>
              <p>Totals are verified by the store server at order placement</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
