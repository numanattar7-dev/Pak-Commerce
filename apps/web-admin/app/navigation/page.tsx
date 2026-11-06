'use client';

// ---------------------------------------------------------------------------
// Navigation — nested header & footer menus.
// Persisted inside StoreSettings.configJson.navigation and enforced by the
// backend validator (tenant-scoped, depth ≤ 3, URL rules, ref rules).
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Trash2, ChevronUp, ChevronDown, ArrowLeft, Loader2, Check, RotateCcw,
  Eye, Home, Package, Layers, ShoppingBag, Link2, FileText, ChevronRight, GripVertical, Save, Newspaper,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  DEFAULT_CUSTOMIZATION,
  mergeStoreConfig,
  type NavLinkType,
  type NavNode,
} from '@pak-commerce/storefront-renderer';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';
const MAX_ITEMS = 120;

const TYPE_OPTS: Array<{ value: NavLinkType; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'home', label: 'Home', hint: 'Storefront home page', icon: Home },
  { value: 'products', label: 'All products', hint: '/products listing', icon: Package },
  { value: 'collections', label: 'All collections', hint: '/collections listing', icon: Layers },
  { value: 'blog', label: 'Blog', hint: '/blog listing', icon: Newspaper },
  { value: 'track', label: 'Track Order', hint: '/track page', icon: ShoppingBag },
  { value: 'product', label: 'Product', hint: 'Single product — enter its id', icon: ShoppingBag },
  { value: 'collection', label: 'Collection', hint: 'One collection — enter its handle', icon: Layers },
  { value: 'page', label: 'Page', hint: 'One page — enter its handle', icon: FileText },
  { value: 'external', label: 'External URL', hint: 'https://… only', icon: Link2 },
];

type MenuKey = 'header' | 'footer';

let __id = 0;
const newId = () => `mn-${Date.now().toString(36)}-${(++__id).toString(36)}`;
const DEFAULT_HEADER: NavNode[] = [
  { id: 'mn-home', label: 'Home', enabled: true, type: 'home' },
  { id: 'mn-products', label: 'Shop All', enabled: true, type: 'products' },
  { id: 'mn-blog', label: 'Journal', enabled: true, type: 'blog' },
  { id: 'mn-track', label: 'Track Order', enabled: true, type: 'track' },
];

function countNodes(list: NavNode[]): number {
  return list.reduce((acc, n) => acc + 1 + (n.children ? countNodes(n.children) : 0), 0);
}

