'use client';

// ---------------------------------------------------------------------------
// Online store → Themes — follows Shopify's Themes page:
//   • "Current theme" — large preview, Live badge, Customize, ⋯ actions,
//     and a Preview store button.
//   • "Theme library" — draft themes with an "Add theme" menu
//     (Upload zip file) and a ⋯ actions menu per theme (Preview,
//     Customize, Publish, Duplicate, Rename, Version history, Delete).
// Thumbnails are mini store previews rendered from each theme's real
// colors and hero copy (the design-only config) — the same data the
// storefront renders.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  Eye,
  Check,
  Copy,
  Trash2,
  Pencil,
  Loader2,
  History,
  X,
  Palette,
  ExternalLink,
  PackageCheck,
  AlertCircle,
  MoreVertical,
  ChevronDown,
  Paintbrush,
} from 'lucide-react';
import { api, apiUpload, getApiBase } from '@/lib/api';
import { PREVIEW_MESSAGE_TYPE, mergeStoreConfig, DEFAULT_CUSTOMIZATION } from '@pak-commerce/storefront-renderer';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';
const PREVIEW_ORIGIN = (() => {
  try {
    return new URL(STOREFRONT_URL).origin;
  } catch {
    return null;
  }
})();

type SchemeMini = { bg?: string; text?: string; heading?: string; button?: string; buttonText?: string };

type ThemePreview = {
  primary?: string;
  accent?: string;
  heroTitle?: string;
  /** compact paint map for the five color schemes (see themes.service previewOf) */
  schemes?: SchemeMini[];
};

type ThemeRow = {
  id: string;
  name: string;
  status: 'PUBLISHED' | 'UNPUBLISHED';
  source: string;
  basedOnThemeId: string | null;
  versionCount: number;
  latestVersion: number;
  assetCount: number;
  preview?: ThemePreview;
  createdAt: string;
  updatedAt: string;
};

type VersionRow = { versionNumber: number; label: string | null; createdAt: string };

const chipLive = 'inline-flex items-center gap-1 bg-[#95bf47] text-[#1a1a1a] text-[10px] font-black px-1.5 py-0.5 rounded';
const chipDraft = 'inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded';
const btnPrimary =
  'inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg transition disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-[12px] font-semibold px-3 py-2 rounded-lg transition';
const menuItem =
  'w-full flex items-center gap-2 px-2.5 py-2 text-[12px] text-slate-700 hover:bg-slate-50 rounded-lg text-left transition';

