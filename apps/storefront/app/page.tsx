'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  Banknote,
  Phone,
  Sparkles,
  Package,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import ProductCard from '@/components/ProductCard';
import { imgUrl, FALLBACK_IMAGE } from '@/lib/api';

export default function HomePage() {
  const { products, loading, store, customization: cfg } = useStore();
  const featuredCount = cfg.sections.featuredCount || 8;
  const featured = products.slice(0, featuredCount);
  const heroImg = cfg.hero.imageUrl
    ? imgUrl(cfg.hero.imageUrl) || FALLBACK_IMAGE
    : featured[0]
      ? imgUrl(featured[0].images?.[0]) || FALLBACK_IMAGE
      : FALLBACK_IMAGE;

  return (
    <div>
      {/* Hero — fully customizable (Admin → Customize Store) */}
      {cfg.hero.enabled !== false && (
        <section className="bg-gradient-to-r from-[var(--pk-primary-dark)] via-[var(--pk-primary)] to-[var(--pk-accent)] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
            <div>
              {cfg.hero.badge && (
                <span className="inline-flex items-center gap-1.5 bg-black/25 border border-white/25 text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
                  <Sparkles className="w-3.5 h-3.5" /> {cfg.hero.badge}
                </span>
              )}
              <h1 className="text-4xl md:text-5xl font-black leading-tight mt-4">
                {cfg.hero.title}
              </h1>
              <p className="text-white/90 text-sm md:text-base mt-4 leading-relaxed max-w-md">
                {cfg.hero.subtitle}
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link
                  href={cfg.hero.ctaLink || '/products'}
                  className="bg-white text-[var(--pk-primary-text)] hover:bg-white/90 font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2"
                >
                  {cfg.hero.ctaText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/track"
                  className="border-2 border-white/40 hover:bg-white/10 font-bold text-sm px-6 py-3 rounded-xl transition"
                >
                  Track Your Order
                </Link>
              </div>
              <div className="flex gap-6 mt-8 text-[11px] font-bold text-white/90">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4" /> COD Available
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> 100+ Cities
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> 7-Day Exchange
                </span>
              </div>
            </div>

            <div className="relative hidden md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={cfg.hero.title || 'Featured'}
                className="rounded-2xl shadow-2xl w-full aspect-[4/5] max-h-[420px] object-cover"
              />
              {featured[0] && (
                <Link
                  href={`/products/${featured[0].slug}`}
                  className="absolute -bottom-4 left-4 bg-white text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 hover:bg-slate-100 transition"
                >
                  {featured[0].title.slice(0, 26)}
                  {featured[0].title.length > 26 ? '…' : ''} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Feature Highlights */}
      {cfg.sections.showFeatures !== false && (
        <section className="bg-white border-b border-slate-200 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center p-3">
              <Truck className="w-6 h-6 text-[var(--pk-primary)] mb-2" />
              <h4 className="text-xs font-bold text-slate-900">Delivery Across Pakistan</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">TCS, PostEx, Trax &amp; Leopards</p>
            </div>
            <div className="flex flex-col items-center p-3">
              <Banknote className="w-6 h-6 text-[var(--pk-primary)] mb-2" />
              <h4 className="text-xs font-bold text-slate-900">Cash on Delivery (COD)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Pay in cash at doorstep</p>
            </div>
            <div className="flex flex-col items-center p-3">
              <ShieldCheck className="w-6 h-6 text-[var(--pk-primary)] mb-2" />
              <h4 className="text-xs font-bold text-slate-900">7-day exchange facility</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Easy returns across 100+ cities</p>
            </div>
            <div className="flex flex-col items-center p-3">
              <Phone className="w-6 h-6 text-[var(--pk-primary)] mb-2" />
              <h4 className="text-xs font-bold text-slate-900">WhatsApp Support</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Direct merchant assistance</p>
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Featured Collection
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {cfg.sections.aboutBlurb ||
                `Hand-picked premiums from ${store?.name || 'our store'} — guaranteed quality`}
            </p>
          </div>
          <div className="text-xs font-semibold text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)] px-3 py-1.5 rounded-lg border border-[var(--pk-primary-softer)] w-fit">
            {loading ? 'Loading…' : `${products.length} Products Available`}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-slate-200 animate-pulse rounded-2xl h-80" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3" />
            <p className="text-sm font-medium">No products available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {products.length > featuredCount && (
          <div className="text-center mt-12">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-xl transition"
            >
              View all {products.length} products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>

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
