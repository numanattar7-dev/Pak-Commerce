'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import {
  AnnouncementBar,
  SiteHeader,
  SiteFooter,
} from '@pak-commerce/storefront-renderer';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { imgUrl } from '@/lib/api';

export default function Shell({ children }: { children: React.ReactNode }) {
  const { store, customization: cfg } = useStore();
  const { count, hydrated } = useCart();
  const pathname = usePathname();

  const name = store?.name || 'Khaadi Unstitched';
  const logoResolved = imgUrl(cfg.branding.logoUrl) || undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar cfg={cfg} />

      <SiteHeader
        cfg={cfg}
        storeName={name}
        subdomain={store?.subdomain}
        logoUrl={logoResolved}
        activePath={pathname}
        cartSlot={
          <Link
            href="/cart"
            className="relative flex items-center gap-2 bg-[var(--pk-scheme-button)] text-[var(--pk-scheme-button-text)] px-3.5 sm:px-4 py-2.5 text-xs font-bold hover:opacity-90 transition"
            style={{ borderRadius: 'var(--pk-button-radius, 12px)' }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Cart</span>
            {hydrated && count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[var(--pk-scheme-accent)] text-[var(--pk-scheme-bg)] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--pk-scheme-bg)]">
                {count}
              </span>
            )}
          </Link>
        }
      />

      <main className="flex-1 w-full">{children}</main>

      <SiteFooter cfg={cfg} storeName={name} logoUrl={logoResolved} />
    </div>
  );
}