/** Mini store preview built from the theme's real color schemes / hero copy. */
function ThemeThumbnail({ t, large }: { t: ThemeRow; large?: boolean }) {
  const p = t.preview ?? {};
  const primary = p.primary || '#059669';
  const accent = p.accent || '#0d9488';
  const title = p.heroTitle || t.name;
  const schemes = Array.isArray(p.schemes) ? p.schemes : [];
  const annBg = schemes[0]?.bg ?? primary;
  const annText = schemes[0]?.text ?? '#ffffff';
  const heroBg = schemes[2]?.bg ?? '#f9fafb';
  const heroText = schemes[2]?.heading ?? schemes[2]?.text ?? '#111827';
  const btnBg = schemes[2]?.button ?? accent;
  const btnText = schemes[2]?.buttonText ?? '#ffffff';
  const footerBg = schemes[4]?.bg ?? '#111827';
  const footerText = schemes[4]?.text ?? '#f1f5f9';
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-white select-none" aria-hidden>
      {/* browser chrome */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 border-b border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <span className="ml-1.5 h-1.5 flex-1 rounded-full bg-slate-200" />
      </div>
      {/* announcement bar (scheme 1) */}
      <div
        className="px-2 py-[3px] text-center text-[7px] font-bold truncate"
        style={{ backgroundColor: annBg, color: annText }}
      >
        Free nationwide delivery · Cash on Delivery
      </div>
      {/* header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100">
        <span className="text-[8px] font-black tracking-wide" style={{ color: heroText }}>
          STORE
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-[3px] rounded-full bg-slate-200" />
          <span className="w-4 h-[3px] rounded-full bg-slate-200" />
          <span className="w-4 h-[3px] rounded-full bg-slate-200" />
        </span>
      </div>
      {/* hero (scheme 3's palette) */}
      <div
        className={`text-center border-b border-slate-100 ${large ? 'px-6 py-9' : 'px-3 py-4'}`}
        style={{ backgroundColor: heroBg }}
      >
        <span className="mx-auto block h-1 w-8 rounded-full" style={{ backgroundColor: btnBg }} />
        <p
          className={`mt-2 font-black leading-tight ${large ? 'text-[15px]' : 'text-[9px] line-clamp-2'}`}
          style={{ color: heroText }}
        >
          {title}
        </p>
        <span
          className={`mt-2.5 inline-block rounded font-bold ${large ? 'px-3 py-1 text-[9px]' : 'px-2 py-0.5 text-[7px]'}`}
          style={{ backgroundColor: btnBg, color: btnText }}
        >
          Shop now
        </span>
      </div>
      {/* product grid */}
      <div className="grid grid-cols-4 gap-1.5 px-2.5 py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-square rounded-sm bg-slate-100 relative overflow-hidden">
            <span
              className="absolute inset-x-0 bottom-0 h-1"
              style={{ backgroundColor: i % 2 === 0 ? btnBg : annBg, opacity: 0.7 }}
            />
          </div>
        ))}
      </div>
      {/* footer (scheme 5) */}
      <div className="h-5 flex items-center justify-center" style={{ backgroundColor: footerBg }}>
        <span className="text-[6px]" style={{ color: footerText }}>© {new Date().getFullYear()} your store</span>
      </div>
    </div>
  );
}