function findNode(list: NavNode[], id: string): NavNode | null {
  for (const n of list) {
    if (n.id === id) return n;
    const hit = n.children ? findNode(n.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

function depthOfNode(list: NavNode[], id: string, depth = 1): number | null {
  for (const n of list) {
    if (n.id === id) return depth;
    const hit = n.children ? depthOfNode(n.children, id, depth + 1) : null;
    if (hit) return hit;
  }
  return null;
}

function subtreeHeight(node: NavNode): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(subtreeHeight));
}

type LegacyRow = { label?: string; href?: string };

function isSafeExternalUrl(href: string): boolean {
  if (href.length > 500 || /[<>"'\\]/.test(href)) return false;
  try {
    const url = new URL(href);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
  } catch {
    return false;
  }
}

/** Best-effort import of the previous flat menu links into typed nav nodes. */
function legacyToNavNodes(rows?: LegacyRow[] | null): { nodes: NavNode[]; skipped: string[] } {
  const nodes: NavNode[] = [];
  const skipped: string[] = [];
  if (!Array.isArray(rows)) return { nodes, skipped };
  rows.forEach((row, index) => {
    const label = String(row?.label ?? '').trim().slice(0, 80);
    const href = String(row?.href ?? '').trim();
    if (!label || !href) return;
    if (/[<>"'\\]/.test(label) || label.length > 80) {
      skipped.push(label || href);
      return;
    }
    const id = `mn-legacy-${index}`;
    const base = { id, label, enabled: true } as const;
    if (href === '/') return nodes.push({ ...base, type: 'home' });
    if (href === '/products') return nodes.push({ ...base, type: 'products' });
    if (href === '/collections') return nodes.push({ ...base, type: 'collections' });
    if (href === '/blog') return nodes.push({ ...base, type: 'blog' });
    if (href === '/track') return nodes.push({ ...base, type: 'track' });

    const product = /^\/products\/([a-zA-Z0-9-]{8,64})$/.exec(href);
    if (product) return nodes.push({ ...base, type: 'product', ref: product[1] });
    const collection = /^\/collections\/([a-z0-9-]{2,60})$/.exec(href);
    if (collection) return nodes.push({ ...base, type: 'collection', ref: collection[1] });
    const page = /^\/p\/([a-z0-9-]{2,60})$/.exec(href);
    if (page) return nodes.push({ ...base, type: 'page', ref: page[1] });
    if (isSafeExternalUrl(href)) {
      return nodes.push({ ...base, type: 'external', url: href });
    }
    skipped.push(label);
  });
  return { nodes, skipped };
}

export default function NavigationManager() {
  const [cfg, setCfg] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState<MenuKey>('header');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [refs, setRefs] = useState<{
    products: Array<{ id: string; title: string }>;
    collections: Array<{ handle: string; title: string }>;
    pages: Array<{ handle: string; title: string }>;
  }>({ products: [], collections: [], pages: [] });

  const menus = useMemo<{ header: NavNode[]; footer: NavNode[] }>(() => {
    const nav = cfg?.navigation;
    return {
      header: Array.isArray(nav?.header) ? nav.header : structuredClone(DEFAULT_HEADER),
      footer: Array.isArray(nav?.footer) ? nav.footer : [],
    };
  }, [cfg]);

  const activeMenu = menus[menu];
  const total = countNodes(menus.header) + countNodes(menus.footer);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await api<{ config: Record<string, unknown> }>('/store-settings');
      const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, s.config as any);
      if (!merged.navigation) {
        const header = legacyToNavNodes(merged.header.menuLinks);
        const footer = legacyToNavNodes(merged.footer.quickLinks);
        if (header.nodes.length || footer.nodes.length) {
          merged.navigation = {
            ...(header.nodes.length ? { header: header.nodes } : {}),
            ...(footer.nodes.length ? { footer: footer.nodes } : {}),
          };
          const skipped = [...header.skipped, ...footer.skipped];
          setImportNote(
            `Imported ${header.nodes.length + footer.nodes.length} link(s) from your existing menu. ` +
              'Review them, then click Save changes to publish the new menu.' +
              (skipped.length
                ? ` ${skipped.length} unsupported link(s) were not imported: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}.`
                : ''),
          );
          // Imported links only live in the editor until the merchant saves.
          setDirty(true);
        }
      }
      setCfg(merged);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load settings');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Best-effort reference data for product/collection/page pickers.
  useEffect(() => {
    (async () => {
      const [products, collections, pages] = await Promise.all([
        api<{ data: Array<{ id: string; title: string }> }>('/products?page=1&limit=100').catch(() => null),
        api<Array<{ handle: string; title: string }>>('/collections').catch(() => null),
        api<Array<{ slug: string; title: string }>>('/store-pages').catch(() => null),
      ]);
      setRefs({
        products: (products?.data ?? []).map((p) => ({ id: p.id, title: p.title })),
        collections: Array.isArray(collections) ? collections.map((c) => ({ handle: c.handle, title: c.title })) : [],
        pages: Array.isArray(pages) ? pages.map((p) => ({ handle: p.slug, title: p.title })) : [],
      });
    })();
  }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // Warn before leaving with unsaved menu edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || anchor.target === '_blank') return;
      if (!window.confirm('You have unsaved navigation changes. Leave this page and discard them?')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setDirty(false);
    };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', handler);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const saveNow = async () => {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      await api('/store-settings', { method: 'PUT', body: { config: cfg } });
      setDirty(false);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2000);
      flash('Navigation saved');
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const updateMenu = (which: MenuKey, nextList: NavNode[]) => {
    setCfg((c: any) => {
      const existing =
        c?.navigation && typeof c.navigation === 'object' && !Array.isArray(c.navigation)
          ? c.navigation
          : {};
      return { ...c, navigation: { ...existing, [which]: nextList } };
    });
    setDirty(true);
  };

  const setNodes = (which: MenuKey, fn: (nodes: NavNode[]) => NavNode[]) => updateMenu(which, fn(menus[which]));

  const addItem = (parentId?: string) => {
    if (total >= MAX_ITEMS) {
      setError(`Navigation is limited to ${MAX_ITEMS} items`);
      return;
    }
    const item: NavNode = { id: newId(), label: 'New link', enabled: true, type: 'external', url: 'https://' };
    if (!parentId) {
      setNodes(menu, (l) => [...l, item]);
      return;
    }
    setNodes(menu, (l) => {
      const clone = structuredClone(l);
      const target = findNode(clone, parentId);
      if (!target) return l;
      target.children = [...(target.children ?? []), item];
      return clone;
    });
  };

  const removeItem = (id: string) =>
    setNodes(menu, (l) => {
      const clone = structuredClone(l);
      const removeFrom = (list: NavNode[]): boolean => {
        const i = list.findIndex((n) => n.id === id);
        if (i >= 0) { list.splice(i, 1); return true; }
        return list.some((n) => n.children && removeFrom(n.children));
      };
      removeFrom(clone);
      return clone;
    });

  const updateNode = (id: string, patch: Partial<NavNode>) =>
    setNodes(menu, (l) => {
      const clone = structuredClone(l);
      const edit = (list: NavNode[]): boolean => {
        for (const n of list) {
          if (n.id === id) { Object.assign(n, patch); return true; }
          if (n.children && edit(n.children)) return true;
        }
        return false;
      };
      edit(clone);
      return clone;
    });

  const moveNode = (id: string, dir: -1 | 1) =>
    setNodes(menu, (l) => {
      const clone = structuredClone(l);
      const moveIn = (list: NavNode[]): boolean => {
        const i = list.findIndex((n) => n.id === id);
        if (i >= 0) {
          const j = i + dir;
          if (j < 0 || j >= list.length) return true;
          [list[i], list[j]] = [list[j], list[i]];
          return true;
        }
        return list.some((n) => n.children && moveIn(n.children));
      };
      moveIn(clone);
      return clone;
    });

  const resetDefaultHeader = () => updateMenu('header', structuredClone(DEFAULT_HEADER));

  const containsNode = (node: NavNode, id: string): boolean =>
    node.id === id || (node.children ?? []).some((c) => containsNode(c, id));

  /** Drag-and-drop: insert the dragged node immediately before the drop target. */
  const moveBefore = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setError(null);
    const source = findNode(activeMenu, draggedId);
    const targetDepth = depthOfNode(activeMenu, targetId);
    if (source && targetDepth && targetDepth + subtreeHeight(source) - 1 > 3) {
      setError('Menu items can be nested at most 3 levels deep');
      return;
    }
    setNodes(menu, (list) => {
      const clone = structuredClone(list);
      const dragged = findNode(clone, draggedId);
      // Never allow a parent to be dropped inside its own subtree.
      if (!dragged || containsNode(dragged, targetId)) return list;

      const strip = (l: NavNode[]): NavNode | null => {
        const i = l.findIndex((n) => n.id === draggedId);
        if (i >= 0) return l.splice(i, 1)[0];
        for (const n of l) {
          if (!n.children) continue;
          const hit = strip(n.children);
          if (hit) return hit;
        }
        return null;
      };
      const node = strip(clone);
      if (!node) return list;

      const insert = (l: NavNode[]): boolean => {
        const i = l.findIndex((n) => n.id === targetId);
        if (i >= 0) {
          l.splice(i, 0, node);
          return true;
        }
        return l.some((n) => (n.children ? insert(n.children) : false));
      };
      return insert(clone) ? clone : list;
    });
  };

  const inputCls =
    'rounded-lg border border-slate-300 px-2.5 py-[7px] text-[12px] outline-none focus:border-slate-900 bg-white';

  const renderNode = (n: NavNode, depth: number): React.ReactNode => (
    <div
      key={n.id}
      className={`${depth > 1 ? 'ml-6 border-l border-slate-200 pl-3' : ''} ${
        dragOverId === n.id ? 'rounded-lg ring-2 ring-slate-900/20 bg-slate-50' : ''
      } ${dragId === n.id ? 'opacity-50' : ''}`}
      onDragOver={(e) => {
        if (dragId && dragId !== n.id) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          setDragOverId(n.id);
        }
      }}
      onDragLeave={() => setDragOverId((cur) => (cur === n.id ? null : cur))}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragId) moveBefore(dragId, n.id);
        setDragId(null);
        setDragOverId(null);
      }}
    >
      <div className="flex items-center gap-1.5 py-1.5">
        <span
          draggable
          onDragStart={(e) => {
            setDragId(n.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', n.id);
          }}
          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-slate-500"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button onClick={() => moveNode(n.id, -1)} title="Move up" className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => moveNode(n.id, 1)} title="Move down" className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronDown className="w-3.5 h-3.5" /></button>
        <button
          onClick={() => updateNode(n.id, { enabled: !n.enabled })}
          title={n.enabled ? 'Hide in storefront' : 'Show in storefront'}
          className={`w-8 h-5 rounded-full transition relative shrink-0 ${n.enabled ? 'bg-slate-900' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${n.enabled ? 'left-[14px]' : 'left-0.5'}`} />
        </button>
        <input
          value={n.label}
          onChange={(e) => updateNode(n.id, { label: e.target.value })}
          placeholder="Menu label"
          className={`${inputCls} flex-1 min-w-0 font-medium`}
        />
        <button onClick={() => removeItem(n.id)} title="Remove" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
        {depth < 3 && (
          <button onClick={() => addItem(n.id)} title="Add sub-item" className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><Plus className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <div className="flex items-center gap-1.5 pb-1.5 pl-[64px] flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase text-slate-400">Type</span>
          <select value={n.type} onChange={(e) => updateNode(n.id, { type: e.target.value as NavLinkType, ref: undefined, url: undefined })} className={`${inputCls} w-32`}>
            {TYPE_OPTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {n.type === 'product' && (
          <input list="nav-product-options" value={n.ref ?? ''} onChange={(e) => updateNode(n.id, { ref: e.target.value })} placeholder="product id — or pick an existing product" className={`${inputCls} flex-1 min-w-48 font-mono text-[11px]`} />
        )}
        {(n.type === 'collection' || n.type === 'page') && (
          <input
            list={n.type === 'collection' ? 'nav-collection-options' : 'nav-page-options'}
            value={n.ref ?? ''}
            onChange={(e) => updateNode(n.id, { ref: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            placeholder={n.type === 'collection' ? 'collection handle — or pick one' : 'page handle — or pick one'}
            className={`${inputCls} flex-1 min-w-48 font-mono text-[11px]`}
          />
        )}
        {n.type === 'external' && (
          <input value={n.url ?? ''} onChange={(e) => updateNode(n.id, { url: e.target.value })} placeholder="https://example.com" className={`${inputCls} flex-1 min-w-48 font-mono text-[11px]`} />
        )}
        <span className="text-[9px] text-slate-400 hidden xl:inline">
          {TYPE_OPTS.find((t) => t.value === n.type)?.hint}
        </span>
      </div>
      {n.children?.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  if (!loaded) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading menus…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="p-1.5 rounded hover:bg-slate-100 text-slate-400" title="Back to admin"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Navigation</h2>
            <p className="text-[11px] text-slate-500">Header and footer menus. {total}/{MAX_ITEMS} items · drag the ⋮⋮ handle to reorder · save when ready.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedTick && <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved</span>}
          {dirty && !savedTick && <span className="text-[11px] font-semibold text-amber-700">Unsaved changes</span>}
          <button
            onClick={saveNow}
            disabled={!dirty || busy}
            className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
          </button>
          <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"><Eye className="w-4 h-4" /> Preview</a>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-4 py-2.5">{error}</div>
      )}
      {importNote && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 text-sky-800 text-[12px] px-4 py-2.5">{importNote}</div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] px-4 py-2 flex items-center gap-2"><Check className="w-4 h-4" /> {toast}</div>
      )}

      {/* ── tabs ── */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {(['header', 'footer'] as MenuKey[]).map((k) => (
          <button key={k} onClick={() => setMenu(k)} className={`px-4 py-2 text-[12px] font-bold uppercase tracking-wider border-b-2 transition ${menu === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            {k === 'header' ? 'Header menu' : 'Footer menu'} ({menus[k].length})
          </button>
        ))}
        {menu === 'header' && (
          <button onClick={resetDefaultHeader} title="Restore default Home / Shop All / Track Order" className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded hover:bg-slate-100">
            <RotateCcw className="w-3.5 h-3.5" /> Restore default
          </button>
        )}
      </div>

      {/* reference pickers for internal links */}
      <datalist id="nav-product-options">
        {refs.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </datalist>
      <datalist id="nav-collection-options">
        {refs.collections.map((c) => <option key={c.handle} value={c.handle}>{c.title}</option>)}
      </datalist>
      <datalist id="nav-page-options">
        {refs.pages.map((p) => <option key={p.handle} value={p.handle}>{p.title}</option>)}
      </datalist>

      {/* ── tree ── */}
      <section className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {activeMenu.length === 0 ? (
          <div className="py-12 text-center">
            <ChevronRight className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="mt-2 text-[13px] font-semibold text-slate-600">{menu === 'header' ? 'Empty menu' : 'No footer menu yet'}</p>
            <p className="text-[11px] text-slate-400">{menu === 'header' ? 'This storefront header will fall back to the default Home / Shop All links.' : 'The default footer links will be used.'}</p>
          </div>
        ) : (
          <div className="px-3 py-2">{activeMenu.map((n) => renderNode(n, 1))}</div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <button onClick={() => addItem()} disabled={busy || total >= MAX_ITEMS} className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add item
        </button>
        <p className="text-[11px] text-slate-400">{busy ? 'Saving…' : dirty ? 'Unsaved changes — click Save changes' : 'All changes saved'}</p>
      </div>
    </div>
  );
}
