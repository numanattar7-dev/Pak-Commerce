'use client';

// ---------------------------------------------------------------------------
// HomeSections — renders the merchant-configured homepage in section order.
// Used by the public storefront; the admin editor iframe shows the same tree,
// and supports click-to-select + outline while editing.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
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
import type { StoreCustomization } from './config';
import type { PkSection } from './sections';
import {
  isAllowedPreviewOrigin,
  isPreviewSelectMessage,
  resolvePreviewParentOrigin,
} from './preview';

export interface HomeProduct {
  id: string;
  slug: string;
  title: string;
  images?: string[];
}

type Props = {
  cfg: StoreCustomization;
  products: HomeProduct[];
  loading: boolean;
  /** storefront supplies its real ProductCard */
  renderProduct: (p: HomeProduct, index: number) => React.ReactNode;
  /** storefront supplies its absolute-image resolver (uploads live on the API) */
  resolveImage?: (src?: string) => string | undefined;
};

const isPreviewFrame = () =>
  typeof window !== 'undefined' && window.self !== window.top;

export default function HomeSections({ cfg, products, loading, renderProduct, resolveImage }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const parentOrigin = useRef<string | null>(null);

  // editor → iframe: highlight the section the merchant is editing.
  // Origin-checked and payload-validated; unknown origins are ignored.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!isAllowedPreviewOrigin(e.origin)) return;
      if (!isPreviewSelectMessage(e.data)) return;
      parentOrigin.current = resolvePreviewParentOrigin(e.origin);
      setSelectedId(e.data.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const pick = (e: React.MouseEvent, id: string) => {
    if (!isPreviewFrame()) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    try {
      // Reply only to the exact editor origin (learned from pk-preview-select).
      // Before the parent origin is known, do not broadcast at all.
      if (parentOrigin.current) {
        window.parent.postMessage({ type: 'pk-preview-pick', id }, parentOrigin.current);
      }
    } catch {
      /* parent gone */
    }
  };

  const sections = cfg.home?.sections ?? [];

  const frame = (s: PkSection, node: React.ReactNode, keyExtra?: React.Key) => (
    <div
      key={String(keyExtra ?? s.id)}
      data-pk-section={s.id}
      onClickCapture={(e) => pick(e, s.id)}
      style={
        selectedId === s.id
          ? { boxShadow: 'inset 0 0 0 3px #2563eb', cursor: 'pointer' }
          : undefined
      }
    >
      {node}
    </div>
  );

  return (
    <>
      {sections.map((s) => {
        if (!s.enabled) return null;
        switch (s.type) {
          case 'hero':
            return frame(s, <HeroSection cfg={cfg} products={products} resolveImage={resolveImage} />, s.id);
          case 'features':
            return frame(s, <FeaturesSection />, s.id);
          case 'featuredProducts':
            return frame(
              s,
              <FeaturedSection cfg={cfg} products={products} loading={loading} renderProduct={renderProduct} />,
              s.id,
            );
          case 'richText':
            return frame(s, <RichTextSection settings={s.settings} />, s.id);
          case 'imageWithText':
            return frame(s, <ImageWithTextSection settings={s.settings} resolveImage={resolveImage} />, s.id);
          case 'faq':
            return frame(s, <FaqSection heading={String(s.settings?.heading ?? 'FAQ')} blocks={s.blocks} />, s.id);
          default:
            return null;
        }
      })}
    </>
  );
}

/* ---------------- sections ---------------- */

function HeroSection({
  cfg,
  products,
  resolveImage,
}: {
  cfg: StoreCustomization;
  products: HomeProduct[];
  resolveImage?: (src?: string) => string | undefined;
}) {
  const featuredCount = cfg.sections.featuredCount || 8;
  const featured = products.slice(0, featuredCount);
  const heroImg =
    (resolveImage ? resolveImage(cfg.hero.imageUrl) : cfg.hero.imageUrl) ||
    (featured[0]
      ? (resolveImage ? resolveImage(featured[0].images?.[0]) : featured[0].images?.[0])
      : undefined) ||
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80';

  return (
    <section className="bg-gradient-to-r from-[var(--pk-primary-dark)] via-[var(--pk-primary)] to-[var(--pk-accent)] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          {cfg.hero.badge && (
            <span className="inline-flex items-center gap-1.5 bg-black/25 border border-white/25 text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5" /> {cfg.hero.badge}
            </span>
          )}
          <h1 className="text-4xl md:text-5xl font-black leading-tight mt-4">{cfg.hero.title}</h1>
          <p className="text-white/90 text-sm md:text-base mt-4 leading-relaxed max-w-md">{cfg.hero.subtitle}</p>
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
            <span className="flex items-center gap-1.5"><Banknote className="w-4 h-4" /> COD Available</span>
            <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> 100+ Cities</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> 7-Day Exchange</span>
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
  );
}

