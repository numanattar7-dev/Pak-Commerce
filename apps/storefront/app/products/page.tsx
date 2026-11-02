'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Package } from 'lucide-react';
import { useStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';

export default function CatalogPage() {
  const { products, categories, loading } = useStore();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('All');

  const filtered = useMemo(() => {
    let list = products;
    if (category !== 'All') list = list.filter((p) => p.category === category);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(needle) ||
          p.description?.toLowerCase().includes(needle) ||
          p.tags?.some((t) => t.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [products, category, q]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Shop All Products</h1>
        <p className="text-xs text-slate-500 mt-1">
          Authentic fabrics with COD delivery nationwide
        </p>
      </div>

      {/* search + categories */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fabrics, designs…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['All', ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                category === c
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-400 hover:text-emerald-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-slate-200 animate-pulse rounded-2xl h-80" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm font-medium">
            No products match your search{q ? ` for "${q}"` : ''}.
          </p>
          <Link
            href="/products"
            onClick={() => {
              setQ('');
              setCategory('All');
            }}
            className="inline-block mt-4 text-xs font-bold text-emerald-600 hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            {filtered.length} product{filtered.length === 1 ? '' : 's'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
