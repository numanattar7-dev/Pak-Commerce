'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Check } from 'lucide-react';
import { StoreProduct, formatPKR, imgUrl, FALLBACK_IMAGE } from '@/lib/api';
import { useCart } from '@/lib/cart';

export default function ProductCard({ product }: { product: StoreProduct }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  const inStockVariant =
    product.variants.find((v) => v.stockQuantity > 0) || product.variants[0];
  const inStock = Boolean(inStockVariant && inStockVariant.stockQuantity > 0);
  const singleVariant = product.variants.length <= 1;
  const photo = imgUrl(product.images?.[0]) || FALLBACK_IMAGE;

  const savePct =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  const handleAdd = () => {
    if (!inStockVariant || !inStockVariant.id) return;
    add(
      {
        variantId: inStockVariant.id,
        productId: product.id,
        productKey: product.slug,
        title: product.title,
        variantTitle: inStockVariant.title,
        price: inStockVariant.price,
        image: photo,
        maxStock: inStockVariant.stockQuantity,
      },
      1,
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between">
      <div>
        <Link href={`/products/${product.slug}`} className="block relative aspect-[4/5] bg-slate-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
          {savePct > 0 && (
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow">
              SAVE {savePct}%
            </span>
          )}
          <span className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
            {product.category || 'Lawn'}
          </span>
          {!inStock && (
            <span className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg">
                Out of Stock
              </span>
            </span>
          )}
        </Link>

        <div className="p-5">
          <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition">
            <Link href={`/products/${product.slug}`}>{product.title}</Link>
          </h3>
          <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
            {product.description || 'Premium quality fabric.'}
          </p>
        </div>
      </div>

      <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between mt-4">
        <div>
          <span className="text-lg font-black text-slate-900">
            {formatPKR(product.price)}
            {product.variants.length > 1 && (
              <span className="text-[10px] text-slate-400 font-bold ml-1">from</span>
            )}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-xs text-slate-400 line-through ml-2">
              {formatPKR(product.compareAtPrice)}
            </span>
          )}
        </div>

        {added ? (
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Added
          </span>
        ) : !inStock ? (
          <span className="bg-slate-100 text-slate-400 text-xs font-bold px-4 py-2.5 rounded-xl cursor-not-allowed">
            Sold out
          </span>
        ) : singleVariant ? (
          <button
            onClick={handleAdd}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        ) : (
          <Link
            href={`/products/${product.slug}`}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            Select options
          </Link>
        )}
      </div>
    </div>
  );
}
