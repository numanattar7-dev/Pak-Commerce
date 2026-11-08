'use client';

// ---------------------------------------------------------------------------
// Themes — Visual theme editor (Milestone 3 foundation)
// Three-part Shopify-style layout:
//   left  → collapsible customization panel (compact sections)
//   right → live storefront preview (desktop / tablet / mobile, real renderer)
// Toolbar → theme name, save status, undo/redo, device switch, preview, save
// ---------------------------------------------------------------------------

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Image as ImageIcon,
  Megaphone,
  Sparkles,
  LayoutGrid,
  Menu as MenuIcon,
  PanelBottom,
  CreditCard,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Copy,
  GripVertical,
  RotateCcw,
  Layers,
  ShoppingBag,
  Search,
  Palette,
  SlidersHorizontal,
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
  ADDABLE_SECTIONS,
  defaultSection,
  defaultBlock,
  isPreviewPickMessage,
  SCHEME_COLOR_FIELDS,
  DEFAULT_COLOR_SCHEMES,
  getSchemes,
  resolveDesign,
  FONT_CHOICES,
  sectionDefOf,
  UNKNOWN_SECTION_DEF,
  type PkSection,
  type PkSectionType,
  type PkBlock,
  type ColorScheme,
  type ColorSchemeColors,
} from '@pak-commerce/storefront-renderer';
import { api, apiUpload, getApiBase } from '@/lib/api';

type LinkRow = { label: string; href: string };

type ThemeMeta = {
  id: string | null;
  name: string;
  status: 'PUBLISHED' | 'UNPUBLISHED';
};

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';
// Exact origin of the preview iframe — used for all postMessage traffic.
// Falls back to null when NEXT_PUBLIC_STOREFRONT_URL is not a valid URL.
const PREVIEW_ORIGIN = (() => {
  try {
    return new URL(STOREFRONT_URL).origin;
  } catch {
    return null;
  }
})();
const MAX_HISTORY = 80;

type SectionKey =
  | 'home'
  | 'theme'
  | 'design'
  | 'branding'
  | 'announcement'
  | 'hero'
  | 'header'
  | 'footer'
  | 'payments'
  | 'checkout'
  | 'seo';

const SECTIONS: Array<{ key: SectionKey; title: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'home', title: 'Home sections', icon: LayoutGrid },
  { key: 'theme', title: 'Colors', icon: Palette },
  { key: 'design', title: 'Theme settings', icon: SlidersHorizontal },
  { key: 'branding', title: 'Branding', icon: ImageIcon },
  { key: 'announcement', title: 'Announcement bar', icon: Megaphone },
  { key: 'hero', title: 'Hero', icon: Sparkles },
  { key: 'header', title: 'Header menu', icon: MenuIcon },
  { key: 'footer', title: 'Footer', icon: PanelBottom },
  { key: 'payments', title: 'Payments', icon: CreditCard },
  { key: 'checkout', title: 'Checkout', icon: ShoppingBag },
  { key: 'seo', title: 'SEO', icon: Search },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Device = 'desktop' | 'tablet' | 'mobile';

/* ---- color-scheme editor helpers (module scope) --------------------------- */

/** Normalize any stored color to strict #rrggbb so <input type="color"> can display it. */
const toHex6 = (value: string): string => {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  const short = /^#[0-9a-fA-F]{3}$/.exec(value);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const long = /^#[0-9a-fA-F]{8}$/.exec(value);
  if (long) return `#${long[1].slice(0, 6)}`.toLowerCase();
  return '#000000';
};

/** One editable scheme color row — color chip + typing-tolerant hex input. */
function HexColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commitText = (t: string) => {
    setText(t);
    if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(t)) onChange(t.toLowerCase());
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={toHex6(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0.5 shrink-0 bg-white"
        aria-label={label}
      />
      <span className="text-[12px] text-slate-700 flex-1 min-w-0 truncate">{label}</span>
      <input
        value={text}
        onChange={(e) => commitText(e.target.value)}
        spellCheck={false}
        aria-label={`${label} hex`}
        className="w-24 rounded-lg border border-slate-300 px-2 py-[5px] text-[11px] font-mono outline-none focus:border-slate-900"
      />
    </div>
  );
}

function ThemeEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const themeIdParam = searchParams.get('theme');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);

  const [cfg, setCfg] = useState<StoreCustomization>(DEFAULT_CUSTOMIZATION);
  const [savedCfg, setSavedCfg] = useState<StoreCustomization>(DEFAULT_CUSTOMIZATION);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<ThemeMeta>({ id: null, name: 'Current theme', status: 'PUBLISHED' });
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

  // home sections — selected row + drag-and-drop reorder
  const [activeHomeId, setActiveHomeId] = useState<string | null>('home-hero');
  const [dragHomeIndex, setDragHomeIndex] = useState<number | null>(null);
  const [dropHomeIndex, setDropHomeIndex] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openScheme, setOpenScheme] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{ id: string; key: string } | null>(null);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(savedCfg);

  // ── load theme config ────────────────────────────────────────────────────
  // • /customize?theme=<id> — Shopify-style per-theme editor:
  //     live theme  → the storefront config (store-settings) + theme meta
  //     draft theme → that theme's saved configJson
  // • /customize (no id) — legacy fallback: edit the live store settings.
  const load = useCallback(async () => {
    try {
      if (themeIdParam) {
        const t = await api<{ id: string; name: string; status: 'PUBLISHED' | 'UNPUBLISHED'; configJson: string }>(
          `/themes/${encodeURIComponent(themeIdParam)}`,
        );
        setTheme({ id: t.id, name: t.name, status: t.status });
        if (t.status === 'PUBLISHED') {
          // live theme — always edit what the storefront is actually serving
          const s = await api<{ config: Record<string, unknown> }>('/store-settings');
          const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, s.config);
          setCfg(merged);
          setSavedCfg(merged);
        } else {
          let parsed: unknown = {};
          try {
            parsed = JSON.parse(t.configJson || '{}');
          } catch {
            parsed = {};
          }
          const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, parsed as Record<string, unknown>);
          setCfg(merged);
          setSavedCfg(merged);
        }
      } else {
        const s = await api<{ config: Record<string, unknown> }>('/store-settings');
        const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, s.config);
        setCfg(merged);
        setSavedCfg(merged);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings');
    } finally {
      setLoaded(true);
    }
  }, [themeIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  // ── live preview push (debounced) ────────────────────────────────────────
  const sendPreview = useCallback(() => {
    if (!PREVIEW_ORIGIN) return; // invalid preview origin — skip rather than wildcard
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: PREVIEW_MESSAGE_TYPE, config: cfg },
        PREVIEW_ORIGIN,
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

  // legacy cfg.sections keys (featured products / features strip) — kept intact
  const setLegacySection = (key: 'showFeatures' | 'featuredCount' | 'aboutBlurb', value: unknown) =>
    commit({ ...cfg, sections: { ...cfg.sections, [key]: value } } as StoreCustomization);

  // theme-level design tokens (fonts, radius, layouts, spacing) — Shopify
  // "Theme settings" panel; additive over the stored config.
  const setStyle = (key: string, value: unknown) =>
    commit({
      ...cfg,
      style: { ...(cfg.style as Record<string, unknown> | null ?? {}), [key]: value },
    } as StoreCustomization);

  // ── Shopify-style color schemes ────────────────────────────────────────────
  // Five independent schemes; every chrome part and every home section can
  // pick its own via settings.schemeId (announced in the Colors panel).
  const schemes = getSchemes(cfg);

  const setSchemes = (next: ColorScheme[]) =>
    commit({ ...cfg, colorSchemes: { schemes: next } } as StoreCustomization);

  const patchSchemeColors = (index: number, patch: Partial<ColorSchemeColors>) =>
    setSchemes(
      getSchemes(cfg).map((s, i) => (i === index ? { ...s, colors: { ...s.colors, ...patch } } : s)),
    );

  const renameScheme = (index: number, name: string) =>
    setSchemes(getSchemes(cfg).map((s, i) => (i === index ? { ...s, name } : s)));

  const resetScheme = (index: number) => {
    if (index < 0 || index >= DEFAULT_COLOR_SCHEMES.length) return;
    if (!confirm('Reset this scheme to its built-in colors?')) return;
    setSchemes(
      getSchemes(cfg).map((s, i) =>
        i === index ? { ...s, colors: { ...DEFAULT_COLOR_SCHEMES[i].colors } } : s,
      ),
    );
  };

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
  // Shopify: the theme editor's Save writes into the theme being edited.
  // A live theme also updates the storefront immediately (the backend syncs
  // StoreSettings in the same transaction); a draft theme saves as a draft.
  const save = useCallback(async () => {
    setBusy(true);
    setSaveState('saving');
    setError(null);
    try {
      if (theme.id) {
        await api(`/themes/${encodeURIComponent(theme.id)}`, { method: 'PUT', body: { config: cfg } });
      } else {
        await api('/store-settings', { method: 'PUT', body: { config: cfg } });
      }
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
  }, [cfg, theme.id]);

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

  // ── home sections (add / remove / duplicate / reorder / toggle / reset) ─────
  const homeSections = cfg.home?.sections ?? [];

  const postSelection = useCallback(() => {
    if (!PREVIEW_ORIGIN) return;
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'pk-preview-select', id: activeSection === 'home' ? activeHomeId : null },
        PREVIEW_ORIGIN,
      );
    } catch {
      /* iframe not ready */
    }
  }, [activeSection, activeHomeId]);

  useEffect(() => {
    if (!loaded) return;
    postSelection();
  }, [postSelection, loaded]);

  // click-to-select inside the preview iframe — origin, source and payload validated
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!PREVIEW_ORIGIN || e.origin !== PREVIEW_ORIGIN) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      if (!isPreviewPickMessage(e.data)) return;
      setActiveHomeId(e.data.id);
      setActiveSection('home');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const mutateHome = (fn: (list: PkSection[]) => PkSection[]) =>
    commit({ ...cfg, home: { sections: fn(homeSections) } } as StoreCustomization);

  const patchSectionAt = (id: string, fn: (s: PkSection) => PkSection) =>
    mutateHome((list) => list.map((s) => (s.id === id ? fn(s) : s)));

  const setSectionSetting = (id: string, key: string, value: unknown) =>
    patchSectionAt(id, (s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  const toggleSection = (id: string) =>
    patchSectionAt(id, (s) => ({ ...s, enabled: !s.enabled }));

  // singular section types can exist at most once — never duplicate them
  const canDuplicateSection = (s: PkSection) => !sectionDefOf(s.type).singular;

  const duplicateSection = (id: string) =>
    mutateHome((list) => {
      const i = list.findIndex((s) => s.id === id);
      if (i < 0) return list;
      const src = list[i];
      if (!canDuplicateSection(src)) return list; // Hero, features, featured products, etc.
      const clone: PkSection = {
        ...src,
        id: `sec-${Math.random().toString(36).slice(2, 10)}`,
        settings: { ...src.settings },
        blocks: src.blocks.map((b) => ({
          ...b,
          id: `blk-${Math.random().toString(36).slice(2, 10)}`,
          settings: { ...b.settings },
        })),
      };
      const next = [...list];
      next.splice(i + 1, 0, clone);
      return next;
    });

  const removeSection = (id: string) => {
    if (!confirm('Remove this section from the homepage?')) return;
    mutateHome((list) => list.filter((s) => s.id !== id));
    if (activeHomeId === id) setActiveHomeId(null);
  };

  const moveSection = (from: number, to: number) =>
    mutateHome((list) => {
      if (from === to || from < 0 || to < 0 || to >= list.length) return list;
      const next = [...list];
      const [s] = next.splice(from, 1);
      next.splice(to, 0, s);
      return next;
    });

  const resetSection = (id: string) => {
    const s = homeSections.find((x) => x.id === id);
    if (!s) return;
    if (sectionDefOf(s.type) === UNKNOWN_SECTION_DEF) return; // unsupported types cannot be regenerated
    if (!confirm('Restore this section to its default settings?')) return;
    const fresh = defaultSection(s.type);
    patchSectionAt(id, (old) => ({ ...fresh, id: old.id, enabled: old.enabled }));
  };

  const addSection = (type: PkSectionType) => {
    const fresh = defaultSection(type);
    mutateHome((list) => [...list, fresh]);
    setActiveHomeId(fresh.id);
    setAddOpen(false);
  };

  const addBlock = (sid: string) =>
    patchSectionAt(sid, (s) => ({ ...s, blocks: [...s.blocks, defaultBlock(s.type)] }));

  const duplicateBlock = (sid: string, bid: string) =>
    patchSectionAt(sid, (s) => {
      const i = s.blocks.findIndex((b) => b.id === bid);
      if (i < 0) return s;
      const src = s.blocks[i];
      const clone: PkBlock = {
        ...src,
        id: `blk-${Math.random().toString(36).slice(2, 10)}`,
        settings: { ...src.settings },
      };
      const blocks = [...s.blocks];
      blocks.splice(i + 1, 0, clone);
      return { ...s, blocks };
    });

  const removeBlock = (sid: string, bid: string) =>
    patchSectionAt(sid, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== bid) }));

  const toggleBlock = (sid: string, bid: string) =>
    patchSectionAt(sid, (s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === bid ? { ...b, enabled: !b.enabled } : b)),
    }));

  const moveBlock = (sid: string, from: number, to: number) =>
    patchSectionAt(sid, (s) => {
      const blocks = [...s.blocks];
      if (from === to || to < 0 || to >= blocks.length) return s;
      const [b] = blocks.splice(from, 1);
      blocks.splice(to, 0, b);
      return { ...s, blocks };
    });

  const setBlockSetting = (sid: string, bid: string, key: string, value: unknown) =>
    patchSectionAt(sid, (s) => ({
      ...s,
      blocks: s.blocks.map((b) =>
        b.id === bid ? { ...b, settings: { ...b.settings, [key]: value } } : b,
      ),
    }));

  const uploadHomeImage = async (sid: string, key: string, file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await apiUpload<{ url: string }>('/products/upload-image', file);
      setSectionSetting(sid, key, res.url);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  // exit with unsaved-changes guard (back to Online Store → Themes)
  const exitEditor = () => {
    if (dirty && !confirm('You have unsaved changes. Exit without saving?')) return;
    router.push('/themes');
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

  // color-scheme picker — reused by the chrome panels and every home section
  const SchemeSelect = (p: { title: string; value?: string; onChange: (id: string | undefined) => void }) => (
    <Field title={p.title}>
      <select
        value={schemes.some((s) => s.id === p.value) ? (p.value as string) : ''}
        onChange={(e) => p.onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
      >
        <option value="">Theme default</option>
        {schemes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name || s.id}
          </option>
        ))}
      </select>
    </Field>
  );

  const selectField = (title: string, value: string, options: Array<{ value: string; label: string }>, onChange: (v: string) => void) => (
    <Field title={title}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );

  // ── generic field renderers for registry-driven sections/blocks ──────────
  const renderHomeField = (s: PkSection, f: import('@pak-commerce/storefront-renderer').FieldDef) => {
    const value = (s.settings as Record<string, unknown>)[f.key];
    const setv = (v: unknown) => setSectionSetting(s.id, f.key, v);
    switch (f.type) {
      case 'text':
        return <TextField key={f.key} title={f.label} value={String(value ?? '')} placeholder={f.placeholder} onChange={setv} />;
      case 'textarea':
        return <TextField key={f.key} title={f.label} value={String(value ?? '')} placeholder={f.placeholder} area onChange={setv} />;
      case 'number':
        return (
          <Field key={f.key} title={f.label}>
            <input
              type="number"
              value={String(value ?? '')}
              onChange={(e) => setv(Number(e.target.value) || 0)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
            />
          </Field>
        );
      case 'toggle':
        return <Toggle key={f.key} title={f.label} checked={value !== false} onChange={setv} />;
      case 'scheme':
        return (
          <SchemeSelect
            key={f.key}
            title={f.label}
            value={String(value ?? '')}
            onChange={(v) => setv(v)}
          />
        );
      case 'select':
        return (
          <Field key={f.key} title={f.label}>
            <select value={String(value ?? '')} onChange={(e) => setv(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900">
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        );
      case 'image': {
        const preview = resolveImg(String(value ?? ''));
        return (
          <Field key={f.key} title={f.label}>
            <div className="flex items-center gap-2 flex-wrap">
              {preview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={preview} alt="" className="w-16 h-12 rounded-md object-cover border border-slate-200" />
              )}
              <button
                onClick={() => {
                  setUploadTarget({ id: s.id, key: f.key });
                  setTimeout(() => document.getElementById('home-image-upload')?.click(), 0);
                }}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
              >
                <Upload className="w-3.5 h-3.5 inline mr-1" /> Upload
              </button>
              {value ? (
                <button onClick={() => setv('')} className="text-xs text-red-600 hover:text-red-700">Remove</button>
              ) : null}
            </div>
          </Field>
        );
      }
      default:
        return null;
    }
  };

  const renderBlockField = (sid: string, bid: string, f: import('@pak-commerce/storefront-renderer').FieldDef, value: unknown) => {
    const setv = (v: unknown) => setBlockSetting(sid, bid, f.key, v);
    switch (f.type) {
      case 'text':
        return <TextField key={f.key} title={f.label} value={String(value ?? '')} placeholder={f.placeholder} onChange={setv} />;
      case 'textarea':
        return <TextField key={f.key} title={f.label} value={String(value ?? '')} placeholder={f.placeholder} area onChange={setv} />;
      case 'number':
        return (
          <Field key={f.key} title={f.label}>
            <input type="number" value={String(value ?? '')} onChange={(e) => setv(Number(e.target.value) || 0)} className="w-24 rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900" />
          </Field>
        );
      case 'toggle':
        return <Toggle key={f.key} title={f.label} checked={value !== false} onChange={setv} />;
      default:
        return null;
    }
  };

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
      <input
        type="file"
        accept="image/*"
        hidden
        id="home-image-upload"
        onChange={(e) => {
          if (uploadTarget) uploadHomeImage(uploadTarget.id, uploadTarget.key, e.target.files?.[0]);
          setUploadTarget(null);
          e.target.value = '';
        }}
      />
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
            <span className="text-[13px] font-semibold truncate">{theme.name}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                theme.status === 'PUBLISHED' ? 'bg-[#95bf47] text-[#1a1a1a]' : 'bg-white/10 text-white/60'
              }`}
            >
              {theme.status === 'PUBLISHED' ? 'Live' : 'Draft'}
            </span>
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
                        className={`group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-200 hover:-translate-x-0.5 ${
                          open ? 'bg-slate-100 shadow-sm' : 'hover:bg-slate-50'
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

                          {/* ---- COLORS (five Shopify-style schemes) ---- */}
                          {key === 'theme' && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-400 leading-snug">
                                Five independent color schemes. Each storefront part can pick its own —
                                set it on the announcement bar, header, hero, footer and on every
                                home section. All nine colors of a scheme are editable.
                              </p>
                              {schemes.map((s, i) => {
                                const expanded = openScheme === s.id;
                                return (
                                  <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => setOpenScheme(expanded ? null : s.id)}
                                      aria-expanded={expanded}
                                      className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 text-left transition"
                                    >
                                      <span aria-hidden className="flex rounded-md overflow-hidden border border-slate-200 shrink-0">
                                        {(['background', 'text', 'button', 'secondaryButton', 'accent'] as const).map((k) => (
                                          <span key={k} className="w-4 h-6" style={{ backgroundColor: s.colors[k] }} />
                                        ))}
                                      </span>
                                      <span className="text-[12px] font-semibold text-slate-800 flex-1 min-w-0 truncate">
                                        {s.name || s.id}
                                      </span>
                                      <ChevronRight
                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                                      />
                                    </button>
                                    {expanded && (
                                      <div className="px-2.5 pb-3 pt-2 space-y-2 border-t border-slate-100">
                                        <input
                                          value={s.name}
                                          onChange={(e) => renameScheme(i, e.target.value)}
                                          placeholder="Scheme name"
                                          className="w-full rounded-lg border border-slate-300 px-2.5 py-[7px] text-[12px] font-semibold outline-none focus:border-slate-900"
                                        />
                                        {SCHEME_COLOR_FIELDS.map(({ key: ck, label }) => (
                                          <HexColorRow
                                            key={ck}
                                            label={label}
                                            value={s.colors[ck]}
                                            onChange={(v) => patchSchemeColors(i, { [ck]: v } as Partial<ColorSchemeColors>)}
                                          />
                                        ))}
                                        <button
                                          onClick={() => resetScheme(i)}
                                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                                        >
                                          <RotateCcw className="w-3 h-3" /> Reset scheme
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* ---- THEME SETTINGS (design tokens) ---- */}
                          {key === 'design' && cfg.style && (
                            <>
                              <p className="text-[10px] text-slate-400 leading-snug">
                                Structural theme settings — fonts, shapes and layouts. Combined with
                                the color schemes and section order, this is what makes each theme
                                look unique.
                              </p>
                              {selectField('Heading font', String(cfg.style.headingFont ?? 'system'), FONT_CHOICES, (v) => setStyle('headingFont', v))}
                              {selectField('Body font', String(cfg.style.bodyFont ?? 'system'), FONT_CHOICES, (v) => setStyle('bodyFont', v))}
                              <Field title="Corner radius">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={40}
                                    value={String(cfg.style.radius ?? 12)}
                                    onChange={(e) => setStyle('radius', Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
                                    className="w-24 rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                                  />
                                  <span className="text-[11px] text-slate-400">px</span>
                                </div>
                              </Field>
                              {selectField('Button shape', String(cfg.style.buttonShape ?? 'rounded'), [
                                { value: 'pill', label: 'Pill' },
                                { value: 'rounded', label: 'Rounded' },
                                { value: 'square', label: 'Square' },
                              ], (v) => setStyle('buttonShape', v))}
                              {selectField('Card style', String(cfg.style.cardStyle ?? 'shadow'), [
                                { value: 'shadow', label: 'Shadow' },
                                { value: 'border', label: 'Outline' },
                                { value: 'flat', label: 'Flat' },
                              ], (v) => setStyle('cardStyle', v))}
                              {selectField('Hero layout', String(cfg.style.heroVariant ?? 'split'), [
                                { value: 'split', label: 'Split (image beside text)' },
                                { value: 'overlay', label: 'Overlay (text on image)' },
                                { value: 'minimal', label: 'Minimal (centered text)' },
                                { value: 'banner', label: 'Banner (wide image above)' },
                                { value: 'editorial', label: 'Editorial (magazine)' },
                              ], (v) => setStyle('heroVariant', v))}
                              {selectField('Feature highlights layout', String(cfg.style.featuresVariant ?? 'row'), [
                                { value: 'row', label: 'Row strip' },
                                { value: 'cards', label: 'Cards' },
                                { value: 'pill', label: 'Pills' },
                              ], (v) => setStyle('featuresVariant', v))}
                              {selectField('Header layout', String(cfg.style.headerLayout ?? 'classic'), [
                                { value: 'classic', label: 'Classic (logo + menu in line)' },
                                { value: 'centered', label: 'Centered (menu below logo)' },
                              ], (v) => setStyle('headerLayout', v))}
                              {selectField('Footer layout', String(cfg.style.footerLayout ?? 'classic'), [
                                { value: 'classic', label: 'Classic (four columns)' },
                                { value: 'compact', label: 'Compact (centered, one column)' },
                              ], (v) => setStyle('footerLayout', v))}
                              {selectField('Section spacing', String(cfg.style.spacing ?? 'normal'), [
                                { value: 'compact', label: 'Compact' },
                                { value: 'normal', label: 'Normal' },
                                { value: 'roomy', label: 'Roomy' },
                              ], (v) => setStyle('spacing', v))}
                              <Toggle
                                title="Uppercase headings"
                                checked={cfg.style.uppercaseHeadings === true}
                                onChange={(v) => setStyle('uppercaseHeadings', v)}
                              />
                            </>
                          )}

                          {/* ---- ANNOUNCEMENT ---- */}
                          {key === 'announcement' && (
                            <>
                              <TextField title="Text" value={cfg.announcement.text || ''} onChange={(v) => set('announcement', 'text', v)} />
                              <SchemeSelect title="Color scheme" value={cfg.announcement.schemeId} onChange={(v) => set('announcement', 'schemeId', v)} />
                            </>
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
                              <SchemeSelect title="Color scheme" value={cfg.hero.schemeId} onChange={(v) => set('hero', 'schemeId', v)} />
                            </>
                          )}

                          {/* ---- HOME SECTIONS (add / remove / duplicate / reorder / blocks) ---- */}
                          {key === 'home' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-medium text-slate-400">Drag to reorder · click to edit</p>
                                <div className="relative">
                                  <button
                                    onClick={() => setAddOpen((v) => !v)}
                                    className="flex items-center gap-1 text-[11px] font-bold text-slate-700 border border-slate-300 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition"
                                  >
                                    <Layers className="w-3.5 h-3.5" /> Add section
                                  </button>
                                  {addOpen && (
                                    <div className="absolute right-0 z-20 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 max-h-80 overflow-y-auto">
                                      {ADDABLE_SECTIONS.map((t) => {
                                        const def = sectionDefOf(t);
                                        const used = def.singular && homeSections.some((s) => s.type === t);
                                        return (
                                          <button
                                            key={t}
                                            disabled={used}
                                            onClick={() => addSection(t)}
                                            className={`w-full text-left px-2.5 py-2 rounded-lg transition ${used ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                                          >
                                            <span className="block text-[12px] font-semibold text-slate-800">
                                              {def.label}
                                              {used && <span className="text-[9px] font-bold text-slate-400 uppercase ml-1.5 align-middle">Added</span>}
                                            </span>
                                            <span className="block text-[10px] text-slate-500 leading-snug mt-0.5">{def.description}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {homeSections.length === 0 && (
                                <p className="text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-lg p-4 text-center">
                                  No sections yet — add your first one.
                                </p>
                              )}

                              {homeSections.map((s, i) => {
                                const def = sectionDefOf(s.type);
                                const open = activeHomeId === s.id;
                                return (
                                  <div
                                    key={s.id}
                                    draggable
                                    onDragStart={() => setDragHomeIndex(i)}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setDropHomeIndex(i);
                                    }}
                                    onDrop={() => {
                                      if (dragHomeIndex !== null) moveSection(dragHomeIndex, i);
                                      setDragHomeIndex(null);
                                      setDropHomeIndex(null);
                                    }}
                                    onDragEnd={() => {
                                      setDragHomeIndex(null);
                                      setDropHomeIndex(null);
                                    }}
                                    className={`group rounded-xl border bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 ${
                                      open ? 'border-slate-900 ring-1 ring-slate-900/10' : 'border-slate-200'
                                    } ${dropHomeIndex === i && dragHomeIndex !== i ? 'border-t-2 border-t-slate-900' : ''}`}
                                  >
                                    <div className="flex items-center gap-1 px-2 py-1.5">
                                      <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />
                                      <button
                                        onClick={() => setActiveHomeId(open ? null : s.id)}
                                        aria-expanded={open}
                                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-1"
                                      >
                                        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
                                        <span className="text-[12px] font-semibold text-slate-800 truncate">{def.label}</span>
                                        {!s.enabled && <span className="text-[9px] font-bold uppercase text-slate-400">Hidden</span>}
                                      </button>
                                      <button onClick={() => toggleSection(s.id)} title={s.enabled ? 'Hide section' : 'Show section'} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                                        {s.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                      </button>
                                      <button
                                        onClick={() => moveSection(i, i - 1)}
                                        disabled={i === 0}
                                        title="Move up"
                                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                      >
                                        <ChevronUp className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => moveSection(i, i + 1)}
                                        disabled={i === homeSections.length - 1}
                                        title="Move down"
                                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                      >
                                        <ChevronDown className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => duplicateSection(s.id)}
                                        disabled={!canDuplicateSection(s)}
                                        title={
                                          canDuplicateSection(s)
                                            ? 'Duplicate section'
                                            : `${def.label} is a single-instance section and cannot be duplicated`
                                        }
                                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                      {def !== UNKNOWN_SECTION_DEF && (
                                        <button onClick={() => resetSection(s.id)} title="Restore default settings" className="p-1 rounded hover:bg-slate-100 text-slate-500">
                                          <RotateCcw className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button onClick={() => removeSection(s.id)} title="Remove section" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {open && (
                                      <div className="px-3 pb-3 pt-2 border-t border-slate-100 space-y-3">
                                        {def !== UNKNOWN_SECTION_DEF && (
                                          <SchemeSelect
                                            title="Color scheme"
                                            value={String((s.settings as Record<string, unknown>).schemeId ?? '')}
                                            onChange={(v) => setSectionSetting(s.id, 'schemeId', v)}
                                          />
                                        )}
                                        {def.settings.length === 0 && (
                                          <p className="text-[10px] text-slate-400 leading-snug">
                                            Content for this section is edited in its own panel (see “Hero” / the featured-product fields below).
                                          </p>
                                        )}
                                        {def.settings.map((f) => renderHomeField(s, f))}
                                        {s.type === 'features' && (
                                          <Toggle title="Feature highlights strip" checked={cfg.sections.showFeatures !== false} onChange={(v) => setLegacySection('showFeatures', v)} />
                                        )}
                                        {s.type === 'featuredProducts' && (
                                          <>
                                            <Field title="Featured products shown">
                                              <input
                                                value={String(cfg.sections.featuredCount ?? 8)}
                                                onChange={(e) => setLegacySection('featuredCount', Number(e.target.value.replace(/\D/g, '')) || 8)}
                                                className="w-20 rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900"
                                              />
                                            </Field>
                                            <TextField title="Home blurb (optional)" value={cfg.sections.aboutBlurb || ''} onChange={(v) => setLegacySection('aboutBlurb', v)} />
                                          </>
                                        )}

                                        {def.block && (
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <p className="text-[11px] font-medium text-slate-500">
                                                {def.block.label}s ({s.blocks.filter((b) => b.enabled).length}/{s.blocks.length} visible)
                                              </p>
                                              <button onClick={() => addBlock(s.id)} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1">
                                                <Plus className="w-3.5 h-3.5" /> Add {def.block.singularLabel}
                                              </button>
                                            </div>
                                            {s.blocks.map((b, bi) => (
                                              <div key={b.id} className="rounded-lg border border-slate-200 overflow-hidden">
                                                <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50">
                                                  <span className="text-[9px] font-mono text-slate-400 w-4 text-center">{bi + 1}</span>
                                                  <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">
                                                    {String(b.settings.question || b.settings.title || `${def.block!.singularLabel} ${bi + 1}`)}
                                                  </span>
                                                  <button onClick={() => moveBlock(s.id, bi, bi - 1)} disabled={bi === 0} title="Move up" className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30">
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button onClick={() => moveBlock(s.id, bi, bi + 1)} disabled={bi === s.blocks.length - 1} title="Move down" className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30">
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button onClick={() => toggleBlock(s.id, b.id)} title={b.enabled ? 'Hide question' : 'Show question'} className="p-1 rounded hover:bg-slate-200 text-slate-400">
                                                    {b.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                  </button>
                                                  <button onClick={() => duplicateBlock(s.id, b.id)} title="Duplicate question" className="p-1 rounded hover:bg-slate-200 text-slate-400">
                                                    <Copy className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button onClick={() => removeBlock(s.id, b.id)} title="Remove question" className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                                <div className="px-2 py-2 space-y-2 border-t border-slate-100">
                                                  {def.block.fields.map((f) => renderBlockField(s.id, b.id, f, (b.settings as Record<string, unknown>)[f.key]))}
                                                </div>
                                              </div>
                                            ))}
                                            {s.blocks.length === 0 && (
                                              <p className="text-[11px] text-slate-400 text-center py-2 border border-dashed border-slate-200 rounded-lg">
                                                No {def.block.singularLabel}s yet.
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* ---- HEADER MENU ---- */}
                          {key === 'header' && (
                            <>
                              <SchemeSelect title="Color scheme" value={cfg.header.schemeId} onChange={(v) => set('header', 'schemeId', v)} />
                              <Toggle title="Sticky header" checked={cfg.header.sticky !== false} onChange={(v) => set('header', 'sticky', v)} />
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
                            </>
                          )}

                          {/* ---- FOOTER ---- */}
                          {key === 'footer' && (
                            <>
                              <SchemeSelect title="Color scheme" value={cfg.footer.schemeId} onChange={(v) => set('footer', 'schemeId', v)} />
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
                              <div className="pt-2 mt-1 border-t border-slate-100">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Blog listing</p>
                              </div>
                              <TextField title="Blog SEO title" value={cfg.seo.blogTitle || ''} onChange={(v) => set('seo', 'blogTitle', v)} />
                              <TextField title="Blog meta description" value={cfg.seo.blogDescription || ''} onChange={(v) => set('seo', 'blogDescription', v)} area />
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
              onLoad={() => {
                sendPreview();
                postSelection();
              }}
              className="w-full h-full border-0 block"
            />
          </div>
        </section>
      </div>

      {/* ── pages modal removed: Online Store scope is Themes only (Shopify-style) ── */}
    </div>
  );
}

// useSearchParams requires a Suspense boundary at build time (Next.js App Router).
export default function ThemeEditor() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-[#ececee] text-slate-400 text-[13px]">
          Loading theme editor…
        </div>
      }
    >
      <ThemeEditorInner />
    </Suspense>
  );
}