/** ⋯ dropdown — closes on outside click via a fixed backdrop. */
function ActionsMenu({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-2 rounded-lg border border-slate-300 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); onToggle(); }} />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [storageEnabled, setStorageEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<ThemeRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [previewTheme, setPreviewTheme] = useState<ThemeRow | null>(null);
  const [previewConfig, setPreviewConfig] = useState<string>('{}');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [versionsFor, setVersionsFor] = useState<ThemeRow | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ storageEnabled: boolean; themes: ThemeRow[] }>('/themes');
      setThemes(Array.isArray(res.themes) ? res.themes : []);
      setStorageEnabled(res.storageEnabled ?? null);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // close open menus on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setAddMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const published = themes.find((t) => t.status === 'PUBLISHED');
  const drafts = themes.filter((t) => t.status !== 'PUBLISHED');

  const doPublish = async (t: ThemeRow) => {
    setBusy(t.id);
    setError(null);
    setOpenMenu(null);
    try {
      await api('/themes/publish', { method: 'POST', body: { id: t.id } });
      flash(`“${t.name}” is now live`);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Publish failed');
    } finally {
      setBusy(null);
    }
  };

  const doDuplicate = async (t: ThemeRow) => {
    setBusy(t.id);
    setOpenMenu(null);
    try {
      const res = await api<{ name: string }>('/themes/duplicate', { method: 'POST', body: { id: t.id } });
      flash(`Duplicated as “${res.name}”`);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Duplicate failed');
    } finally {
      setBusy(null);
    }
  };

  const startRename = (t: ThemeRow) => {
    setOpenMenu(null);
    setRenameTarget(t);
    setRenameValue(t.name);
  };

  const doRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (name.length < 2) return;
    setBusy(renameTarget.id);
    try {
      await api('/themes/rename', { method: 'POST', body: { id: renameTarget.id, name } });
      setRenameTarget(null);
      flash('Theme renamed');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Rename failed');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (t: ThemeRow) => {
    setOpenMenu(null);
    if (!confirm(`Delete “${t.name}”? This cannot be undone.`)) return;
    setBusy(t.id);
    try {
      await api(`/themes/${t.id}`, { method: 'DELETE' });
      flash('Theme deleted');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy('__import__');
    setImportErrors([]);
    setError(null);
    try {
      const res = await apiUpload<{ installed: boolean; name: string; assets: number; warnings?: string[] }>(
        '/themes/import',
        file,
      );
      flash(`Theme “${res.name}” installed${res.assets ? ` (${res.assets} asset${res.assets === 1 ? '' : 's'})` : ''}`);
      await load();
    } catch (e: any) {
      // Server returns { message, errors: [...] } on validation failure
      const raw = (e as any)?.raw;
      let errs: string[] = Array.isArray(raw?.errors) ? raw.errors : [];
      if (errs.length === 0) {
        try {
          const parsed = JSON.parse(e?.detail ?? '{}');
          if (Array.isArray(parsed?.errors)) errs = parsed.errors;
        } catch {
          /* keep raw */
        }
      }
      setImportErrors(errs.length ? errs : [e?.detail || e?.message || 'Import failed']);
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async (t: ThemeRow) => {
    setPreviewLoading(true);
    setPreviewTheme(t);
    setOpenMenu(null);
    setError(null);
    try {
      const res = await api<{ configJson: string }>(`/themes/${t.id}`);
      setPreviewConfig(res.configJson || '{}');
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load theme for preview');
      setPreviewTheme(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const pushPreviewConfig = useCallback(() => {
    if (!PREVIEW_ORIGIN) return;
    let cfg: unknown = null;
    try {
      cfg = mergeStoreConfig(DEFAULT_CUSTOMIZATION, JSON.parse(previewConfig));
    } catch {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE_TYPE, config: cfg }, PREVIEW_ORIGIN);
  }, [previewConfig]);

  const openVersions = async (t: ThemeRow) => {
    setOpenMenu(null);
    setVersionsFor(t);
    setVersionsLoading(true);
    setVersions([]);
    try {
      const res = await api<VersionRow[]>(`/themes/${t.id}/versions`);
      setVersions(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load versions');
    } finally {
      setVersionsLoading(false);
    }
  };

  const doSnapshot = async (t: ThemeRow) => {
    setBusy(t.id);
    try {
      const res = await api<{ versionNumber: number }>(`/themes/${t.id}/versions`, {
        method: 'POST',
        body: { label: 'Manual snapshot' },
      });
      flash(`Snapshot saved as v${res.versionNumber}`);
      await openVersions(t);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Snapshot failed');
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async (t: ThemeRow, v: number, publish: boolean) => {
    setBusy(t.id);
    try {
      await api(`/themes/${t.id}/versions/${v}/restore`, { method: 'POST', body: { publish } });
      flash(`Restored v${v}${publish ? ' and published' : ''}`);
      setVersionsFor(null);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Restore failed');
    } finally {
      setBusy(null);
    }
  };

  const customizeHref = (t: ThemeRow) => `/customize?theme=${encodeURIComponent(t.id)}`;

  const cardMenu = (t: ThemeRow) => {
    const isLive = t.status === 'PUBLISHED';
    const busyId = busy === t.id;
    return (
      <>
        <Link href={customizeHref(t)} role="menuitem" className={menuItem} onClick={() => setOpenMenu(null)}>
          <Paintbrush className="w-3.5 h-3.5 text-slate-400" /> Customize
        </Link>
        <button role="menuitem" className={menuItem} onClick={() => openPreview(t)}>
          <Eye className="w-3.5 h-3.5 text-slate-400" /> Preview
        </button>
        {!isLive && (
          <button role="menuitem" className={menuItem} disabled={busyId} onClick={() => doPublish(t)}>
            {busyId ? (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 text-slate-400" />
            )}
            Publish
          </button>
        )}
        <button role="menuitem" className={menuItem} disabled={busyId} onClick={() => doDuplicate(t)}>
          <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate
        </button>
        <button role="menuitem" className={menuItem} onClick={() => startRename(t)}>
          <Pencil className="w-3.5 h-3.5 text-slate-400" /> Rename
        </button>
        <button role="menuitem" className={menuItem} onClick={() => openVersions(t)}>
          <History className="w-3.5 h-3.5 text-slate-400" /> Version history
        </button>
        <div className="my-1 border-t border-slate-100" />
        <button
          role="menuitem"
          className={`${menuItem} text-red-600 hover:bg-red-50 disabled:opacity-40`}
          disabled={busyId || isLive}
          title={isLive ? 'Publish another theme before deleting' : 'Delete theme'}
          onClick={() => doDelete(t)}
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </>
    );
  };

  return (
    <div className="space-y-7">
      {storageEnabled === false && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> R2 asset storage not configured — ZIP themes with assets are rejected
        </p>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-4 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1 whitespace-pre-line">{error}</span>
          <button onClick={() => setError(null)} className="underline font-semibold shrink-0">
            Dismiss
          </button>
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-[12px] px-4 py-2.5">
          <p className="font-bold mb-1">Theme validation failed — nothing was installed:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {importErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <button onClick={() => setImportErrors([])} className="mt-2 underline font-semibold">
            Dismiss
          </button>
        </div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] px-4 py-2 flex items-center gap-2">
          <PackageCheck className="w-4 h-4" /> {toast}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading themes…
        </div>
      ) : (
        <>
          {/* ── Current theme ─────────────────────────────────────────── */}
          {published && (
            <section aria-labelledby="current-theme-heading">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <h2 id="current-theme-heading" className="text-[15px] font-bold text-slate-900">
                  Current theme
                </h2>
                <a
                  href={STOREFRONT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={btnSecondary}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview store
                </a>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid lg:grid-cols-[minmax(0,400px)_1fr]">
                  <div className="p-4 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200">
                    <ThemeThumbnail t={published} large />
                  </div>
                  <div className="p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[17px] font-bold text-slate-900 truncate">{published.name}</h3>
                          <span className={chipLive}>Live</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Last updated {new Date(published.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                          v{published.latestVersion} · {published.versionCount} version{published.versionCount === 1 ? '' : 's'}
                        </p>
                        <p className="text-[12px] text-slate-500 mt-2.5 leading-relaxed">
                          This theme is live on your storefront. Customize it to change your store&apos;s design —
                          changes to the live theme apply as soon as you save.
                        </p>
                      </div>
                      <ActionsMenu
                        open={openMenu === published.id}
                        onToggle={() => setOpenMenu(openMenu === published.id ? null : published.id)}
                      >
                        {cardMenu(published)}
                      </ActionsMenu>
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-4">
                      <Link href={customizeHref(published)} className={btnPrimary}>
                        <Paintbrush className="w-3.5 h-3.5" /> Customize
                      </Link>
                      <button onClick={() => openPreview(published)} className={btnSecondary}>
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Theme library ────────────────────────────────────────── */}
          <section aria-labelledby="theme-library-heading">
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h2 id="theme-library-heading" className="text-[15px] font-bold text-slate-900">
                  Theme library
                </h2>
                <span className="text-[11px] text-slate-400">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setAddMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg transition"
                >
                  Add theme <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {addMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 z-40 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5"
                    >
                      <button
                        className={menuItem}
                        onClick={() => {
                          setAddMenuOpen(false);
                          fileInput.current?.click();
                        }}
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-400" /> Upload zip file
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {drafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
                <Palette className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="mt-2.5 text-[13px] font-semibold text-slate-600">No draft themes yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Upload a zip file or use ⋯ on a theme to duplicate and experiment safely.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {drafts.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col"
                  >
                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                      <ThemeThumbnail t={t} />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[13px] font-bold text-slate-900 truncate">{t.name}</h3>
                            <span className={chipDraft}>Draft</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {t.source === 'SYSTEM_LIBRARY'
                              ? 'Theme library'
                              : t.source === 'UPLOAD'
                                ? 'Uploaded ZIP'
                                : t.source === 'DUPLICATE'
                                  ? 'Duplicated'
                                  : 'Auto-created'}{' '}
                            · Updated {new Date(t.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <ActionsMenu
                          open={openMenu === t.id}
                          onToggle={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                        >
                          {cardMenu(t)}
                        </ActionsMenu>
                      </div>
                      <div className="flex items-center gap-2 mt-4 pt-1">
                        <Link href={customizeHref(t)} className={btnPrimary}>
                          <Paintbrush className="w-3.5 h-3.5" /> Customize
                        </Link>
                        <button onClick={() => doPublish(t)} disabled={busy === t.id} className={btnSecondary}>
                          {busy === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Publish
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          doImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* ── preview modal (renders the theme on the real storefront renderer) ── */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex flex-col">
          <div className="flex items-center justify-between px-4 h-12 bg-[#1a1a1a] text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-[13px] font-semibold truncate">Preview: {previewTheme.name}</p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  previewTheme.status === 'PUBLISHED' ? 'bg-[#95bf47] text-[#1a1a1a]' : 'bg-white/10 text-white/60'
                }`}
              >
                {previewTheme.status === 'PUBLISHED' ? 'Live' : 'Draft'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {previewTheme.status !== 'PUBLISHED' && (
                <button
                  onClick={() => {
                    doPublish(previewTheme);
                    setPreviewTheme(null);
                  }}
                  className="flex items-center gap-1.5 bg-[#95bf47] hover:bg-[#83a83c] text-[#1a1a1a] text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                >
                  <Check className="w-3.5 h-3.5" /> Publish this theme
                </button>
              )}
              <Link
                href={customizeHref(previewTheme)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
              >
                <Paintbrush className="w-3.5 h-3.5" /> Customize
              </Link>
              <button
                onClick={() => setPreviewTheme(null)}
                title="Close preview"
                className="p-1.5 rounded hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4">
            {previewLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-white/70" />
            ) : (
              <iframe
                ref={iframeRef}
                src={`${STOREFRONT_URL}/?preview=1`}
                onLoad={pushPreviewConfig}
                title="Theme preview"
                className="w-full max-w-[1200px] h-full bg-white rounded-xl shadow-2xl border-0"
              />
            )}
          </div>
        </div>
      )}

      {/* ── rename modal ── */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setRenameTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-5">
            <h3 className="font-semibold text-slate-900 text-[14px]">Rename theme</h3>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRename()}
              autoFocus
              maxLength={80}
              className="w-full mt-3 rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRenameTarget(null)} className={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={doRename}
                disabled={renameValue.trim().length < 2 || busy === renameTarget.id}
                className={btnPrimary}
              >
                {busy === renameTarget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── versions drawer ── */}
      {versionsFor && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setVersionsFor(null)} />
          <aside className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-900">Version history — {versionsFor.name}</p>
              <button onClick={() => setVersionsFor(null)} title="Close" className="p-1.5 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-between gap-2 border-b border-slate-100">
              <p className="text-[11px] text-slate-500">
                Restore an earlier design. Restoring creates a new version — history is never rewritten.
              </p>
              <button
                onClick={() => doSnapshot(versionsFor)}
                disabled={busy === versionsFor.id}
                className="shrink-0 flex items-center gap-1 border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-semibold hover:bg-slate-50"
              >
                {busy === versionsFor.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}{' '}
                Save version
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versionsLoading ? (
                <div className="py-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-10">No versions yet.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.versionNumber} className="border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-700 text-[12px] font-black flex items-center justify-center">
                      v{v.versionNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{v.label || 'Snapshot'}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(v.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => doRestore(versionsFor, v.versionNumber, false)}
                        disabled={busy === versionsFor.id}
                        className="text-[10px] font-bold border border-slate-300 rounded-md px-2 py-1 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => doRestore(versionsFor, v.versionNumber, true)}
                        disabled={busy === versionsFor.id}
                        className="text-[10px] font-bold bg-slate-900 text-white rounded-md px-2 py-1 hover:bg-slate-800"
                      >
                        Restore &amp; publish
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
