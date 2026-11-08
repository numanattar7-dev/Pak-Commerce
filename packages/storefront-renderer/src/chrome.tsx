// ---------------------------------------------------------------------------
// Shared storefront chrome — announcement bar, header and footer.
// Renders identically in the public storefront and inside the admin live
// preview iframe. Keep markup faithful to what shoppers see.
//
// Every chrome part paints itself from a color scheme selected by the
// merchant (announcement → scheme, header → scheme, footer → scheme) plus
// theme-level design tokens (fonts, radius, layouts, spacing).
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
import { sanitizeLinkRows, schemeFor, schemeVars, resolveDesign } from './config';
import type { ResolvedNavNode } from './navigation';
import { resolveNavNodes, legacyToResolved } from './navigation';

/* ---------------- Announcement bar ---------------- */

export function AnnouncementBar({ cfg }: { cfg: StoreCustomization }) {
  if (cfg.announcement.enabled === false || !cfg.announcement.text) return null;
  const scheme = schemeFor(cfg, 'announcement');
  return (
    <div
      style={schemeVars(scheme)}
      className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] text-[11px] text-center py-1.5 px-4 font-semibold tracking-wide border-b border-[var(--pk-scheme-border)]"
    >
      {cfg.announcement.text}
    </div>
  );
}

/* ---------------- Header ---------------- */

type HeaderProps = {
  cfg: StoreCustomization;
  storeName: string;
  subdomain?: string;
  logoUrl?: string;
  activePath: string;
  cartSlot?: React.ReactNode;
};

const headingFontStyle = { fontFamily: 'var(--pk-font-heading, inherit)' } as React.CSSProperties;

export function SiteHeader({ cfg, storeName, subdomain, logoUrl, activePath, cartSlot }: HeaderProps) {
  const design = resolveDesign(cfg);
  const scheme = schemeFor(cfg, 'header');
  const centered = design.headerLayout === 'centered';
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
    : [...defaultNav, ...legacyToResolved(sanitizeLinkRows(cfg.header?.menuLinks))];

  const activeCls = (active: boolean) =>
    active
      ? 'text-[var(--pk-scheme-button-text)] bg-[var(--pk-scheme-button)]'
      : 'text-[var(--pk-scheme-text)] hover:text-[var(--pk-scheme-heading)] hover:bg-[var(--pk-scheme-bg)] border border-transparent hover:border-[var(--pk-scheme-border)]';

  const isActive = (href: string) =>
    href === '/' ? activePath === '/' : activePath.startsWith(href);

  const renderDesktopChild = (c: ResolvedNavNode, depth: number): React.ReactNode => {
    const pad = depth === 0 ? 'px-4' : depth === 1 ? 'pl-8 pr-4' : 'pl-12 pr-4';
    const cls = `block py-2 text-[13px] font-semibold text-[var(--pk-scheme-text)] hover:text-[var(--pk-scheme-heading)] hover:bg-[var(--pk-scheme-bg)] ${pad}`;
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
      const cls = `px-4 py-2 text-sm font-bold transition rounded-[var(--pk-button-radius)] ${activeCls(isActive(n.href))}`;
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
          className={`px-4 py-2 text-sm font-bold transition flex items-center gap-1.5 rounded-[var(--pk-button-radius)] ${activeCls(isActive(n.href))}`}
        >
          {n.label}
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="absolute left-0 top-full z-50 mt-1 min-w-56 rounded-[var(--pk-radius)] border border-[var(--pk-scheme-border)] bg-[var(--pk-scheme-bg)] shadow-lg py-1 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition">
          {n.children.slice(0, 24).map((c) => renderDesktopChild(c, 0))}
        </div>
      </div>
    );
  };

  const renderMobileItem = (n: ResolvedNavNode, depth: number) => {
    const pad = depth === 0 ? 'px-3 py-1.5' : 'pl-6 pr-3 py-1.5';
    const base = `${pad} text-xs font-bold transition block whitespace-nowrap`;
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

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logoUrl} alt={name} className="w-9 h-9 object-cover shadow-sm" style={{ borderRadius: 'var(--pk-radius)' }} />
      ) : (
        <span
          style={schemeVars(scheme) as React.CSSProperties}
          className="w-9 h-9 bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] font-black text-lg flex items-center justify-center shadow-sm"
        >
          {initial}
        </span>
      )}
      <span className="leading-tight">
        <span
          style={headingFontStyle}
          className={`block font-black text-[var(--pk-scheme-heading)] text-sm sm:text-base ${design.uppercaseHeadings ? 'uppercase tracking-widest' : ''}`}
        >
          {name}
        </span>
        <span className="hidden sm:block text-[10px] text-[var(--pk-scheme-text)] opacity-70 font-bold uppercase tracking-widest">
          {cfg.branding.tagline || (subdomain ? `${subdomain}.pakcommerce.pk` : 'Pakistan')}
        </span>
      </span>
    </Link>
  );

  return (
    <header
      style={schemeVars(scheme)}
      className={
        cfg.header?.sticky === false
          ? 'relative z-40 bg-[var(--pk-scheme-bg)] border-b border-[var(--pk-scheme-border)]'
          : 'sticky top-0 z-40 bg-[var(--pk-scheme-bg)] border-b border-[var(--pk-scheme-border)]'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {centered ? (
          /* centered logo, menu below — Dawn-style */
          <div className="py-3">
            <div className="flex items-center justify-center relative">
              {brand}
              {cartSlot && <div className="absolute right-0">{cartSlot}</div>}
            </div>
            <nav className="hidden md:flex items-center justify-center gap-1 mt-2">
              {menuNodes.map(renderDesktopItem)}
            </nav>
            <nav className="md:hidden flex flex-wrap items-center justify-center gap-1 mt-2 -mb-1">
              {menuNodes.map((n) => renderMobileItem(n, 0))}
            </nav>
          </div>
        ) : (
          <>
            <div className="h-16 flex items-center justify-between gap-3">
              {brand}
              <nav className="hidden md:flex items-center gap-1">
                {menuNodes.map(renderDesktopItem)}
              </nav>
              {cartSlot}
            </div>
            {/* mobile nav */}
            <nav className="md:hidden flex flex-wrap items-center gap-1 pb-2 -mt-1">
              {menuNodes.map((n) => renderMobileItem(n, 0))}
            </nav>
          </>
        )}
      </div>
    </header>
  );
}

