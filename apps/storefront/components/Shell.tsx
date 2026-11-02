'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingBag,
  Phone,
  Truck,
  ShieldCheck,
  Banknote,
  MessageCircle,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useCart } from '@/lib/cart';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Shop All' },
  { href: '/track', label: 'Track Order' },
];

const PAYMENTS = ['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { store } = useStore();
  const { count, hydrated } = useCart();
  const pathname = usePathname();

  const name = store?.name || 'Khaadi Unstitched';
  const initial = name.trim().charAt(0).toUpperCase() || 'K';

  return (
    <div className="flex min-h-screen flex-col">
      {/* announcement bar */}
      <div className="bg-slate-900 text-white text-[11px] text-center py-1.5 px-4 font-semibold tracking-wide">
        Nationwide Delivery to 100+ Cities · Cash on Delivery Available · 7-Day Exchange
      </div>

      {/* header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-black text-lg flex items-center justify-center shadow-sm">
                {initial}
              </span>
              <span className="leading-tight">
                <span className="block font-black text-slate-900 text-sm sm:text-base">
                  {name}
                </span>
                <span className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {store?.subdomain ? `${store.subdomain}.pakcommerce.pk` : 'Pakistan'}
                </span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const active =
                  n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                      active
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/cart"
              className="relative flex items-center gap-2 bg-slate-900 text-white rounded-xl px-3.5 sm:px-4 py-2.5 text-xs font-bold hover:bg-slate-800 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {hydrated && count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {count}
                </span>
              )}
            </Link>
          </div>

          {/* mobile nav */}
          <nav className="md:hidden flex items-center gap-1 pb-2 -mt-1">
            {NAV.map((n) => {
              const active =
                n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    active
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      {/* footer */}
      <footer className="bg-slate-900 text-slate-300 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-sm">
                {initial}
              </span>
              <span className="font-black text-white">{name}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Premium Pakistani unstitched fabrics — lawn, cotton jacquard and
              festive silks, delivered nationwide with COD.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li><Link href="/products" className="hover:text-emerald-400 transition">Shop All Products</Link></li>
              <li><Link href="/cart" className="hover:text-emerald-400 transition">View Cart</Link></li>
              <li><Link href="/track" className="hover:text-emerald-400 transition">Track Your Order</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
              We Accept
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENTS.map((p) => (
                <span
                  key={p}
                  className="text-[10px] font-bold bg-slate-800 text-slate-200 px-2 py-1 rounded-md border border-slate-700"
                >
                  {p}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2.5">
              Cash on Delivery available nationwide
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-3">
              Customer Support
            </h4>
            <ul className="space-y-2 text-xs font-medium text-slate-300">
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp assistance
              </li>
              <li className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-emerald-400" /> TCS · Leopards · PostEx · TRAX
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> 7-day exchange
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Order OTP via SMS
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 py-4 px-4 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} {name} · Powered by{' '}
          <span className="text-emerald-400 font-bold">Pak Commerce</span>
        </div>
      </footer>
    </div>
  );
}
