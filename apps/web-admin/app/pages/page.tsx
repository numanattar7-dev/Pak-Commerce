'use client';

// ---------------------------------------------------------------------------
// Pages — Shopify-style pages manager.
// Create / edit / duplicate / publish / delete custom storefront pages with
// SEO controls and a preview drawer. Backed by /store-pages (tenant-scoped).
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Pencil, Trash2, Copy, ExternalLink, X, FileText, Loader2,
  Check, Eye, Globe, ArrowLeft,
} from 'lucide-react';
import { api, formatDate } from '@/lib/api';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';

type PageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Editing = Partial<PageRow> & { handle?: string; isNew?: boolean };

export default function PagesManager() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PageRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPages(await api<PageRow[]>('/store-pages'));
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter((p) => {
      if (filter === 'published' && !p.isPublished) return false;
      if (filter === 'draft' && p.isPublished) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.seoTitle || '').toLowerCase().includes(q)
      );
    });
  }, [pages, query, filter]);

  const startNew = () =>
    setEditing({
      title: '', slug: '', content: '',
      isPublished: false, seoTitle: '', seoDescription: '', isNew: true,
    });

  const save = async () => {
    if (!editing?.title?.trim()) {
      setError('A title is required');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: editing.title.trim(),
      slug: editing.handle ?? editing.slug ?? undefined,
      content: editing.content ?? '',
      isPublished: editing.isPublished ?? false,
      seoTitle: editing.seoTitle ?? '',
      seoDescription: editing.seoDescription ?? '',
    };
    try {
      if (editing.id) {
        await api(`/store-pages/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/store-pages', { method: 'POST', body });
      }
      setEditing(null);
      flash('Page saved');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (p: PageRow) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/store-pages/${p.id}/duplicate`, { method: 'POST' });
      flash('Page duplicated as draft');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: PageRow) => {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/store-pages/${p.id}`, { method: 'DELETE' });
      flash('Page deleted');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (p: PageRow) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/store-pages/${p.id}`, { method: 'PUT', body: { isPublished: !p.isPublished } });
      flash(p.isPublished ? 'Unpublished' : 'Published');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

  const counts = {
    all: pages.length,
    published: pages.filter((p) => p.isPublished).length,
    draft: pages.filter((p) => !p.isPublished).length,
  };

  return (
    <div className="grid gap-4">
      {/* ── toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="p-1.5 rounded hover:bg-slate-100 text-slate-400" title="Back to admin">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate-900">Pages</h2>
            <p className="text-[11px] text-slate-500">Static pages on your storefront — about, shipping, policies.</p>
          </div>
        </div>
        <button onClick={startNew} className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800">
          <Plus className="w-4 h-4" /> Add page
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-4 py-2.5">{error}</div>
      )}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] px-4 py-2 flex items-center gap-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      {/* ── filters + table ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" className={`${inputCls} pl-9`} />
        </div>
        {(['all', 'published', 'draft'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${
              filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            {k} ({counts[k]})
          </button>
        ))}
      </div>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading pages…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-2 text-[13px] font-semibold text-slate-700">
              {pages.length === 0 ? 'No pages yet' : 'No pages match your search'}
            </p>
            <p className="text-[11px] text-slate-400">
              {pages.length === 0 ? 'Create your first page — About us, Shipping, FAQ.' : 'Try a different search or filter.'}
            </p>
            {pages.length === 0 && (
              <button onClick={startNew} className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800">
                <Plus className="w-4 h-4" /> Add page
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Handle</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Updated</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.title}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-500">/p/{p.slug}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublish(p)}
                        disabled={busy}
                        title={p.isPublished ? 'Unpublish' : 'Publish'}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${
                          p.isPublished ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {p.isPublished ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatDate(p.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreview(p)} title="Preview" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditing({ ...p })} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => duplicate(p)} title="Duplicate" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(p)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── editor drawer ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setEditing(null)} />
          <aside className="relative bg-white w-full max-w-xl h-full overflow-y-auto flex flex-col shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 h-12 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-900">{editing.id ? 'Edit page' : 'New page'}</p>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-slate-100" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 grid gap-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Title *</p>
                <input autoFocus value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="About us" className={inputCls} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Handle</p>
                  <input
                    value={editing.handle ?? editing.slug ?? ''}
                    onChange={(e) => setEditing({ ...editing, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="about-us"
                    className={`${inputCls} font-mono text-[12px]`}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, isPublished: !editing.isPublished })}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[12px] font-semibold transition ${
                      editing.isPublished ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span>{editing.isPublished ? 'Published' : 'Draft'}</span>
                    <Globe className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Content</p>
                <textarea rows={12} value={editing.content ?? ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="Write your page… Markdown-ish plain text works fine." className={inputCls} />
                <p className="text-[10px] text-slate-400 mt-1">{(editing.content || '').length} / 20000 characters</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 grid gap-3 bg-slate-50/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SEO &amp; social</p>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">SEO title</p>
                  <input value={editing.seoTitle ?? ''} onChange={(e) => setEditing({ ...editing, seoTitle: e.target.value })} placeholder={editing.title || 'Page title'} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">{(editing.seoTitle || '').length} / 200</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Meta description</p>
                  <textarea rows={2} value={editing.seoDescription ?? ''} onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })} placeholder="Shown in search results and social shares…" className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">{(editing.seoDescription || '').length} / 300</p>
                </div>
              </div>
              {editing.id && editing.isPublished && (
                <a href={`${STOREFRONT_URL}/p/${editing.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-slate-900">
                  View live page <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={save} disabled={busy || !editing.title?.trim()} className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save page
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── preview modal ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-900 truncate">{preview.title}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <h1 className="text-2xl font-black text-slate-900">{preview.title}</h1>
              <div className="mt-6 text-sm text-slate-700 leading-7 whitespace-pre-wrap">{preview.content || 'This page is empty.'}</div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${preview.isPublished ? 'text-emerald-700' : 'text-slate-500'}`}>
                {preview.isPublished ? 'Published — visible on storefront' : 'Draft — not visible to shoppers'}
              </span>
              {preview.isPublished && (
                <a href={`${STOREFRONT_URL}/p/${preview.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 hover:text-slate-900">
                  Open live page <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
