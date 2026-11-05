'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, X, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { type StorePageRow } from '@/lib/store-config';

const formatDateSafe = (d: string) =>
  d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function OnlineStorePages() {
  const [pages, setPages] = useState<StorePageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<StorePageRow> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api<StorePageRow[]>('/store-pages');
      setPages(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing?.title?.trim()) return;
    setBusy(true);
    setError(null);
    const body = {
      title: editing.title.trim(),
      slug: editing.slug?.trim() || undefined,
      content: editing.content || '',
      isPublished: editing.isPublished ?? false,
    };
    try {
      if (editing.id) {
        await api(`/store-pages/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/store-pages', { method: 'POST', body });
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: StorePageRow) => {
    if (!confirm(`Delete page "${p.title}"?`)) return;
    setError(null);
    try {
      await api(`/store-pages/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Delete failed');
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-slate-500">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'} · shown on your storefront
        </p>
        <button
          onClick={() => setEditing({ title: '', slug: '', content: '', isPublished: false })}
          className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 transition"
        >
          <Plus className="w-4 h-4" /> Add page
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-2.5">
          {error}
        </div>
      )}

      {/* ── editor panel ── */}
      {editing && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-slate-900">
              {editing.id ? 'Edit page' : 'New page'}
            </p>
            <button
              onClick={() => setEditing(null)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Title</p>
              <input
                value={editing.title ?? ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="About us"
                className={inputCls}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Slug (optional)</p>
              <input
                value={editing.slug ?? ''}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="about-us"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 mb-1">Content</p>
            <textarea
              rows={7}
              value={editing.content ?? ''}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              placeholder="Write your page…"
              className={inputCls}
            />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setEditing({ ...editing, isPublished: !editing.isPublished })}
                className={`w-9 h-5 rounded-full transition relative ${editing.isPublished ? 'bg-slate-900' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    editing.isPublished ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
              {editing.isPublished ? 'Published' : 'Draft'}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy || !editing.title?.trim()}
                className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save page
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── table ── */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-[13px] py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading pages…
          </div>
        ) : pages.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-2 text-[13px] font-semibold text-slate-700">No pages yet</p>
            <p className="text-[12px] text-slate-500">Create your first page — About us, FAQ, shipping &amp; returns.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Updated</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.title}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[12px]">/{p.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          p.isPublished
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {formatDateSafe(p.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing({ ...p })}
                          title="Edit page"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          title="Delete page"
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                        >
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
    </div>
  );
}
