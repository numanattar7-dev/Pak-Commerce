'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HomeSections } from '@pak-commerce/storefront-renderer';
import { useStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';
import { imgUrl, FALLBACK_IMAGE } from '@/lib/api';

export default function HomePage() {
  const { products, loading, customization: cfg } = useStore();

  return (
    <div>
      {/* Homepage sections — order, visibility and content are merchant-configurable */}
      <HomeSections
        cfg={cfg}
        products={products}
        loading={loading}
        resolveImage={(src) => {
          const r = imgUrl(src);
          return r ?? (src ? FALLBACK_IMAGE : undefined);
        }}
        renderProduct={(p) => <ProductCard product={p as any} />}
      />

      {/* Order-confidence band */}
      <section className="bg-slate-100 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <h3 className="font-black text-slate-900 text-lg">Already placed an order?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Track it live with your order number and phone number — no login required.
            </p>
          </div>
          <Link
            href="/track"
            className="bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] text-white font-bold text-sm px-6 py-3 rounded-xl transition flex items-center gap-2"
          >
            Track Order <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
