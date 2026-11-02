'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  Check,
  Minus,
  Plus,
  Truck,
  ShieldCheck,
  Banknote,
  Package,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import ProductCard from '@/components/ProductCard';
import { formatPKR, imgUrl, FALLBACK_IMAGE } from '@/lib/api';

export default function ProductDetailPage({
  params,
}: {
  // Next 14 App Router: client pages receive params as a plain object
  params: { id: string };
}) {
  const { findByKey, loading } = useStore();
  const { add } = useCart();

  const product = useMemo(
    () => findByKey(params.id || ''),
    [findByKey, params.id],
  );

  const availableVariants = useMemo(
    () => (product ? product.variants.filter((v) => v.stockQuantity > 0) : []),
    [product],
  );

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);

  // Reset local picking state when navigating between products
  useEffect(() => {
    setSelectedVariantId(null);
    setQty(1);
    setActiveImg(0);
    setAdded(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="bg-slate-200 animate-pulse rounded-2xl aspect-square" />
          <div className="space-y-4">
            <div className="bg-slate-200 animate-pulse h-8 rounded w-3/4" />
            <div className="bg-slate-200 animate-pulse h-6 rounded w-1/3" />
            <div className="bg-slate-200 animate-pulse h-24 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center w-full">
        <Package className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-black text-slate-900">Product not found</h1>
        <p className="text-sm text-slate-500 mt-2">
          This product may have been removed or is no longer available.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to shop
        </Link>
      </div>
    );
  }

  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ||
    availableVariants[0] ||
    product.variants[0];
  const inStock = Boolean(selectedVariant && selectedVariant.stockQuantity > 0);
  const maxQty = Math.min(selectedVariant?.stockQuantity || 1, 10);

  const photos = (product.images || []).map((s) => imgUrl(s) || FALLBACK_IMAGE);
  const gallery = photos.length ? photos : [FALLBACK_IMAGE];

  const savePct =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  const handleAdd = () => {
    if (!selectedVariant || !inStock) return;
    add(
      {
        variantId: selectedVariant.id,
        productId: product.id,
        productKey: product.slug,
        title: product.title,
        variantTitle: selectedVariant.title,
        price: selectedVariant.price,
        image: gallery[0],
        maxStock: selectedVariant.stockQuantity,
      },
      qty,
    );
    setAdded(true);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">
        <Link href="/" className="hover:text-[var(--pk-primary)]">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[var(--pk-primary)]">Shop</Link>
        <span>/</span>
        <span className="text-slate-600 truncate max-w-[220px]">{product.title}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        {/* gallery */}
        <div>
          <div className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery[Math.min(activeImg, gallery.length - 1)]}
              alt={product.title}
              className="w-full h-full object-cover"
            />
            {savePct > 0 && (
              <span className="absolute top-4 left-4 bg-red-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow">
                SAVE {savePct}%
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2.5 mt-3">
              {gallery.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    activeImg === i ? 'border-[var(--pk-primary)]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info */}
        <div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-[10px] font-bold bg-[var(--pk-primary-soft)] text-[var(--pk-primary-text)] px-2 py-1 rounded-md border border-[var(--pk-primary-softer)]">
              {product.category}
            </span>
            {product.isHalal && (
              <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-1 rounded-md border border-teal-200">
                Quality Assured
              </span>
            )}
            {inStock && selectedVariant && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                {selectedVariant.stockQuantity} in stock
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-slate-900">{product.title}</h1>
          {product.titleUrdu && (
            <p dir="rtl" className="text-lg font-serif text-[var(--pk-primary-text)] mt-1">
              {product.titleUrdu}
            </p>
          )}

          <div className="flex items-center gap-3 mt-4">
            <span className="text-3xl font-black text-slate-900">
              {formatPKR(selectedVariant?.price ?? product.price)}
            </span>
            {selectedVariant?.compareAtPrice &&
              selectedVariant.compareAtPrice > selectedVariant.price && (
                <span className="text-sm text-slate-400 line-through">
                  {formatPKR(selectedVariant.compareAtPrice)}
                </span>
              )}
          </div>

          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed mt-4">
              {product.description}
            </p>
          )}
          {product.descriptionUr && (
            <p dir="rtl" className="text-sm text-slate-500 leading-relaxed mt-2 font-serif">
              {product.descriptionUr}
            </p>
          )}

          {/* variant picker */}
          {product.variants.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2">
                Choose Option {product.variants.length > 1 ? '' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const disabled = v.stockQuantity <= 0;
                  const active = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      disabled={disabled}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setQty(1);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition text-left ${
                        active
                          ? 'border-[var(--pk-primary)] bg-[var(--pk-primary-soft)] text-[var(--pk-primary-text)] ring-2 ring-[var(--pk-primary-soft)]'
                          : 'border-slate-200 hover:border-slate-400 text-slate-700'
                      } ${disabled ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                    >
                      <span className="block">{v.title}</span>
                      <span className="block text-[10px] font-semibold text-slate-400">
                        {formatPKR(v.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* qty + add */}
          {added ? (
            <div className="mt-6 bg-[var(--pk-primary-soft)] border border-[var(--pk-primary-softer)] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--pk-primary-text)]">
                <Check className="w-5 h-5" /> Added to cart
              </span>
              <div className="flex gap-2">
                <Link
                  href="/products"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl hover:bg-[var(--pk-primary-soft)] transition"
                >
                  Continue shopping
                </Link>
                <Link
                  href="/cart"
                  className="bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Go to cart
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex items-stretch gap-3">
              <div className="flex items-center border border-slate-300 rounded-xl bg-white">
                <button
                  onClick={() => setQty((v) => Math.max(1, v - 1))}
                  disabled={!inStock}
                  className="p-3 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-9 text-center text-sm font-black">{qty}</span>
                <button
                  onClick={() => setQty((v) => Math.min(maxQty, v + 1))}
                  disabled={!inStock}
                  className="p-3 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleAdd}
                disabled={!inStock}
                className="flex-1 bg-[var(--pk-primary)] hover:bg-[var(--pk-primary-dark)] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                {inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
          )}

          {/* trust row */}
          <div className="grid grid-cols-3 gap-3 mt-8 text-center">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <Truck className="w-5 h-5 text-[var(--pk-primary)] mx-auto mb-1.5" />
              <p className="text-[10px] font-bold text-slate-700">Nationwide Delivery</p>
              <p className="text-[9px] text-slate-400 mt-0.5">100+ cities</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <Banknote className="w-5 h-5 text-[var(--pk-primary)] mx-auto mb-1.5" />
              <p className="text-[10px] font-bold text-slate-700">Cash on Delivery</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Pay at doorstep</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <ShieldCheck className="w-5 h-5 text-[var(--pk-primary)] mx-auto mb-1.5" />
              <p className="text-[10px] font-bold text-slate-700">7-Day Exchange</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Hassle-free</p>
            </div>
          </div>
        </div>
      </div>

      {/* related (same category) */}
      <Related category={product.category} excludeId={product.id} />
    </main>
  );
}

function Related({ category, excludeId }: { category: string; excludeId: string }) {
  const { products } = useStore();
  const related = products.filter((p) => p.category === category && p.id !== excludeId).slice(0, 3);
  if (related.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="text-lg font-black text-slate-900 mb-5">More in {category}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
