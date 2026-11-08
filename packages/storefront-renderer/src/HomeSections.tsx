'use client';

// ---------------------------------------------------------------------------
// HomeSections — renders the merchant-configured homepage in section order.
// Used by the public storefront; the admin editor iframe shows the same tree,
// and supports click-to-select + outline while editing.
//
// Every section paints itself from a merchant-selected color scheme (scoped
// CSS variables) plus the theme's design tokens — so preview and published
// storefront are byte-for-byte the same rendering path.
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
import {
  resolveDesign,
  schemeFor,
  schemeVars,
  themeVars,
} from './config';
import type { PkSection } from './sections';
import { sanitizeHomeSections } from './sections';
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

/* ---- shared style helpers ------------------------------------------------ */

/** heading typography from the theme's design tokens */
const headingStyle = {
  fontFamily: 'var(--pk-font-heading, inherit)',
  textTransform: 'var(--pk-headings-case, none)',
} as unknown as React.CSSProperties;

function schemeOf(cfg: StoreCustomization, key: string, section?: PkSection | null) {
  return schemeFor(cfg, key, section?.settings ?? null);
}

/** combined wrapper style: theme tokens + the section's scheme palette */
function sectionVars(cfg: StoreCustomization, key: string, section?: PkSection | null): React.CSSProperties {
  return {
    ...themeVars(cfg),
    ...schemeVars(schemeOf(cfg, key, section)),
  } as React.CSSProperties;
}

const btnPrimary = (extra = '') =>
  `bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] hover:opacity-90 font-bold text-sm px-6 py-3 inline-flex items-center gap-2 transition ${extra}`;

const btnSecondary = (extra = '') =>
  `bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] border border-[var(--pk-scheme-border)] hover:border-[var(--pk-scheme-accent)] font-bold text-sm px-6 py-3 inline-flex items-center gap-2 transition ${extra}`;

/* ---- root component ------------------------------------------------------ */

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

  // Stored config is untrusted — only iterate sanitised sections.
  const sections = sanitizeHomeSections(cfg.home?.sections);

  const frame = (s: PkSection, node: React.ReactNode) => (
    <div
      key={s.id}
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
            return frame(s, <HeroSection cfg={cfg} section={s} products={products} resolveImage={resolveImage} />);
          case 'features':
            return frame(s, <FeaturesSection cfg={cfg} section={s} />);
          case 'featuredProducts':
            return frame(
              s,
              <FeaturedSection cfg={cfg} section={s} products={products} loading={loading} renderProduct={renderProduct} />,
            );
          case 'productGrid':
            return frame(
              s,
              <ProductGridSection cfg={cfg} section={s} products={products} loading={loading} renderProduct={renderProduct} />,
            );
          case 'productCards':
            return frame(
              s,
              <ProductCardsSection cfg={cfg} section={s} products={products} loading={loading} renderProduct={renderProduct} />,
            );
          case 'richText':
            return frame(s, <RichTextSection cfg={cfg} section={s} />);
          case 'imageWithText':
            return frame(s, <ImageWithTextSection cfg={cfg} section={s} resolveImage={resolveImage} />);
          case 'faq':
            return frame(s, <FaqSection cfg={cfg} section={s} />);
          default:
            return null;
        }
      })}
    </>
  );
}

/* ---------------- hero (5 layout variants) -------------------------------- */

function HeroSection({
  cfg,
  section,
  products,
  resolveImage,
}: {
  cfg: StoreCustomization;
  section: PkSection;
  products: HomeProduct[];
  resolveImage?: (src?: string) => string | undefined;
}) {
  const design = resolveDesign(cfg);
  const variant = String(section.settings.variant ?? design.heroVariant ?? 'split');

  const heroImg =
    (resolveImage ? resolveImage(String(cfg.hero.imageUrl ?? '')) : cfg.hero.imageUrl) ||
    (products[0]
      ? (resolveImage ? resolveImage(products[0].images?.[0]) : products[0].images?.[0])
      : undefined) ||
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80';

  return (
    <section style={sectionVars(cfg, 'hero', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)]">
      {variant === 'overlay' ? <HeroOverlay cfg={cfg} img={heroImg} />
        : variant === 'minimal' ? <HeroMinimal cfg={cfg} />
        : variant === 'banner' ? <HeroBanner cfg={cfg} img={heroImg} />
        : variant === 'editorial' ? <HeroEditorial cfg={cfg} img={heroImg} />
        : <HeroSplit cfg={cfg} img={heroImg} products={products} />}
    </section>
  );
}

