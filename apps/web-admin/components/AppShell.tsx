'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Folder,
  Tag,
  Users,
  CreditCard,
  Palette,
  Settings,
  Webhook,
  Store,
  LogOut,
  Menu,
  X,
  ChevronDown,
  BarChart3,
  Megaphone,
  Newspaper,
} from 'lucide-react';
import { getToken, clearToken, getCurrentUser, getApiBase } from '@/lib/api';

// ---------------------------------------------------------------------------
// Navigation model
// Items pointing at routes that exist today are real links. Items that arrive
// in a later milestone are rendered disabled with a milestone badge — they are
// never dead links and never fake functionality.
// ---------------------------------------------------------------------------

type NavItem = {
  href?: string;           // present = real link
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;          // e.g. "M6" for upcoming milestone
  disabled?: boolean;      // true = not available yet (badge shown, no click)
  exact?: boolean;         // active only on exact path match
};

type NavGroup = {
  id: string;
  title?: string;          // undefined = primary group, always open
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'primary',
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard, exact: true },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/payments', label: 'Payments', icon: CreditCard },
    ],
  },
  {
    id: 'catalog',
    title: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: Package },
      { href: '/collections', label: 'Collections', icon: Folder },
      { href: '/discounts', label: 'Discounts', icon: Tag },
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    items: [
      { href: '/customers', label: 'Customers', icon: Users },
      { label: 'Analytics', icon: BarChart3, badge: 'M8', disabled: true },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    items: [{ label: 'Marketing', icon: Megaphone, badge: 'Later', disabled: true }],
  },
  {
    id: 'content',
    title: 'Content',
    items: [{ href: '/blog', label: 'Blog posts', icon: Newspaper }],
  },
  {
    id: 'online-store',
    title: 'Online store',
    items: [{ href: '/themes', label: 'Themes', icon: Palette }],
  },
  {
    id: 'settings',
    title: 'Settings',
    items: [
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ALL_LINKED = NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.href));

const SIDEBAR_KEY = 'pkc_admin_sidebar_collapsed';       // '1' = icons only
const GROUPS_KEY = 'pkc_admin_nav_groups_collapsed';     // JSON Record<string, boolean>

function readStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  // Expanded by default (professional default); persisted across reloads.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({});

  // ── auth ────────────────────────────────────────────────────────────────
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

  // ── restore persisted nav state (client only) ───────────────────────────
  useEffect(() => {
    setSidebarOpen(readStorage(SIDEBAR_KEY) !== '1');
    try {
      const raw = readStorage(GROUPS_KEY);
      setGroupsCollapsed(raw ? JSON.parse(raw) : {});
    } catch {
      setGroupsCollapsed({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? '0' : '1');
    } catch {
      /* private mode */
    }
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsCollapsed));
    } catch {
      /* private mode */
    }
  }, [groupsCollapsed]);

  // ── active route helpers ─────────────────────────────────────────────────
  const isActive = (item: NavItem) => {
    if (!item.href) return false;
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  };

  const activeGroupId = useMemo(
    () => NAV_GROUPS.find((g) => g.items.some(isActive))?.id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname],
  );

  // Auto-expand the group that contains the current route
  useEffect(() => {
    if (!activeGroupId) return;
    setGroupsCollapsed((prev) =>
      prev[activeGroupId] ? { ...prev, [activeGroupId]: false } : prev,
    );
  }, [activeGroupId]);

  const currentLabel =
    ALL_LINKED.find((n) => (n.exact ? pathname === n.href! : pathname.startsWith(n.href!)))
      ?.label ?? 'Admin';

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

  // The theme editor is a focused full-screen workspace — keep the admin
  // sidebar, but drop the page heading and width constraint.
  const isFullScreen = pathname.startsWith('/customize');

  const toggleGroup = (id: string) =>
    setGroupsCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSidebar = () => setSidebarOpen((v) => !v);

  // ── item renderers ───────────────────────────────────────────────────────
  const renderItem = (item: NavItem, groupId: string) => {
    const Icon = item.icon;
    const active = isActive(item);

    if (item.disabled || !item.href) {
      // Not built yet — shown honestly with a milestone badge, never a dead link.
      return (
        <span
          key={groupId + item.label}
          aria-disabled="true"
          title={`Arrives in milestone ${item.badge ?? 'later'}`}
          className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-slate-300 cursor-not-allowed select-none"
        >
          <Icon className="w-4 h-4 shrink-0" />
          {sidebarOpen && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 rounded px-1.5 py-0.5">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </span>
      );
    }

    return (
      <a
        key={item.href}
        href={item.href}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition ${
          active
            ? 'bg-slate-100 font-semibold text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 ${active ? 'text-slate-900' : 'text-slate-400'}`}
        />
        {sidebarOpen && <span className="truncate">{item.label}</span>}
      </a>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-slate-900 focus:text-white focus:px-3 focus:py-1.5 focus:rounded"
      >
        Skip to content
      </a>

      {/* ── top bar (dark, Shopify-style) ── */}
      <header className="h-12 bg-[#1a1a1a] text-white flex items-center justify-between px-3 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-white/10 transition"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-pressed={sidebarOpen}
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
        {/* ── sidebar (light, grouped, collapsible) ── */}
        <aside
          className={`${
            sidebarOpen ? 'w-60' : 'w-14'
          } bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-12 h-[calc(100vh-3rem)] transition-all duration-150 overflow-hidden`}
          aria-label="Admin navigation"
        >
          <nav className="py-3 flex-1 overflow-y-auto">
            {NAV_GROUPS.map((group) => {
              const groupCollapsed = !!groupsCollapsed[group.id];
              const showHeader = !!group.title;
              const showItems = !groupCollapsed;
              return (
                <div key={group.id} className="mb-1.5 px-2">
                  {showHeader && sidebarOpen && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-expanded={!groupCollapsed}
                      aria-controls={`nav-group-${group.id}`}
                      className="w-full flex items-center justify-between px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 rounded transition"
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          groupCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                    </button>
                  )}
                  {showHeader && !sidebarOpen && <div className="my-2 mx-1 border-t border-slate-100" />}
                  {(showItems || !sidebarOpen) && (
                    <div id={`nav-group-${group.id}`} className="space-y-0.5">
                      {group.items.map((item) => renderItem(item, group.id))}
                    </div>
                  )}
                </div>
              );
            })}
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
        <main className="flex-1 min-w-0" id="main-content">
          {isFullScreen ? (
            <div className="h-[calc(100vh-3rem)]">{children}</div>
          ) : (
            <div className="px-6 lg:px-10 py-6 max-w-[1000px] mx-auto w-full">
              <h1 className="text-lg font-bold text-slate-900 mb-4">{currentLabel}</h1>
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
