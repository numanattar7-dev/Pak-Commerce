'use client';

// ---------------------------------------------------------------------------
// Themes — manage the theme library: preview, publish, duplicate, rename,
// delete, import ZIP, and view/restore version history.
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
  Store,
  ShieldCheck,
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

type ThemeRow = {
  id: string;
  name: string;
  status: 'PUBLISHED' | 'UNPUBLISHED';
  source: string;
  basedOnThemeId: string | null;
  versionCount: number;
  latestVersion: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

type VersionRow = { versionNumber: number; label: string | null; createdAt: string };

const GRADIENTS = [
  'from-emerald-700 via-emerald-600 to-teal-500',
  'from-slate-800 via-slate-700 to-slate-500',
  'from-amber-700 via-orange-600 to-red-600',
  'from-indigo-800 via-violet-700 to-purple-600',
  'from-rose-800 via-pink-700 to-fuchsia-600',
  'from-cyan-800 via-sky-700 to-blue-600',
];

function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [storageEnabled, setStorageEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [previewTheme, setPreviewTheme] = useState<ThemeRow | null>(null);
  const [previewConfig, setPreviewConfig] = useState<string>('{}');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [versionsFor, setVersionsFor] = useState<ThemeRow | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

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

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const published = themes.find((t) => t.status === 'PUBLISHED');
  const others = themes.filter((t) => t.id !== published?.id);

  const doPublish = async (t: ThemeRow) => {
    setBusy(t.id);
    setError(null);
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

  const doUnpublish = async (t: ThemeRow) => {
    setBusy(t.id);
    try {
      await api('/themes/unpublish', { method: 'POST', body: { id: t.id } });
      flash(`“${t.name}” unpublished — storefront keeps the last live design`);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Unpublish failed');
    } finally {
      setBusy(null);
    }
  };

  const doDuplicate = async (t: ThemeRow) => {
    setBusy(t.id);
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
    setRenameId(t.id);
    setRenameValue(t.name);
  };

  const doRename = async (t: ThemeRow) => {
    const name = renameValue.trim();
    if (name.length < 2) return;
    setBusy(t.id);
    try {
      await api('/themes/rename', { method: 'POST', body: { id: t.id, name } });
      setRenameId(null);
      flash('Renamed');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Rename failed');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (t: ThemeRow) => {
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

  const ThemeCard = ({ t, big }: { t: ThemeRow; big?: boolean }) => {
    const busyId = busy === t.id;
    return (
      <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${big ? '' : 'flex flex-col'}`}>
        <div className={`relative bg-gradient-to-br ${gradientFor(t.id)} ${big ? 'h-36' : 'h-24'} flex items-end p-3`}>
          {t.status === 'PUBLISHED' && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-[#95bf47] text-[#1a1a1a] text-[10px] font-black px-2 py-1 rounded">
              <ShieldCheck className="w-3 h-3" /> PUBLISHED
            </span>
          )}
          <span className="absolute top-2 right-2 text-[10px] font-mono text-white/70">v{t.latestVersion}</span>
          <p className="text-white font-black text-sm truncate">{t.name}</p>
        </div>
        <div className="p-3 flex-1 flex flex-col gap-2">
          <p className="text-[10px] text-slate-400">
            {t.source === 'SYSTEM' ? 'Auto-created' : t.source === 'UPLOAD' ? 'Uploaded ZIP' : 'Duplicated'} ·{' '}
            {t.versionCount} version{t.versionCount === 1 ? '' : 's'} ·{' '}
            {new Date(t.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </p>
          {renameId === t.id ? (
            <div className="flex items-center gap-1.5">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doRename(t)}
                autoFocus
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] outline-none focus:border-slate-900"
              />
              <button onClick={() => doRename(t)} className="p-1.5 rounded bg-slate-900 text-white"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setRenameId(null)} className="p-1.5 rounded border border-slate-200 text-slate-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 flex-wrap mt-auto">
            <button onClick={() => openPreview(t)} title="Preview theme" className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            {t.status !== 'PUBLISHED' && (
              <button onClick={() => doPublish(t)} disabled={busyId} title="Publish theme (switch storefront design)" className="flex items-center gap-1 bg-slate-900 text-white rounded-lg px-2 py-1.5 text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-50">
                {busyId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Publish
              </button>
            )}
            {t.status === 'PUBLISHED' && (
              <button onClick={() => doUnpublish(t)} disabled={busyId} title="Unpublish (storefront keeps current design)" className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {busyId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Unpublish
              </button>
            )}
            <button onClick={() => doDuplicate(t)} disabled={busyId} title="Duplicate theme" className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => startRename(t)} title="Rename theme" className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => openVersions(t)} title="Version history" className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"><History className="w-3.5 h-3.5" /></button>
            <button
              onClick={() => doDelete(t)}
              disabled={busyId || t.status === 'PUBLISHED'}
              title={t.status === 'PUBLISHED' ? 'Publish another theme before deleting' : 'Delete theme'}
              className="p-1.5 rounded border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      {/* ── header row ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[12px] text-slate-500">Design only — products, orders, payments and COD are never touched.</p>
          {storageEnabled === false && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1.5 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> R2 asset storage not configured — ZIP themes with assets are rejected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInput.current?.click()} disabled={busy === '__import__'} className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50">
            {busy === '__import__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import ZIP
          </button>
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-4 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-[12px] px-4 py-2.5">
          <p className="font-bold mb-1">Theme validation failed — nothing was installed:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {importErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <button onClick={() => setImportErrors([])} className="mt-2 underline font-semibold">Dismiss</button>
        </div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] px-4 py-2 flex items-center gap-2">
          <PackageCheck className="w-4 h-4" /> {toast}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading themes…
        </div>
      ) : (
        <>
          {/* ── current theme ── */}
          {published && (
            <section className="grid lg:grid-cols-2 gap-3">
              <div className={`relative rounded-2xl bg-gradient-to-br ${gradientFor(published.id)} p-5 flex flex-col justify-between min-h-[13rem] text-white`}>
                <div>
                  <span className="inline-flex items-center gap-1.5 bg-[#95bf47] text-[#1a1a1a] text-[10px] font-black px-2 py-1 rounded">
                    <ShieldCheck className="w-3 h-3" /> PUBLISHED — live on your storefront
                  </span>
                  <h2 className="mt-2 text-2xl font-black leading-tight">{published.name}</h2>
                  <p className="text-[11px] text-white/70 mt-1">v{published.latestVersion} · {published.versionCount} versions · Updated {new Date(published.updatedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Link href="/customize" className="flex items-center gap-1.5 bg-white text-slate-900 font-bold text-[12px] px-3.5 py-2 rounded-lg hover:bg-slate-100">
                    <Palette className="w-4 h-4" /> Customize
                  </Link>
                  <button onClick={() => openPreview(published)} className="flex items-center gap-1.5 bg-black/30 hover:bg-black/40 border border-white/20 text-[12px] font-semibold px-3.5 py-2 rounded-lg">
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                  <a href={STOREFRONT_URL} target="_blank" rel="noreferrer" title="Open live storefront" className="p-2 rounded-lg bg-black/30 hover:bg-black/40 border border-white/20">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <ThemeCard t={published} big />
            </section>
          )}

          {/* ── library grid ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Theme library ({others.length})
              </h3>
              {published && others.length > 0 && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Publishing switches the live design — one click rollback anytime</p>
              )}
            </div>
            {others.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <Palette className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="mt-2 text-[13px] font-semibold text-slate-600">No other themes yet</p>
                <p className="text-[11px] text-slate-400">Import a ZIP or duplicate your live theme to experiment safely.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {others.map((t) => <ThemeCard key={t.id} t={t} />)}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── preview modal (renders the theme on the real storefront renderer) ── */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex flex-col">
          <div className="flex items-center justify-between px-4 h-12 bg-[#1a1a1a] text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-[13px] font-semibold truncate">Preview: {previewTheme.name}</p>
              <span className="text-[10px] text-white/50 hidden sm:inline">· not live yet</span>
            </div>
            <div className="flex items-center gap-2">
              {previewTheme.status !== 'PUBLISHED' && (
                <button onClick={() => { doPublish(previewTheme); setPreviewTheme(null); }} className="flex items-center gap-1.5 bg-[#95bf47] text-[#1a1a1a] text-[11px] font-bold px-3 py-1.5 rounded-lg">
                  <Check className="w-3.5 h-3.5" /> Publish this theme
                </button>
              )}
              <button onClick={() => setPreviewTheme(null)} className="p-1.5 rounded hover:bg-white/10"><X className="w-4 h-4" /></button>
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

      {/* ── versions drawer ── */}
      {versionsFor && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setVersionsFor(null)} />
          <aside className="relative bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-900">Version history — {versionsFor.name}</p>
              <button onClick={() => setVersionsFor(null)} className="p-1.5 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 flex items-center justify-between gap-2 border-b border-slate-100">
              <p className="text-[11px] text-slate-500">Restore an earlier design. Restoring creates a new version — history is never rewritten.</p>
              <button onClick={() => doSnapshot(versionsFor)} disabled={busy === versionsFor.id} className="shrink-0 flex items-center gap-1 border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-semibold hover:bg-slate-50">
                {busy === versionsFor.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />} Save version
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versionsLoading ? (
                <div className="py-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : versions.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-10">No versions yet.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.versionNumber} className="border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-700 text-[12px] font-black flex items-center justify-center">v{v.versionNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{v.label || 'Snapshot'}</p>
                      <p className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => doRestore(versionsFor, v.versionNumber, false)} disabled={busy === versionsFor.id} className="text-[10px] font-bold border border-slate-300 rounded-md px-2 py-1 hover:bg-slate-50">Restore</button>
                      <button onClick={() => doRestore(versionsFor, v.versionNumber, true)} disabled={busy === versionsFor.id} className="text-[10px] font-bold bg-slate-900 text-white rounded-md px-2 py-1 hover:bg-slate-800">Restore &amp; publish</button>
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