function FeaturesSection() {
  const items = [
    { icon: Truck, title: 'Delivery Across Pakistan', sub: 'TCS, PostEx, Trax & Leopards' },
    { icon: Banknote, title: 'Cash on Delivery (COD)', sub: 'Pay in cash at doorstep' },
    { icon: ShieldCheck, title: '7-day exchange facility', sub: 'Easy returns across 100+ cities' },
    { icon: Phone, title: 'WhatsApp Support', sub: 'Direct merchant assistance' },
  ];
  return (
    <section className="bg-white border-b border-slate-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {items.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-center p-3">
            <Icon className="w-6 h-6 text-[var(--pk-primary)] mb-2" />
            <h4 className="text-xs font-bold text-slate-900">{title}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedSection({
  cfg,
  products,
  loading,
  renderProduct,
}: {
  cfg: StoreCustomization;
  products: HomeProduct[];
  loading: boolean;
  renderProduct: (p: HomeProduct, index: number) => React.ReactNode;
}) {
  const featuredCount = cfg.sections.featuredCount || 8;
  const featured = products.slice(0, featuredCount);
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Featured Collection</h2>
          <p className="text-xs text-slate-500 mt-1">
            {cfg.sections.aboutBlurb || 'Hand-picked premiums — guaranteed quality'}
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
          {featured.map((p, i) => (
            <React.Fragment key={p.id}>{renderProduct(p, i)}</React.Fragment>
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
  );
}

function RichTextSection({ settings }: { settings: Record<string, unknown> }) {
  const heading = String(settings.heading ?? '');
  const body = String(settings.body ?? '');
  const align = settings.align === 'left' ? 'text-left' : 'text-center';
  if (!heading && !body) return null;
  return (
    <section className="bg-[var(--pk-primary-soft)] border-y border-slate-200 py-12">
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 ${align}`}>
        {heading && <h2 className="text-2xl md:text-3xl font-black text-slate-900">{heading}</h2>}
        {body && <p className="text-sm md:text-base text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{body}</p>}
      </div>
    </section>
  );
}

function ImageWithTextSection({
  settings,
  resolveImage,
}: {
  settings: Record<string, unknown>;
  resolveImage?: (src?: string) => string | undefined;
}) {
  const src = resolveImage ? resolveImage(String(settings.imageUrl ?? '')) : String(settings.imageUrl ?? '');
  const right = settings.imageSide === 'right';
  const heading = String(settings.heading ?? '');
  const body = String(settings.body ?? '');
  const ctaText = String(settings.ctaText ?? '');
  const ctaLink = String(settings.ctaLink ?? '/products');
  const FALLBACK =
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=80';

  const img = (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || FALLBACK}
        alt={heading || 'Featured'}
        className="rounded-2xl shadow-xl w-full h-full min-h-[16rem] object-cover aspect-[4/3]"
      />
    </div>
  );
  const copy = (
    <div className="flex flex-col justify-center">
      {heading && <h2 className="text-2xl md:text-3xl font-black text-slate-900">{heading}</h2>}
      {body && <p className="text-sm md:text-base text-slate-600 mt-3 leading-relaxed whitespace-pre-line">{body}</p>}
      {ctaText && (
        <div className="mt-6">
          <Link
            href={ctaLink || '/products'}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-6 py-3 rounded-xl transition"
          >
            {ctaText} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <section className="bg-white py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10 items-center">
        {right ? (
          <>
            {copy}
            {img}
          </>
        ) : (
          <>
            {img}
            {copy}
          </>
        )}
      </div>
    </section>
  );
}

function FaqSection({
  heading,
  blocks,
}: {
  heading: string;
  blocks: Array<{ id: string; enabled: boolean; settings: Record<string, unknown> }>;
}) {
  const visible = blocks.filter((b) => b.enabled && (b.settings.question || b.settings.answer));
  if (visible.length === 0) return null;
  return (
    <section className="bg-white py-14 border-t border-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 text-center">{heading}</h2>
        <div className="mt-8 divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
          {visible.map((b) => (
            <details key={b.id} className="group bg-white open:bg-slate-50">
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-bold text-slate-800 text-sm [&::-webkit-details-marker]:hidden">
                {String(b.settings.question ?? '')}
                <span className="text-slate-400 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {String(b.settings.answer ?? '')}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
