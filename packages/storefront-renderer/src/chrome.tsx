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
  const baseNav = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Shop All' },
    { href: '/track', label: 'Track Order' },
  ];
  const navLinks = [...baseNav, ...(cfg.header.menuLinks || [])];
  const activeCls = (active: boolean) =>
    active
      ? 'text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)]'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50';

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
            {navLinks.map((n) => {
              const active =
                n.href === '/' ? activePath === '/' : activePath.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${activeCls(active)}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {cartSlot}
        </div>

        {/* mobile nav */}
        <nav className="md:hidden flex items-center gap-1 pb-2 -mt-1 overflow-x-auto">
          {navLinks.map((n) => {
            const active =
              n.href === '/' ? activePath === '/' : activePath.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${activeCls(active)}`}
              >
                {n.label}
              </Link>
            );
          })}
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
            Quick Links
          </h4>
          <ul className="space-y-2 text-xs font-medium">
            <li><Link href="/products" className="hover:text-[var(--pk-accent)] transition">Shop All Products</Link></li>
            <li><Link href="/cart" className="hover:text-[var(--pk-accent)] transition">View Cart</Link></li>
            <li><Link href="/track" className="hover:text-[var(--pk-accent)] transition">Track Your Order</Link></li>
            {(cfg.footer.quickLinks || []).map((l) => (
              <li key={`${l.label}-${l.href}`}>
                <Link href={l.href} className="hover:text-[var(--pk-accent)] transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
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
