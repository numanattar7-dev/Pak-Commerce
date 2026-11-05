'use client';

// ---------------------------------------------------------------------------
// Themes — Visual theme editor (Milestone 3 foundation)
// Three-part Shopify-style layout:
//   left  → collapsible customization panel (compact sections)
//   right → live storefront preview (desktop / tablet / mobile, real renderer)
// Toolbar → theme name, save status, undo/redo, device switch, preview, save
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Megaphone,
  Sparkles,
  LayoutGrid,
  Menu as MenuIcon,
  PanelBottom,
  CreditCard,
  ShoppingBag,
  Search,
  Palette,
  FileText,
  Upload,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Loader2,
  Undo2,
  Redo2,
  PanelLeft,
} from 'lucide-react';
import {
  StoreCustomization,
  DEFAULT_CUSTOMIZATION,
  mergeStoreConfig,
  PREVIEW_MESSAGE_TYPE,
} from '@pak-commerce/storefront-renderer';
import { api, apiUpload, getApiBase } from '@/lib/api';

type LinkRow = { label: string; href: string };

type StorePageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
};

const COLOR_PRESETS = ['#059669', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0f172a', '#be185d', '#0d9488'];
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';
const MAX_HISTORY = 80;

type SectionKey =
  | 'branding'
  | 'theme'
  | 'announcement'
  | 'hero'
  | 'sections'
  | 'header'
  | 'footer'
  | 'payments'
  | 'checkout'
  | 'seo';

const SECTIONS: Array<{ key: SectionKey; title: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'branding', title: 'Branding', icon: ImageIcon },
  { key: 'theme', title: 'Theme colors', icon: Palette },
  { key: 'announcement', title: 'Announcement bar', icon: Megaphone },
  { key: 'hero', title: 'Hero', icon: Sparkles },
  { key: 'sections', title: 'Home sections', icon: LayoutGrid },
  { key: 'header', title: 'Header menu', icon: MenuIcon },
  { key: 'footer', title: 'Footer', icon: PanelBottom },
  { key: 'payments', title: 'Payments', icon: CreditCard },
  { key: 'checkout', title: 'Checkout', icon: ShoppingBag },
  { key: 'seo', title: 'SEO', icon: Search },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Device = 'desktop' | 'tablet' | 'mobile';

export default function ThemeEditor() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);

  const [cfg, setCfg] = useState<StoreCustomization>(DEFAULT_CUSTOMIZATION);
  const [savedCfg, setSavedCfg] = useState<StoreCustomization>(DEFAULT_CUSTOMIZATION);
  const [loaded, setLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey | ''>('hero');
  const [leftOpen, setLeftOpen] = useState(true);
  const [device, setDevice] = useState<Device>('desktop');
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // undo/redo history (snapshots of the full config)
  const past = useRef<StoreCustomization[]>([]);
  const future = useRef<StoreCustomization[]>([]);
  const [, setHistTick] = useState(0);

  // pages manager (modal)
  const [pages, setPages] = useState<StorePageRow[]>([]);
  const [pageEditing, setPageEditing] = useState<Partial<StorePageRow> | null>(null);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(savedCfg);

  // ── load settings + pages ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api<{ config: Record<string, unknown> }>('/store-settings'),
        api<StorePageRow[]>('/store-pages'),
      ]);
      const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, s.config);
      setCfg(merged);
      setSavedCfg(merged);
      setPages(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── live preview push (debounced) ────────────────────────────────────────
  const sendPreview = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_MESSAGE_TYPE, config: cfg },
        '*',
      );
    } catch {
      /* iframe not ready */
    }
  }, [cfg]);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(sendPreview, 120);
    return () => clearTimeout(t);
  }, [cfg, loaded, sendPreview]);

  // ── history helpers ───────────────────────────────────────────────────────
  const commit = useCallback(
    (next: StoreCustomization, record = true) => {
      if (record) {
        past.current.push(cfg);
        if (past.current.length > MAX_HISTORY) past.current.shift();
        future.current = [];
        setHistTick((t) => t + 1);
      }
      setCfg(next);
    },
    [cfg],
  );

  const set = useCallback(
    (section: SectionKey, key: string, value: unknown) => {
      commit({
        ...cfg,
        [section]: { ...(cfg[section] as Record<string, unknown>), [key]: value },
      } as StoreCustomization);
    },
    [cfg, commit],
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const prev = past.current.pop()!;
    future.current.unshift(cfg);
    setCfg(prev);
    setHistTick((t) => t + 1);
  }, [cfg]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current.shift()!;
    past.current.push(cfg);
    setCfg(next);
    setHistTick((t) => t + 1);
  }, [cfg]);

  const isEditableTarget = (t: EventTarget | null) => {
    if (!(t instanceof HTMLElement)) return false;
    const tag = t.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  };

  // keyboard shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        if (isEditableTarget(e.target)) return; // let the field handle text undo
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── unsaved-changes protection ────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ── save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    setBusy(true);
    setSaveState('saving');
    setError(null);
    try {
      await api('/store-settings', { method: 'PUT', body: { config: cfg } });
      setSavedCfg(cfg);
      setSaveState('saved');
      setSavedAt(
        new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (e: any) {
      setSaveState('error');
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }, [cfg]);

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const upload = async (section: SectionKey, key: string, file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiUpload<{ url: string }>('/products/upload-image', file);
      set(section, key, res.url);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const resolveImg = (src?: string) =>
    src ? (src.startsWith('http') ? src : `${getApiBase()}/${src.replace(/^\/+/, '')}`) : '';

  // ── pages CRUD ────────────────────────────────────────────────────────────
  const savePage = async () => {
    if (!pageEditing?.title?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (pageEditing.id) {
        await api(`/store-pages/${pageEditing.id}`, {
          method: 'PUT',
          body: {
            title: pageEditing.title,
            slug: pageEditing.slug || undefined,
            content: pageEditing.content || '',
            isPublished: pageEditing.isPublished ?? false,
          },
        });
      } else {
        await api('/store-pages', {
          method: 'POST',
          body: {
            title: pageEditing.title,
            slug: pageEditing.slug || undefined,
            content: pageEditing.content || '',
            isPublished: pageEditing.isPublished ?? false,
          },
        });
      }
      setPageEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const delPage = async (p: StorePageRow) => {
    if (!confirm(`Delete page "${p.title}"?`)) return;
    try {
      await api(`/store-pages/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  // exit with unsaved-changes guard
  const exitEditor = () => {
    if (dirty && !confirm('You have unsaved changes. Exit without saving?')) return;
    router.push('/');
  };

  // ── field primitives (compact rows) ───────────────────────────────────────
  const linksOf = (arr: LinkRow[] | undefined) => arr ?? [];

  const Field = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-[11px] font-medium text-slate-500 mb-1">{title}</p>
      {children}
    </div>
  );
  const TextField = (p: {
    title: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    area?: boolean;
  }) => (
    <Field title={p.title}>
      {p.area ? (
        <textarea
          rows={2}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
      ) : (
        <input
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
      )}
    </Field>
  );
  const Toggle = (p: { title: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
      <span className="text-[13px] text-slate-700">{p.title}</span>
      <button
        type="button"
        onClick={() => p.onChange(!p.checked)}
        className={`w-9 h-5 rounded-full transition relative ${p.checked ? 'bg-slate-900' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
            p.checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  const deviceBtn = (d: Device, Icon: React.ComponentType<{ className?: string }>, title: string) => (
    <button
      key={d}
      onClick={() => setDevice(d)}
      title={title}
      aria-pressed={device === d}
      className={`p-1.5 rounded ${device === d ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  // preview frame width per device mode
  const frameCls =
    device === 'mobile'
      ? 'w-[390px] h-full'
      : device === 'tablet'
        ? 'w-[768px] h-full max-w-full'
        : 'w-full h-full';

  return (
    <div className="h-full flex flex-col bg-[#ececee]">
      {/* ── top toolbar ── */}
      <header className="h-12 bg-[#1a1a1a] text-white flex items-center justify-between px-2 sm:px-3 shrink-0 z-30 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={exitEditor}
            title="Back to admin"
            className="p-1.5 rounded hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLeftOpen((v) => !v)}
            title={leftOpen ? 'Hide settings panel' : 'Show settings panel'}
            aria-pressed={leftOpen}
            className="p-1.5 rounded hover:bg-white/10 transition"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-2 min-w-0 border-l border-white/10 pl-2 ml-1">
            <span className="text-[13px] font-semibold truncate">Current theme</span>
            <span className="text-[10px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded">Draft</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          {deviceBtn('desktop', Monitor, 'Desktop preview')}
          {deviceBtn('tablet', Tablet, 'Tablet preview')}
          {deviceBtn('mobile', Smartphone, 'Mobile preview')}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold ${
              saveState === 'error'
                ? 'text-red-300'
                : dirty || saveState === 'saving'
                  ? 'text-amber-300'
                  : 'text-[#7ee2b8]'
            }`}
            aria-live="polite"
          >
            {saveState === 'saving' || busy
              ? 'Saving…'
              : dirty
                ? '● Unsaved changes'
                : saveState === 'error'
                  ? 'Save failed'
                  : savedAt
                    ? `✓ Saved ${savedAt}`
                    : '✓ All changes saved'}
          </span>
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noreferrer"
            title="Open live store"
            className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="bg-[#95bf47] hover:bg-[#83a83c] disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1a1a] text-xs font-bold px-4 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            {saveState === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-xs shrink-0">{error}</div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── left: customization panel ── */}
        {leftOpen && (
          <aside className="w-[300px] xl:w-[330px] bg-white border-r border-slate-200 flex flex-col shrink-0">
            <div className="px-4 h-11 border-b border-slate-100 flex items-center justify-between shrink-0">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Sections</p>
              <button
                onClick={() => setPageEditing({ title: '', content: '', isPublished: false })}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> Pages ({pages.length})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {!loaded ? (
                <div className="py-16 text-center text-slate-400 text-xs">Loading…</div>
              ) : (
                SECTIONS.map(({ key, title, icon: Icon }) => {
                  const open = activeSection === key;
                  return (
                    <div key={key} className="mb-1">
                      <button
                        onClick={() => setActiveSection(open ? '' : key)}
                        aria-expanded={open}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition ${
                          open ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-[13px] font-medium text-slate-800 flex-1">{title}</span>
                        {(key === 'announcement' || key === 'hero') && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              set(key, 'enabled', !(key === 'announcement' ? cfg.announcement.enabled !== false : cfg.hero.enabled !== false));
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400"
                            title="Show / hide"
                          >
                            {(key === 'announcement' ? cfg.announcement.enabled !== false : cfg.hero.enabled !== false) ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                      </button>

                      {open && (
                        <div className="px-3 pb-4 pt-2 space-y-3 border-b border-slate-100">
                          {/* ---- BRANDING ---- */}
                          {key === 'branding' && (
                            <>
                              <Field title="Logo">
                                <div className="flex items-center gap-2.5">
                                  {cfg.branding.logoUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={resolveImg(cfg.branding.logoUrl)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                      <ImageIcon className="w-4 h-4" />
                                    </div>
                                  )}
                                  <button onClick={() => logoInput.current?.click()} className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
                                    <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                                  </button>
                                  {cfg.branding.logoUrl && (
                                    <button onClick={() => set('branding', 'logoUrl', '')} className="text-xs text-red-600 hover:text-red-700">
                                      Remove
                                    </button>
                                  )}
                                  <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => upload('branding', 'logoUrl', e.target.files?.[0])} />
                                </div>
                              </Field>
                              <Field title="Favicon (browser tab)">
                                <div className="flex items-center gap-2.5">
                                  {cfg.branding.faviconUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={resolveImg(cfg.branding.faviconUrl)} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200" />
                                  ) : (
                                    <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200" />
                                  )}
                                  <button onClick={() => faviconInput.current?.click()} className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
                                    <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                                  </button>
                                  <input ref={faviconInput} type="file" accept="image/*" hidden onChange={(e) => upload('branding', 'faviconUrl', e.target.files?.[0])} />
                                </div>
                              </Field>
                              <TextField title="Tagline (under store name)" value={cfg.branding.tagline || ''} onChange={(v) => set('branding', 'tagline', v)} placeholder="Pure Fabrics Since 1995" />
                            </>
                          )}

                          {/* ---- THEME COLORS ---- */}
                          {key === 'theme' && (
                            <>
                              <Field title="Primary color">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input type="color" value={cfg.theme.primary || '#059669'} onChange={(e) => set('theme', 'primary', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                                  {COLOR_PRESETS.map((c) => (
                                    <button key={c} onClick={() => set('theme', 'primary', c)} aria-label={`Primary ${c}`} className={`w-7 h-7 rounded-lg border-2 ${cfg.theme.primary === c ? 'border-slate-900' : 'border-white ring-1 ring-slate-200'} shadow-sm`} style={{ backgroundColor: c }} />
                                  ))}
                                </div>
                              </Field>
                              <Field title="Accent color">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input type="color" value={cfg.theme.accent || '#0d9488'} onChange={(e) => set('theme', 'accent', e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer" />
                                  {COLOR_PRESETS.slice().reverse().map((c) => (
                                    <button key={c} onClick={() => set('theme', 'accent', c)} aria-label={`Accent ${c}`} className={`w-7 h-7 rounded-lg border-2 ${cfg.theme.accent === c ? 'border-slate-900' : 'border-white ring-1 ring-slate-200'} shadow-sm`} style={{ backgroundColor: c }} />
                                  ))}
                                </div>
                              </Field>
                            </>
                          )}

                          {/* ---- ANNOUNCEMENT ---- */}
                          {key === 'announcement' && (
                            <TextField title="Text" value={cfg.announcement.text || ''} onChange={(v) => set('announcement', 'text', v)} />
                          )}

                          {/* ---- HERO ---- */}
                          {key === 'hero' && (
                            <>
                              <TextField title="Badge" value={cfg.hero.badge || ''} onChange={(v) => set('hero', 'badge', v)} />
                              <TextField title="Heading" value={cfg.hero.title || ''} onChange={(v) => set('hero', 'title', v)} />
                              <TextField title="Sub-heading" value={cfg.hero.subtitle || ''} onChange={(v) => set('hero', 'subtitle', v)} area />
                              <Field title="Image (optional — defaults to latest product)">
                                <div className="flex items-center gap-2">
                                  {cfg.hero.imageUrl && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={resolveImg(cfg.hero.imageUrl)} alt="" className="w-8 h-10 rounded-md object-cover border border-slate-200" />
                                  )}
                                  <button onClick={() => heroInput.current?.click()} className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
                                    <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
                                  </button>
                                  {cfg.hero.imageUrl && (
                                    <button onClick={() => set('hero', 'imageUrl', '')} className="text-xs text-red-600">Remove</button>
                                  )}
                                  <input ref={heroInput} type="file" accept="image/*" hidden onChange={(e) => upload('hero', 'imageUrl', e.target.files?.[0])} />
                                </div>
                              </Field>
                              <div className="grid grid-cols-2 gap-2">
                                <TextField title="Button text" value={cfg.hero.ctaText || ''} onChange={(v) => set('hero', 'ctaText', v)} />
                                <TextField title="Button link" value={cfg.hero.ctaLink || ''} onChange={(v) => set('hero', 'ctaLink', v)} placeholder="/products" />
                              </div>
                            </>
                          )}

                          {/* ---- HOME SECTIONS ---- */}
                          {key === 'sections' && (
                            <>
                              <Toggle title="Feature highlights strip" checked={cfg.sections.showFeatures !== false} onChange={(v) => set('sections', 'showFeatures', v)} />
                              <Field title="Featured products shown">
                                <input
                                  value={String(cfg.sections.featuredCount ?? 8)}
                                  onChange={(e) => set('sections', 'featuredCount', Number(e.target.value.replace(/\D/g, '')) || 8)}
                                  className="w-20 rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                                />
                              </Field>
                              <TextField title="Home blurb (optional)" value={cfg.sections.aboutBlurb || ''} onChange={(v) => set('sections', 'aboutBlurb', v)} />
                            </>
                          )}

                          {/* ---- HEADER MENU ---- */}
                          {key === 'header' && (
                            <div className="space-y-2">
                              {linksOf(cfg.header.menuLinks).map((l, i) => (
                                <div key={i} className="flex gap-1.5">
                                  <input
                                    value={l.label}
                                    placeholder="Label"
                                    onChange={(e) => {
                                      const arr = [...linksOf(cfg.header.menuLinks)];
                                      arr[i] = { ...arr[i], label: e.target.value };
                                      set('header', 'menuLinks', arr);
                                    }}
                                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-[7px] text-xs outline-none focus:border-slate-900"
                                  />
                                  <input
                                    value={l.href}
                                    placeholder="/products"
                                    onChange={(e) => {
                                      const arr = [...linksOf(cfg.header.menuLinks)];
                                      arr[i] = { ...arr[i], href: e.target.value };
                                      set('header', 'menuLinks', arr);
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-[7px] text-xs outline-none focus:border-slate-900"
                                  />
                                  <button
                                    onClick={() => set('header', 'menuLinks', linksOf(cfg.header.menuLinks).filter((_, x) => x !== i))}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                    title="Remove link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => set('header', 'menuLinks', [...linksOf(cfg.header.menuLinks), { label: '', href: '' }])}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add link
                              </button>
                            </div>
                          )}

                          {/* ---- FOOTER ---- */}
                          {key === 'footer' && (
                            <>
                              <TextField title="About text" value={cfg.footer.aboutText || ''} onChange={(v) => set('footer', 'aboutText', v)} area />
                              <div className="grid grid-cols-2 gap-2">
                                <TextField title="WhatsApp" value={cfg.footer.social?.whatsapp || ''} onChange={(v) => set('footer', 'social', { ...cfg.footer.social, whatsapp: v })} placeholder="0321…" />
                                <TextField title="Instagram" value={cfg.footer.social?.instagram || ''} onChange={(v) => set('footer', 'social', { ...cfg.footer.social, instagram: v })} />
                                <TextField title="Facebook" value={cfg.footer.social?.facebook || ''} onChange={(v) => set('footer', 'social', { ...cfg.footer.social, facebook: v })} />
                                <TextField title="TikTok" value={cfg.footer.social?.tiktok || ''} onChange={(v) => set('footer', 'social', { ...cfg.footer.social, tiktok: v })} />
                              </div>
                              <div className="space-y-1.5">
                                {linksOf(cfg.footer.quickLinks).map((l, i) => (
                                  <div key={i} className="flex gap-1.5">
                                    <input
                                      value={l.label}
                                      placeholder="Label"
                                      onChange={(e) => {
                                        const arr = [...linksOf(cfg.footer.quickLinks)];
                                        arr[i] = { ...arr[i], label: e.target.value };
                                        set('footer', 'quickLinks', arr);
                                      }}
                                      className="w-28 rounded-lg border border-slate-300 px-2.5 py-[7px] text-xs outline-none focus:border-slate-900"
                                    />
                                    <input
                                      value={l.href}
                                      placeholder="/p/about-us"
                                      onChange={(e) => {
                                        const arr = [...linksOf(cfg.footer.quickLinks)];
                                        arr[i] = { ...arr[i], href: e.target.value };
                                        set('footer', 'quickLinks', arr);
                                      }}
                                      className="flex-1 rounded-lg border border-slate-300 px-2.5 py-[7px] text-xs outline-none focus:border-slate-900"
                                    />
                                    <button
                                      onClick={() => set('footer', 'quickLinks', linksOf(cfg.footer.quickLinks).filter((_, x) => x !== i))}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                      title="Remove link"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => set('footer', 'quickLinks', [...linksOf(cfg.footer.quickLinks), { label: '', href: '' }])}
                                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add quick link
                                </button>
                              </div>
                              <TextField title="Copyright note" value={cfg.footer.copyright || ''} onChange={(v) => set('footer', 'copyright', v)} />
                            </>
                          )}

                          {/* ---- PAYMENTS ---- */}
                          {key === 'payments' && (
                            <div className="space-y-1">
                              {(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'] as const).map((m) => (
                                <Toggle
                                  key={m}
                                  title={m}
                                  checked={cfg.payments[m] !== false}
                                  onChange={(v) => set('payments', m, v)}
                                />
                              ))}
                            </div>
                          )}

                          {/* ---- CHECKOUT ---- */}
                          {key === 'checkout' && (
                            <>
                              <TextField title="Confirmation message (order page)" value={cfg.checkout.confirmationMsg || ''} onChange={(v) => set('checkout', 'confirmationMsg', v)} placeholder="Shukriya! Order confirm ho gaya." />
                              <Toggle title="Show order notes field" checked={cfg.checkout.allowNotes !== false} onChange={(v) => set('checkout', 'allowNotes', v)} />
                            </>
                          )}

                          {/* ---- SEO ---- */}
                          {key === 'seo' && (
                            <>
                              <TextField title="Meta title" value={cfg.seo.metaTitle || ''} onChange={(v) => set('seo', 'metaTitle', v)} />
                              <TextField title="Meta description" value={cfg.seo.metaDescription || ''} onChange={(v) => set('seo', 'metaDescription', v)} area />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* ── center: live preview (same renderer as public storefront) ── */}
        <section className="flex-1 min-w-0 flex items-stretch justify-center overflow-hidden">
          <div className={`bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_18px_50px_rgba(0,0,0,0.14)] overflow-hidden transition-all duration-300 ${frameCls}`}>
            <iframe
              ref={iframeRef}
              src={`${STOREFRONT_URL}/?preview=1`}
              title="Storefront preview"
              onLoad={sendPreview}
              className="w-full h-full border-0 block"
            />
          </div>
        </section>
      </div>

      {/* ── pages modal ── */}
      {pageEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPageEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-semibold text-slate-900">{pageEditing.id ? 'Edit page' : 'New page'}</h3>
              <button onClick={() => setPageEditing(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <Field title="Title *">
                <input
                  value={pageEditing.title || ''}
                  onChange={(e) => setPageEditing({ ...pageEditing, title: e.target.value })}
                  placeholder="About Us"
                  className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                />
              </Field>
              <Field title="Slug (auto if empty)">
                <input
                  value={pageEditing.slug || ''}
                  onChange={(e) => setPageEditing({ ...pageEditing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="about-us"
                  className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                />
              </Field>
              <Field title="Content">
                <textarea
                  rows={8}
                  value={pageEditing.content || ''}
                  onChange={(e) => setPageEditing({ ...pageEditing, content: e.target.value })}
                  placeholder="Write your page content here…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                />
              </Field>
              <Toggle title="Published (visible on storefront)" checked={pageEditing.isPublished ?? false} onChange={(v) => setPageEditing({ ...pageEditing, isPublished: v })} />
              <div className="flex gap-2 pt-1">
                <button onClick={savePage} disabled={busy || !pageEditing.title?.trim()} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-slate-800 transition flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Save page
                </button>
                {pageEditing.id && (
                  <button
                    onClick={() => {
                      const p = pages.find((x) => x.id === pageEditing.id);
                      if (p) { delPage(p); setPageEditing(null); }
                    }}
                    className="bg-white border border-red-300 text-red-600 rounded-lg px-3.5 py-2 text-[13px] font-medium hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div className="px-5 pb-5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">All pages</p>
              <div className="space-y-1">
                {pages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:border-slate-200">
                    <button onClick={() => setPageEditing({ ...p })} className="text-[13px] font-medium text-slate-800 hover:underline">
                      {p.title}
                    </button>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.isPublished ? 'LIVE' : 'DRAFT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
