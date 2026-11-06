// ---------------------------------------------------------------------------
// Shared storefront chrome — announcement bar, header and footer.
// Renders identically in the public storefront and inside the admin live
// preview iframe. Keep markup faithful to what shoppers see.
// ---------------------------------------------------------------------------

import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Phone,
  Truck,
  ShieldCheck,
  MessageCircle,
  Instagram,
  Facebook,
  Music2,
} from 'lucide-react';
import type { StoreCustomization } from './config';
import type { ResolvedNavNode } from './navigation';
import { resolveNavNodes, legacyToResolved } from './navigation';

export function AnnouncementBar({ cfg }: { cfg: StoreCustomization }) {
  if (cfg.announcement.enabled === false || !cfg.announcement.text) return null;
  return (
    <div className="bg-[var(--pk-announcement)] text-white text-[11px] text-center py-1.5 px-4 font-semibold tracking-wide">
      {cfg.announcement.text}
    </div>
  );
}

type HeaderProps = {
  cfg: StoreCustomization;
  storeName: string;
  subdomain?: string;
  logoUrl?: string;
  activePath: string;
  cartSlot?: React.ReactNode;
};

export function SiteHeader({ cfg, storeName, subdomain, logoUrl, activePath, cartSlot }: HeaderProps) {
  const name = storeName || 'Store';
  const initial = name.trim().charAt(0).toUpperCase() || 'S';
  const defaultNav: ResolvedNavNode[] = [
    { id: 'home', label: 'Home', href: '/', external: false, children: [] },
    { id: 'products', label: 'Shop All', href: '/products', external: false, children: [] },
    { id: 'blog', label: 'Journal', href: '/blog', external: false, children: [] },
    { id: 'track', label: 'Track Order', href: '/track', external: false, children: [] },
  ];
  const configured = cfg.navigation?.header;
  const menuNodes: ResolvedNavNode[] = Array.isArray(configured)
    ? resolveNavNodes(configured)
    : [...defaultNav, ...legacyToResolved(cfg.header.menuLinks)];

  const activeCls = (active: boolean) =>
    active
      ? 'text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)]'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50';

  const isActive = (href: string) =>
    href === '/' ? activePath === '/' : activePath.startsWith(href);

  const renderDesktopChild = (c: ResolvedNavNode, depth: number): React.ReactNode => {
    const pad = depth === 0 ? 'px-4' : depth === 1 ? 'pl-8 pr-4' : 'pl-12 pr-4';
    const cls = `block py-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 ${pad}`;
    return (
      <React.Fragment key={c.id}>
        {c.external ? (
          <a href={c.href} target="_blank" rel="noreferrer" className={cls}>
            {c.label}
          </a>
        ) : (
          <Link href={c.href} className={cls}>
            {c.label}
          </Link>
        )}
        {c.children.map((g) => renderDesktopChild(g, depth + 1))}
      </React.Fragment>
    );
  };

  // Desktop dropdown for items with children (hover + keyboard focus-within)
  const renderDesktopItem = (n: ResolvedNavNode) => {
    if (n.children.length === 0) {
      const cls = `px-4 py-2 rounded-lg text-sm font-bold transition ${activeCls(isActive(n.href))}`;
      return n.external ? (
        <a key={n.id} href={n.href} target="_blank" rel="noreferrer" className={cls}>
          {n.label}
        </a>
      ) : (
        <Link key={n.id} href={n.href} className={cls}>
          {n.label}
        </Link>
      );
    }
    return (
      <div key={n.id} className="relative group">
        <button
          type="button"
          aria-haspopup="true"
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${activeCls(isActive(n.href))}`}
        >
          {n.label}
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="absolute left-0 top-full z-50 mt-1 min-w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition">
          {n.children.slice(0, 24).map((c) => renderDesktopChild(c, 0))}
        </div>
      </div>
    );
  };

  const renderMobileItem = (n: ResolvedNavNode, depth: number) => {
    const pad = depth === 0 ? 'px-3 py-1.5' : 'pl-6 pr-3 py-1.5';
    const base = `${pad} rounded-lg text-xs font-bold transition block whitespace-nowrap`;
    const cls = `${base} ${activeCls(isActive(n.href))}`;
    if (n.children.length === 0) {
      return n.external ? (
        <a key={n.id} href={n.href} target="_blank" rel="noreferrer" className={cls}>
          {n.label}
        </a>
      ) : (
        <Link key={n.id} href={n.href} className={cls}>
          {n.label}
        </Link>
      );
    }
    return (
      <details key={n.id} className="py-0.5">
        <summary className={`${base} ${activeCls(isActive(n.href))} list-none cursor-pointer select-none`}>
          {n.label}
        </summary>
        <div className="pl-3">{n.children.slice(0, 24).map((c) => renderMobileItem(c, depth + 1))}</div>
      </details>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={name} className="w-9 h-9 rounded-lg object-cover shadow-sm" />
            ) : (
              <span className="w-9 h-9 rounded-lg bg-[var(--pk-primary)] text-white font-black text-lg flex items-center justify-center shadow-sm">
                {initial}
              </span>
            )}
            <span className="leading-tight">
              <span className="block font-black text-slate-900 text-sm sm:text-base">{name}</span>
              <span className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {cfg.branding.tagline || (subdomain ? `${subdomain}.pakcommerce.pk` : 'Pakistan')}
              </span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {menuNodes.map(renderDesktopItem)}
          </nav>

          {cartSlot}
        </div>

        {/* mobile nav */}
        <nav className="md:hidden flex flex-wrap items-center gap-1 pb-2 -mt-1">
          {menuNodes.map((n) => renderMobileItem(n, 0))}
        </nav>
      </div>
    </header>
  );
}

type FooterProps = {
  cfg: StoreCustomization;
  storeName: string;
  logoUrl?: string;
};

export function SiteFooter({ cfg, storeName, logoUrl }: FooterProps) {
  const name = storeName || 'Store';
  const initial = name.trim().charAt(0).toUpperCase() || 'S';
  const social = cfg.footer.social;
  const year = new Date().getFullYear();
  const configuredFooter = cfg.navigation?.footer;
  const footerConfigured = Array.isArray(configuredFooter);
  const footerMenu: ResolvedNavNode[] = footerConfigured
    ? resolveNavNodes(configuredFooter)
    : legacyToResolved(cfg.footer.quickLinks);

  const renderFooterLink = (n: ResolvedNavNode, indent = false) => (
    n.external ? (
      <a key={n.id} href={n.href} target="_blank" rel="noreferrer" className={`hover:text-[var(--pk-accent)] transition ${indent ? 'block pl-3 mt-1' : ''}`}>
        {n.label}
      </a>
    ) : (
      <Link key={n.id} href={n.href} className={`hover:text-[var(--pk-accent)] transition ${indent ? 'block pl-3 mt-1' : ''}`}>
        {n.label}
      </Link>
    )
  );

  const renderFooterBranch = (n: ResolvedNavNode, depth: number): React.ReactNode => (
    <li key={n.id} className={depth > 0 ? 'pl-3 mt-1' : ''}>
      {renderFooterLink(n, depth > 0)}
      {n.children.length > 0 && (
        <ul className="mt-1 space-y-1">{n.children.map((c) => renderFooterBranch(c, depth + 1))}</ul>
      )}
    </li>
  );

  const footerList = footerConfigured ? (
    footerMenu.length === 0 ? (
      <li className="text-slate-400">No footer links</li>
    ) : (
      footerMenu.map((n) =>
        n.children.length > 0 ? (
          <li key={n.id} className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{n.label}</span>
            <ul className="mt-1.5 space-y-1.5">
              {n.children.slice(0, 24).map((c) => renderFooterBranch(c, 1))}
            </ul>
          </li>
        ) : (
          <li key={n.id}>{renderFooterLink(n)}</li>
        ),
      )
    )
  ) : (
    <>
      <li><Link href="/products" className="hover:text-[var(--pk-accent)] transition">Shop All Products</Link></li>
      <li><Link href="/blog" className="hover:text-[var(--pk-accent)] transition">Journal</Link></li>
      <li><Link href="/cart" className="hover:text-[var(--pk-accent)] transition">View Cart</Link></li>
      <li><Link href="/track" className="hover:text-[var(--pk-accent)] transition">Track Your Order</Link></li>
      {footerMenu.map((n) => <li key={n.id}>{renderFooterLink(n)}</li>)}
    </>
  );

  return (
    <footer className="bg-slate-900 text-slate-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-lg bg-[var(--pk-primary)] text-white font-black flex items-center justify-center text-sm">
                {initial}
              </span>
            )}
            <span className="font-black text-white">{name}</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            {cfg.footer.aboutText ||
              'Premium Pakistani unstitched fabrics — lawn, cotton jacquard and festive silks, delivered nationwide with COD.'}
          </p>
          {(social?.whatsapp || social?.instagram || social?.facebook || social?.tiktok) && (
            <div className="flex gap-2 mt-3">
              {social?.whatsapp && (
                <a
                  href={`https://wa.me/${String(social.whatsapp).replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  title="WhatsApp"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[var(--pk-primary)] text-slate-200 hover:text-white flex items-center justify-center transition"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
              {social?.instagram && (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noreferrer"
                  title="Instagram"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[var(--pk-primary)] text-slate-200 hover:text-white flex items-center justify-center transition"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {social?.facebook && (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noreferrer"
                  title="Facebook"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[var(--pk-primary)] text-slate-200 hover:text-white flex items-center justify-center transition"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {social?.tiktok && (
                <a
                  href={social.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  title="TikTok"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[var(--pk-primary)] text-slate-200 hover:text-white flex items-center justify-center transition"
                >
                  <Music2 className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
            {footerConfigured ? 'Menu' : 'Quick Links'}
          </h4>
          <ul className="space-y-2 text-xs font-medium">{footerList}</ul>
        </div>

        <div>
          <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
            We Accept
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'] as const)
              .filter((m) => cfg.payments[m] !== false)
              .map((p) => (
                <span
                  key={p}
                  className="text-[10px] font-bold bg-slate-800 text-slate-200 px-2 py-1 rounded-md border border-slate-700"
                >
                  {p}
                </span>
              ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2.5">Cash on Delivery available nationwide</p>
        </div>

        <div>
          <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
            Customer Support
          </h4>
          <ul className="space-y-2 text-xs font-medium text-slate-300">
            {cfg.footer.social?.whatsapp ? (
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[var(--pk-accent)]" />
                {cfg.footer.social.whatsapp}
              </li>
            ) : (
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[var(--pk-accent)]" /> WhatsApp assistance
              </li>
            )}
            <li className="flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-[var(--pk-accent)]" /> TCS · Leopards · PostEx · TRAX
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--pk-accent)]" /> 7-day exchange
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-[var(--pk-accent)]" /> Order OTP via SMS
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800 py-4 px-4 text-center text-[11px] text-slate-500">
        © {year} {name}
        {cfg.footer.copyright ? ` · ${cfg.footer.copyright}` : ''} · Powered by{' '}
        <span className="text-[var(--pk-accent)] font-bold">Pak Commerce</span>
      </div>
    </footer>
  );
}