const HeroBadge = ({ cfg }: { cfg: StoreCustomization }) =>
  cfg.hero.badge ? (
    <span
      className="inline-flex items-center gap-1.5 border border-[var(--pk-scheme-border)] text-[var(--pk-scheme-accent)] text-[11px] font-bold px-3 py-1.5 bg-[var(--pk-scheme-secondary-button)]"
      style={{ borderRadius: '999px' }}
    >
      <Sparkles className="w-3.5 h-3.5" /> {cfg.hero.badge}
    </span>
  ) : null;

function HeroSplit({
  cfg,
  img,
  products,
}: {
  cfg: StoreCustomization;
  img: string;
  products: HomeProduct[];
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
      <div>
        <HeroBadge cfg={cfg} />
        <h1 style={headingStyle} className="text-[var(--pk-scheme-heading)] text-4xl md:text-5xl font-black leading-tight mt-4">
          {cfg.hero.title}
        </h1>
        <p className="opacity-80 text-sm md:text-base mt-4 leading-relaxed max-w-md">{cfg.hero.subtitle}</p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link href={cfg.hero.ctaLink || '/products'} className={btnPrimary('rounded-[var(--pk-button-radius,12px)] shadow-lg')}>
            {cfg.hero.ctaText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/track"
            className={`border-2 border-[var(--pk-scheme-border)] hover:border-[var(--pk-scheme-accent)] font-bold text-sm px-6 py-3 rounded-[var(--pk-button-radius,12px)] transition ${'text-[var(--pk-scheme-text)]'}`}
          >
            Track Your Order
          </Link>
        </div>
        <div className="flex gap-6 mt-8 text-[11px] font-bold opacity-90">
          <span className="flex items-center gap-1.5"><Banknote className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> COD Available</span>
          <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> 100+ Cities</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> 7-Day Exchange</span>
        </div>
      </div>
      <div className="relative hidden md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={cfg.hero.title || 'Featured'}
          className="shadow-2xl w-full aspect-[4/5] max-h-[420px] object-cover rounded-[var(--pk-radius,16px)]"
        />
        {products[0] && (
          <Link
            href={`/products/${products[0].slug}`}
            className="absolute -bottom-4 left-4 bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] text-xs font-bold px-4 py-2.5 rounded-[var(--pk-button-radius,12px)] shadow-lg flex items-center gap-2 hover:opacity-90 transition"
          >
            {products[0].title.slice(0, 26)}
            {products[0].title.length > 26 ? '…' : ''} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function HeroOverlay({ cfg, img }: { cfg: StoreCustomization; img: string }) {
  return (
    <div className="relative min-h-[440px] md:min-h-[540px] flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={cfg.hero.title || 'Featured'} className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(10,12,14,0.55) 0%, rgba(10,12,14,0.35) 55%, rgba(10,12,14,0.65) 100%)' }}
      />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        {cfg.hero.badge && (
          <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/25">
            <Sparkles className="w-3.5 h-3.5" /> {cfg.hero.badge}
          </span>
        )}
        <h1 style={headingStyle} className="text-white text-4xl md:text-6xl font-black leading-tight mt-4">
          {cfg.hero.title}
        </h1>
        <p className="text-white/85 text-sm md:text-base mt-4 leading-relaxed max-w-xl mx-auto">{cfg.hero.subtitle}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Link href={cfg.hero.ctaLink || '/products'} className={btnPrimary('rounded-[var(--pk-button-radius,12px)] shadow-xl')}>
            {cfg.hero.ctaText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/track" className="border-2 border-white/50 hover:bg-white/10 text-white font-bold text-sm px-6 py-3 rounded-[var(--pk-button-radius,12px)] transition">
            Track Your Order
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroMinimal({ cfg }: { cfg: StoreCustomization }) {
  return (
    <div className="border-b border-[var(--pk-scheme-border)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
        <HeroBadge cfg={cfg} />
        <h1 style={headingStyle} className="text-[var(--pk-scheme-heading)] text-4xl md:text-6xl font-black leading-[1.05] mt-6">
          {cfg.hero.title}
        </h1>
        <p className="opacity-75 text-sm md:text-base mt-5 leading-relaxed max-w-xl mx-auto">{cfg.hero.subtitle}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-9">
          <Link href={cfg.hero.ctaLink || '/products'} className={btnSecondary('rounded-[var(--pk-button-radius,12px)]')}>
            {cfg.hero.ctaText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/track" className="text-[var(--pk-scheme-accent)] font-bold text-sm px-4 py-3 hover:underline">
            Track your order
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-12 text-[11px] font-bold opacity-80 border-t border-[var(--pk-scheme-border)] pt-6">
          <span className="flex items-center gap-1.5"><Banknote className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> COD Available</span>
          <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> 100+ Cities</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> 7-Day Exchange</span>
        </div>
      </div>
    </div>
  );
}

function HeroBanner({ cfg, img }: { cfg: StoreCustomization; img: string }) {
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={cfg.hero.title || 'Featured'} className="w-full aspect-[21/9] object-cover" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-1">
        <HeroBadge cfg={cfg} />
        <h1 style={headingStyle} className="text-[var(--pk-scheme-heading)] text-3xl md:text-5xl font-black leading-tight mt-4">
          {cfg.hero.title}
        </h1>
        <p className="opacity-80 text-sm md:text-base mt-3 leading-relaxed max-w-xl">{cfg.hero.subtitle}</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href={cfg.hero.ctaLink || '/products'} className={btnPrimary('rounded-[var(--pk-button-radius,12px)]')}>
            {cfg.hero.ctaText || 'Shop Now'} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/track" className="text-[var(--pk-scheme-accent)] font-bold text-sm px-4 py-3 hover:underline">
            Track your order
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroEditorial({ cfg, img }: { cfg: StoreCustomization; img: string }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 md:pt-24 text-center">
      <p className="text-[var(--pk-scheme-accent)] text-[11px] font-bold uppercase tracking-[0.3em]">{cfg.hero.badge || 'Featured'}</p>
      <h1 style={headingStyle} className="text-[var(--pk-scheme-heading)] text-4xl md:text-6xl font-black leading-[1.08] mt-5">
        {cfg.hero.title}
      </h1>
      <p className="opacity-80 text-sm md:text-base mt-6 leading-relaxed max-w-xl mx-auto italic">{cfg.hero.subtitle}</p>
      <div className="inline-flex items-center gap-2 mt-8">
        <Link
          href={cfg.hero.ctaLink || '/products'}
          className="text-[var(--pk-scheme-heading)] font-bold text-sm border-b-2 border-[var(--pk-scheme-accent)] pb-1 hover:text-[var(--pk-scheme-accent)] transition"
        >
          {cfg.hero.ctaText || 'Shop Now'}
        </Link>
        <ArrowRight className="w-4 h-4 text-[var(--pk-scheme-accent)]" />
      </div>
      <div className="mt-14 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={cfg.hero.title || 'Featured'}
          className="w-full max-w-2xl aspect-[4/5] max-h-[480px] object-cover rounded-t-full shadow-2xl"
        />
      </div>
    </div>
  );
}

/* ---------------- features (3 layout variants) ---------------------------- */

const FEATURE_ITEMS = [
  { icon: Truck, title: 'Delivery Across Pakistan', sub: 'TCS, PostEx, Trax & Leopards' },
  { icon: Banknote, title: 'Cash on Delivery (COD)', sub: 'Pay in cash at doorstep' },
  { icon: ShieldCheck, title: '7-day exchange facility', sub: 'Easy returns across 100+ cities' },
  { icon: Phone, title: 'WhatsApp Support', sub: 'Direct merchant assistance' },
];

function FeaturesSection({ cfg, section }: { cfg: StoreCustomization; section: PkSection }) {
  const design = resolveDesign(cfg);
  const variant = String(section.settings.variant ?? design.featuresVariant ?? 'row');

  if (variant === 'pill') {
    return (
      <section style={sectionVars(cfg, 'features', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] border-b border-[var(--pk-scheme-border)] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap justify-center gap-3">
          {FEATURE_ITEMS.map(({ icon: Icon, title }) => (
            <span
              key={title}
              className="inline-flex items-center gap-2 bg-[var(--pk-scheme-secondary-button)] border border-[var(--pk-scheme-border)] text-xs font-bold px-4 py-2 rounded-full"
            >
              <Icon className="w-4 h-4 text-[var(--pk-scheme-accent)]" /> {title}
            </span>
          ))}
        </div>
      </section>
    );
  }

  if (variant === 'cards') {
    return (
      <section style={sectionVars(cfg, 'features', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] py-[var(--pk-section-y,3.5rem)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURE_ITEMS.map(({ icon: Icon, title, sub }) => (
            <div
              key={title}
              className="flex flex-col items-center text-center p-6 bg-[var(--pk-scheme-secondary-button)] border border-[var(--pk-scheme-border)] rounded-[var(--pk-radius,16px)]"
            >
              <span className="w-11 h-11 flex items-center justify-center bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] mb-3" style={{ borderRadius: 'var(--pk-radius, 16px)' }}>
                <Icon className="w-5 h-5" />
              </span>
              <h4 className="text-xs font-black text-[var(--pk-scheme-heading)]">{title}</h4>
              <p className="text-[11px] opacity-70 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 'row' — classic hairline strip
  return (
    <section style={sectionVars(cfg, 'features', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] border-b border-[var(--pk-scheme-border)] py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {FEATURE_ITEMS.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-center p-3">
            <Icon className="w-6 h-6 text-[var(--pk-scheme-accent)] mb-2" />
            <h4 className="text-xs font-bold text-[var(--pk-scheme-heading)]">{title}</h4>
            <p className="text-[11px] opacity-70 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- products ----------------------------------------------- */

function ProductsEmpty() {
  return (
    <div className="text-center py-16 opacity-60">
      <Package className="w-10 h-10 mx-auto mb-3" />
      <p className="text-sm font-medium">No products available right now.</p>
    </div>
  );
}

function ProductsSkeleton({ cols }: { cols: string | number }) {
  return (
    <div className={gridCls(cols)}>
      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-[var(--pk-scheme-secondary-button)] animate-pulse rounded-[var(--pk-radius,16px)] h-80" />
      ))}
    </div>
  );
}

const gridCls = (cols: string | number) => {
  const c = String(cols);
  return c === '2'
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-6'
    : c === '4'
      ? 'grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8';
};

function FeaturedSection({
  cfg,
  section,
  products,
  loading,
  renderProduct,
}: {
  cfg: StoreCustomization;
  section: PkSection;
  products: HomeProduct[];
  loading: boolean;
  renderProduct: (p: HomeProduct, index: number) => React.ReactNode;
}) {
  const featuredCount = cfg.sections.featuredCount || 8;
  const featured = products.slice(0, featuredCount);
  return (
    <main style={sectionVars(cfg, 'featuredProducts', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[var(--pk-section-y,3.5rem)] w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 style={headingStyle} className="text-2xl font-black text-[var(--pk-scheme-heading)]">Featured Collection</h2>
          <p className="text-xs opacity-70 mt-1">
            {cfg.sections.aboutBlurb || 'Hand-picked premiums — guaranteed quality'}
          </p>
        </div>
        <div className="text-xs font-semibold text-[var(--pk-scheme-accent)] bg-[var(--pk-scheme-secondary-button)] px-3 py-1.5 border border-[var(--pk-scheme-border)] rounded-full w-fit">
          {loading ? 'Loading…' : `${products.length} Products Available`}
        </div>
      </div>

      {loading ? (
        <ProductsSkeleton cols={3} />
      ) : products.length === 0 ? (
        <ProductsEmpty />
      ) : (
        <div className={gridCls(3)}>
          {featured.map((p, i) => (
            <React.Fragment key={p.id}>{renderProduct(p, i)}</React.Fragment>
          ))}
        </div>
      )}

      {products.length > featuredCount && (
        <div className="text-center mt-12">
          <Link href="/products" className={btnSecondary('rounded-[var(--pk-button-radius,12px)]')}>
            View all {products.length} products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </main>
  );
}

function ProductGridSection({
  cfg,
  section,
  products,
  loading,
  renderProduct,
}: {
  cfg: StoreCustomization;
  section: PkSection;
  products: HomeProduct[];
  loading: boolean;
  renderProduct: (p: HomeProduct, index: number) => React.ReactNode;
}) {
  const limit = Math.max(1, Math.min(24, Number(section.settings.limit ?? 8) || 8));
  const columns = String(section.settings.columns ?? '4');
  const viewAll = section.settings.viewAll !== false;
  const list = products.slice(0, limit);
  const heading = String(section.settings.heading ?? '');
  const subheading = String(section.settings.subheading ?? '');

  return (
    <section style={sectionVars(cfg, 'productGrid', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[var(--pk-section-y,3.5rem)]">
        {(heading || subheading) && (
          <div className="mb-8 max-w-2xl">
            {heading && (
              <h2 style={headingStyle} className="text-2xl md:text-3xl font-black text-[var(--pk-scheme-heading)]">{heading}</h2>
            )}
            {subheading && <p className="text-sm opacity-70 mt-2 leading-relaxed">{subheading}</p>}
          </div>
        )}

        {loading ? (
          <ProductsSkeleton cols={columns} />
        ) : list.length === 0 ? (
          <ProductsEmpty />
        ) : (
          <div className={gridCls(columns)}>
            {list.map((p, i) => (
              <React.Fragment key={p.id}>{renderProduct(p, i)}</React.Fragment>
            ))}
          </div>
        )}

        {viewAll && products.length > 0 && (
          <div className="mt-10">
            <Link
              href="/products"
              className={`text-[var(--pk-scheme-accent)] font-bold text-sm inline-flex items-center gap-2 border-b-2 border-[var(--pk-scheme-accent)] pb-1 hover:opacity-80 transition`}
            >
              View all products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ProductCardsSection({
  cfg,
  section,
  products,
  loading,
  renderProduct,
}: {
  cfg: StoreCustomization;
  section: PkSection;
  products: HomeProduct[];
  loading: boolean;
  renderProduct: (p: HomeProduct, index: number) => React.ReactNode;
}) {
  const limit = Math.max(1, Math.min(12, Number(section.settings.limit ?? 4) || 4));
  const horizontal = String(section.settings.scroll ?? 'horizontal') !== 'grid';
  const viewAll = section.settings.viewAll === true;
  const list = products.slice(0, limit);

  return (
    <section style={sectionVars(cfg, 'productCards', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[var(--pk-section-y,3.5rem)]">
        {loading ? (
          <ProductsSkeleton cols={horizontal ? '4' : '2'} />
        ) : list.length === 0 ? (
          <ProductsEmpty />
        ) : horizontal ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
            {list.map((p, i) => (
              <div key={p.id} className="shrink-0 w-64 sm:w-72 snap-start">
                {renderProduct(p, i)}
              </div>
            ))}
          </div>
        ) : (
          <div className={gridCls('2')}>
            {list.map((p, i) => (
              <React.Fragment key={p.id}>{renderProduct(p, i)}</React.Fragment>
            ))}
          </div>
        )}

        {viewAll && list.length > 0 && (
          <div className="mt-8 text-center">
            <Link href="/products" className="text-[var(--pk-scheme-accent)] font-bold text-sm hover:underline">
              View all products →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- rich text / image-with-text / faq ---------------------- */

function RichTextSection({ cfg, section }: { cfg: StoreCustomization; section: PkSection }) {
  const heading = String(section.settings.heading ?? '');
  const body = String(section.settings.body ?? '');
  const align = section.settings.align === 'left' ? 'text-left' : 'text-center';
  if (!heading && !body) return null;
  return (
    <section style={sectionVars(cfg, 'richText', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] border-y border-[var(--pk-scheme-border)] py-[var(--pk-section-y,3.5rem)]">
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 ${align}`}>
        {heading && (
          <h2 style={headingStyle} className="text-2xl md:text-3xl font-black text-[var(--pk-scheme-heading)]">{heading}</h2>
        )}
        {body && <p className="text-sm md:text-base opacity-80 mt-3 leading-relaxed whitespace-pre-line">{body}</p>}
      </div>
    </section>
  );
}

function ImageWithTextSection({
  cfg,
  section,
  resolveImage,
}: {
  cfg: StoreCustomization;
  section: PkSection;
  resolveImage?: (src?: string) => string | undefined;
}) {
  const src = resolveImage ? resolveImage(String(section.settings.imageUrl ?? '')) : String(section.settings.imageUrl ?? '');
  const right = section.settings.imageSide === 'right';
  const heading = String(section.settings.heading ?? '');
  const body = String(section.settings.body ?? '');
  const ctaText = String(section.settings.ctaText ?? '');
  const ctaLink = String(section.settings.ctaLink ?? '/products');
  const FALLBACK =
    'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=80';

  const img = (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || FALLBACK}
        alt={heading || 'Featured'}
        className="shadow-xl w-full h-full min-h-[16rem] object-cover aspect-[4/3] rounded-[var(--pk-radius,16px)]"
      />
    </div>
  );
  const copy = (
    <div className="flex flex-col justify-center">
      {heading && (
        <h2 style={headingStyle} className="text-2xl md:text-3xl font-black text-[var(--pk-scheme-heading)]">{heading}</h2>
      )}
      {body && <p className="text-sm md:text-base opacity-80 mt-3 leading-relaxed whitespace-pre-line">{body}</p>}
      {ctaText && (
        <div className="mt-6">
          <Link href={ctaLink || '/products'} className={btnSecondary('rounded-[var(--pk-button-radius,12px)]')}>
            {ctaText} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <section style={sectionVars(cfg, 'imageWithText', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] py-[var(--pk-section-y,3.5rem)]">
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

function FaqSection({ cfg, section }: { cfg: StoreCustomization; section: PkSection }) {
  const heading = String(section.settings.heading ?? 'FAQ');
  const visible = section.blocks.filter((b) => b.enabled && (b.settings.question || b.settings.answer));
  if (visible.length === 0) return null;
  return (
    <section style={sectionVars(cfg, 'faq', section)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] py-[var(--pk-section-y,3.5rem)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 style={headingStyle} className="text-2xl md:text-3xl font-black text-[var(--pk-scheme-heading)] text-center">{heading}</h2>
        <div className="mt-8 border border-[var(--pk-scheme-border)] overflow-hidden" style={{ borderRadius: 'var(--pk-radius, 16px)' }}>
          {visible.map((b) => (
            <details key={b.id} className="group bg-[var(--pk-scheme-bg)] open:bg-[var(--pk-scheme-secondary-button)] border-b last:border-b-0 border-[var(--pk-scheme-border)]">
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-bold text-[var(--pk-scheme-heading)] text-sm [&::-webkit-details-marker]:hidden">
                {String(b.settings.question ?? '')}
                <span className="opacity-50 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-[var(--pk-scheme-text)] leading-relaxed whitespace-pre-line">
                {String(b.settings.answer ?? '')}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
