'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Folder,
  Tag,
  Users,
  CreditCard,
  Settings,
  Webhook,
  Store,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { getToken, clearToken, getCurrentUser, getApiBase } from '@/lib/api';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/collections', label: 'Collections', icon: Folder },
  { href: '/discounts', label: 'Discounts', icon: Tag },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    getCurrentUser()
      .then((r) => {
        setUser(r.user);
        setApiUp(true);
        setReady(true);
      })
      .catch(() => {
        clearToken();
        router.replace('/login');
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">
        <span className="inline-block w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin mr-3" />
        Checking session…
      </div>
    );
  }

  const logout = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 flex flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <div className="h-9 w-9 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white">
            P
          </div>
          <div className="leading-tight">
            <h1 className="font-bold text-white text-sm">Pak Commerce</h1>
            <p className="text-[10px] text-emerald-400 font-medium">Merchant Hub</p>
          </div>
        </div>

        <div className="mt-3 px-3">
          <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 flex items-center gap-2">
            <Store className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="leading-tight min-w-0">
              <div className="text-white text-xs font-semibold truncate">Khaadi Unstitched</div>
              <div className="text-[10px] text-slate-400 truncate">khaadi.pakcommerce.pk</div>
            </div>
          </div>
        </div>

        <nav className="mt-4 px-3 space-y-0.5 flex-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {user && (
            <div className="flex items-center justify-between">
              <div className="leading-tight min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={logout}
                title="Log out"
                className="text-slate-400 hover:text-red-400 p-2 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-500">
              {NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))?.label ??
                'Admin'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                apiUp
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${apiUp ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
              />
              {apiUp ? 'API Connected' : 'API Offline'} · {getApiBase().replace('http://', '')}
            </div>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noreferrer"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition hidden md:flex items-center gap-2"
            >
              Storefront ↗
            </a>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