/* ---------------- Footer ---------------- */

type FooterProps = {
  cfg: StoreCustomization;
  storeName: string;
  logoUrl?: string;
};

export function SiteFooter({ cfg, storeName, logoUrl }: FooterProps) {
  const design = resolveDesign(cfg);
  const scheme = schemeFor(cfg, 'footer');
  const name = storeName || 'Store';
  const initial = name.trim().charAt(0).toUpperCase() || 'S';
  const social = cfg.footer.social;
  const year = new Date().getFullYear();
  const configuredFooter = cfg.navigation?.footer;
  const footerConfigured = Array.isArray(configuredFooter);
  const footerMenu: ResolvedNavNode[] = footerConfigured
    ? resolveNavNodes(configuredFooter)
    : legacyToResolved(sanitizeLinkRows(cfg.footer?.quickLinks));

  const renderFooterLink = (n: ResolvedNavNode, indent = false) => (
    n.external ? (
      <a key={n.id} href={n.href} target="_blank" rel="noreferrer" className={`hover:text-[var(--pk-scheme-accent)] transition ${indent ? 'block pl-3 mt-1' : ''}`}>
        {n.label}
      </a>
    ) : (
      <Link key={n.id} href={n.href} className={`hover:text-[var(--pk-scheme-accent)] transition ${indent ? 'block pl-3 mt-1' : ''}`}>
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
      <li className="opacity-60">No footer links</li>
    ) : (
      footerMenu.map((n) =>
        n.children.length > 0 ? (
          <li key={n.id} className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{n.label}</span>
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
      <li><Link href="/products" className="hover:text-[var(--pk-scheme-accent)] transition">Shop All Products</Link></li>
      <li><Link href="/blog" className="hover:text-[var(--pk-scheme-accent)] transition">Journal</Link></li>
      <li><Link href="/cart" className="hover:text-[var(--pk-scheme-accent)] transition">View Cart</Link></li>
      <li><Link href="/track" className="hover:text-[var(--pk-scheme-accent)] transition">Track Your Order</Link></li>
      {footerMenu.map((n) => <li key={n.id}>{renderFooterLink(n)}</li>)}
    </>
  );

  const brandBlock = (
    <div className="flex items-center gap-2.5 mb-3">
      {logoUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logoUrl} alt={name} className="w-8 h-8 object-cover" style={{ borderRadius: 'var(--pk-radius)' }} />
      ) : (
        <span className="w-8 h-8 bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] font-black flex items-center justify-center text-sm">
          {initial}
        </span>
      )}
      <span
        style={headingFontStyle}
        className={`font-black text-[var(--pk-scheme-heading)] ${design.uppercaseHeadings ? 'uppercase tracking-widest' : ''}`}
      >
        {name}
      </span>
    </div>
  );

  const aboutBlock = (
    <p className="text-xs leading-relaxed opacity-70 text-[var(--pk-scheme-text)]">
      {cfg.footer.aboutText ||
        'Premium Pakistani unstitched fabrics — lawn, cotton jacquard and festive silks, delivered nationwide with COD.'}
    </p>
  );

  const socialLinks = (roundClass = '') => (
    <div className={`flex gap-2 mt-3 ${roundClass}`}>
      {social?.whatsapp && (
        <a
          href={`https://wa.me/${String(social.whatsapp).replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          title="WhatsApp"
          className="w-8 h-8 bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] border border-[var(--pk-scheme-border)] hover:bg-[var(--pk-scheme-button)] hover:text-[var(--pk-scheme-button-text)] flex items-center justify-center transition"
          style={{ borderRadius: 'var(--pk-radius)' }}
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
          className="w-8 h-8 bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] border border-[var(--pk-scheme-border)] hover:bg-[var(--pk-scheme-button)] hover:text-[var(--pk-scheme-button-text)] flex items-center justify-center transition"
          style={{ borderRadius: 'var(--pk-radius)' }}
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
          className="w-8 h-8 bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] border border-[var(--pk-scheme-border)] hover:bg-[var(--pk-scheme-button)] hover:text-[var(--pk-scheme-button-text)] flex items-center justify-center transition"
          style={{ borderRadius: 'var(--pk-radius)' }}
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
          className="w-8 h-8 bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] border border-[var(--pk-scheme-border)] hover:bg-[var(--pk-scheme-button)] hover:text-[var(--pk-scheme-button-text)] flex items-center justify-center transition"
          style={{ borderRadius: 'var(--pk-radius)' }}
        >
          <Music2 className="w-4 h-4" />
        </a>
      )}
    </div>
  );

  const paymentsBlock = (
    <div>
      <h4 className="text-[11px] font-bold text-[var(--pk-scheme-heading)] uppercase tracking-widest mb-3">
        We Accept
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'] as const)
          .filter((m) => cfg.payments[m] !== false)
          .map((p) => (
            <span
              key={p}
              className="text-[10px] font-bold bg-[var(--pk-scheme-secondary-button)] text-[var(--pk-scheme-secondary-button-text)] px-2 py-1 border border-[var(--pk-scheme-border)]"
              style={{ borderRadius: 'var(--pk-radius)' }}
            >
              {p}
            </span>
          ))}
      </div>
      <p className="text-[10px] opacity-60 mt-2.5 text-[var(--pk-scheme-text)]">Cash on Delivery available nationwide</p>
    </div>
  );

  const supportBlock = (
    <div>
      <h4 className="text-[11px] font-bold text-[var(--pk-scheme-heading)] uppercase tracking-widest mb-3">
        Customer Support
      </h4>
      <ul className="space-y-2 text-xs font-medium text-[var(--pk-scheme-text)]">
        {cfg.footer.social?.whatsapp ? (
          <li className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-[var(--pk-scheme-accent)]" />
            {cfg.footer.social.whatsapp}
          </li>
        ) : (
          <li className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-[var(--pk-scheme-accent)]" /> WhatsApp assistance
          </li>
        )}
        <li className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-[var(--pk-scheme-accent)]" /> TCS · Leopards · PostEx · TRAX
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--pk-scheme-accent)]" /> 7-day exchange
        </li>
        <li className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-[var(--pk-scheme-accent)]" /> Order OTP via SMS
        </li>
      </ul>
    </div>
  );

  const menuBlock = (
    <div>
      <h4 className="text-[11px] font-bold text-[var(--pk-scheme-heading)] uppercase tracking-widest mb-3">
        {footerConfigured ? 'Menu' : 'Quick Links'}
      </h4>
      <ul className="space-y-2 text-xs font-medium text-[var(--pk-scheme-text)]">{footerList}</ul>
    </div>
  );

  return (
    <footer style={schemeVars(scheme)} className="bg-[var(--pk-scheme-bg)] text-[var(--pk-scheme-text)] border-t border-[var(--pk-scheme-border)] mt-20">
      {design.footerLayout === 'compact' ? (
        /* centered, one-column — Dawn-style minimal footer */
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          {brandBlock}
          {aboutBlock}
          {socialLinks('justify-center')}
          <div className="mt-8 border-t border-[var(--pk-scheme-border)] pt-6">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium">{footerList}</ul>
          </div>
          <div className="mt-6 border-t border-[var(--pk-scheme-border)] pt-4 text-[11px] opacity-70">
            © {year} {name}
            {cfg.footer.copyright ? ` · ${cfg.footer.copyright}` : ''} · Powered by{' '}
            <span className="text-[var(--pk-scheme-accent)] font-bold">Pak Commerce</span>
          </div>
        </div>
      ) : (
        <>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              {brandBlock}
              {aboutBlock}
              {socialLinks()}
            </div>
            {menuBlock}
            {paymentsBlock}
            {supportBlock}
          </div>
          <div className="border-t border-[var(--pk-scheme-border)] py-4 px-4 text-center text-[11px] opacity-70 text-[var(--pk-scheme-text)]">
            © {year} {name}
            {cfg.footer.copyright ? ` · ${cfg.footer.copyright}` : ''} · Powered by{' '}
            <span className="text-[var(--pk-scheme-accent)] font-bold">Pak Commerce</span>
          </div>
        </>
      )}
    </footer>
  );
}
