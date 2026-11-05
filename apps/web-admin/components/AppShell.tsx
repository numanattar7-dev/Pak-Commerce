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
  Globe,
  FileText,
  Menu as NavMenuIcon,
  Store,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { getToken, clearToken, getCurrentUser, getApiBase } from '@/lib/api';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { title?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/collections', label: 'Collections', icon: Folder },
      { href: '/discounts', label: 'Discounts', icon: Tag },
    ],
  },
  {
    title: 'Customers',
    items: [{ href: '/customers', label: 'Customers', icon: Users }],
  },
  {
    title: 'Online store',
    items: [
      { href: '/online-store', label: 'Online store', icon: Globe },
      { href: '/online-store/pages', label: 'Pages', icon: FileText },
      { href: '/online-store/navigation', label: 'Navigation', icon: NavMenuIcon },
      { href: '/online-store/preferences', label: 'Preferences', icon: Settings },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-[#f1f1f1] text-slate-500 text-[13px]">
        <span className="inline-block w-5 h-5 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin mr-3" />
        Checking session…
      </div>
    );
  }

  const logout = () => {
    clearToken();
    router.replace('/login');
  };

  const exactMatch = ['/', '/online-store'];
  const isActive = (href: string) =>
    exactMatch.includes(href) ? pathname === href : pathname.startsWith(href);
  const currentLabel =
    ALL_ITEMS.find((n) =>
      exactMatch.includes(n.href) ? pathname === n.href : pathname.startsWith(n.href),
    )?.label ?? 'Admin';

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── top bar (dark, Shopify-style) ── */}
      <header className="h-12 bg-[#1a1a1a] text-white flex items-center justify-between px-3 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-white/10 transition"
            title="Toggle sidebar"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 bg-[#95bf47] rounded flex items-center justify-center font-black text-[#1a1a1a] text-xs shrink-0">
              P
            </span>
            <span className="font-semibold text-[13px] truncate">Khaadi Unstitched</span>
            <span className="hidden sm:inline text-[10px] font-bold bg-white/10 text-white/70 px-1.5 py-0.5 rounded">
              Trial
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              apiUp
                ? 'bg-[#113b2c] text-[#7ee2b8] border-[#1f5c42]'
                : 'bg-red-950 text-red-300 border-red-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${apiUp ? 'bg-[#7ee2b8] animate-pulse' : 'bg-red-400'}`}
            />
            {apiUp ? 'API Connected' : 'API Offline'}
          </div>
          <a
            href={process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded text-[11px] font-semibold transition"
          >
            <Store className="w-3.5 h-3.5" /> View store
          </a>
          {user && (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
              <span className="w-6 h-6 rounded-full bg-[#4a5bfe] text-white text-[10px] font-bold flex items-center justify-center">
                {user.name?.charAt(0).toUpperCase() || 'A'}
              </span>
              <span className="text-[11px] text-white/70 max-w-[120px] truncate hidden lg:inline">
                {user.email}
              </span>
            </div>
          )}
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ── sidebar (light, grouped) ── */}
        <aside
          className={`${
            sidebarOpen ? 'w-60' : 'w-14'
          } bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-12 h-[calc(100vh-3rem)] transition-all duration-150 overflow-hidden`}
        >
          <nav className="py-3 flex-1 overflow-y-auto">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} className="mb-2 px-2">
                {group.title && sidebarOpen && (
                  <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                      <a
                        key={href}
                        href={href}
                        title={label}
                        className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition ${
                          active
                            ? 'bg-slate-100 font-semibold text-slate-900'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`}
                        />
                        {sidebarOpen && <span className="truncate">{label}</span>}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          {sidebarOpen && (
            <div className="border-t border-slate-100 p-3">
              <div className="rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3">
                <p className="text-[11px] font-bold">Trial plan</p>
                <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                  Upgrade for more stores and staff seats.
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* ── content ── */}
        <main className="flex-1 min-w-0">
          <div className="px-6 lg:px-10 py-6 max-w-[1000px] mx-auto w-full">
            <h1 className="text-lg font-bold text-slate-900 mb-4">{currentLabel}</h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
