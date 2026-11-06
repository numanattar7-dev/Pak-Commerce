'use client';

// ---------------------------------------------------------------------------
// Blog — posts manager.
// List / filter / create / edit / duplicate / publish / delete journal posts.
// Backed by /blog-posts (tenant-scoped). Drafts never reach the public site.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Pencil, Trash2, Copy, ExternalLink, X, Loader2, Check, Eye,
  ArrowLeft, Upload, Newspaper, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { api, apiUpload, formatDate, getApiBase } from '@/lib/api';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';

function mediaUrl(src?: string | null): string {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  return `${getApiBase()}/${src.replace(/^\/+/, '')}`;
}

type BlogPost = {
  id: string;
  title: string;
  handle: string;
  excerpt: string;
  content: string;
  author: string | null;
  imageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<BlogPost | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search.trim()) params.set('q', search.trim());
      if (filter !== 'all') params.set('status', filter);
      const res = await api<{ data: BlogPost[]; meta: { total: number; page: number; totalPages: number } }>(
        `/blog-posts?${params.toString()}`,
      );
      setPosts(Array.isArray(res?.data) ? res.data : []);
      const nextMeta = res?.meta ?? { total: 0, page: 1, totalPages: 1 };
      const totalPages = Math.max(1, Number(nextMeta.totalPages) || 1);
      if (page > totalPages) {
        setPage(totalPages);
        return;
      }
      setMeta(nextMeta);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { load(); }, [load]);

  // Debounce typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => { setPage(1); }, [filter]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const startNew = () =>
    setEditing({ title: '', handle: '', excerpt: '', content: '', author: '', imageUrl: '', seoTitle: '', seoDescription: '', isPublished: false });

  const save = async () => {
    if (!editing?.title?.trim()) {
      setError('A title is required');
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      title: editing.title.trim(),
      handle: editing.handle?.trim() || undefined,
      excerpt: (editing.excerpt || '').trim(),
      content: editing.content || '',
      // Send empty strings (not undefined) so clearing an author or image
      // actually clears it on update; the API maps empty values to null.
      author: editing.author?.trim() ?? '',
      imageUrl: editing.imageUrl?.trim() ?? '',
      seoTitle: editing.seoTitle ?? '',
      seoDescription: editing.seoDescription ?? '',
      isPublished: editing.isPublished ?? false,
    };
    try {
      if (editing.id) {
        await api(`/blog-posts/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/blog-posts', { method: 'POST', body });
      }
      setEditing(null);
      flash('Post saved');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (p: BlogPost) => {
    setBusy(true);
    try {
      await api(`/blog-posts/${p.id}/duplicate`, { method: 'POST' });
      flash('Post duplicated as draft');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: BlogPost) => {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/blog-posts/${p.id}`, { method: 'DELETE' });
      flash('Post deleted');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (p: BlogPost) => {
    setBusy(true);
    try {
      await api(`/blog-posts/${p.id}`, { method: 'PUT', body: { isPublished: !p.isPublished } });
      flash(p.isPublished ? 'Unpublished' : 'Published');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file?: File | null) => {
    if (!file || !editing) return;
    setBusy(true);
    try {
      const res = await apiUpload<{ url: string }>('/products/upload-image', file);
      setEditing({ ...editing, imageUrl: res.url });
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';
  const hasFilters = filter !== 'all' || search.trim().length > 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="p-1.5 rounded hover:bg-slate-100 text-slate-400" title="Back to admin"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Blog</h2>
            <p className="text-[11px] text-slate-500">News, stories and guides — published instantly. Drafts stay hidden.</p>
          </div>
        </div>
        <button onClick={startNew} className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800">
          <Plus className="w-4 h-4" /> New post
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[12px] px-4 py-2.5">{error}</div>}
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[12px] px-4 py-2 flex items-center gap-2"><Check className="w-4 h-4" /> {toast}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts by title, handle or author…" className={`${inputCls} pl-9`} />
        </div>
        {(['all', 'published', 'draft'] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition ${filter === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
            {k}
          </button>
        ))}
      </div>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-[13px]"><Loader2 className="w-4 h-4 animate-spin" /> Loading posts…</div>
        ) : posts.length === 0 ? (
          <div className="py-12 text-center">
            <Newspaper className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-2 text-[13px] font-semibold text-slate-700">{hasFilters ? 'No posts match your filters' : 'No posts yet'}</p>
            <p className="text-[11px] text-slate-400">{hasFilters ? 'Try a different search or status.' : 'Your first post is one click away.'}</p>
            {!hasFilters && (
              <button onClick={startNew} className="mt-4 inline-flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800"><Plus className="w-4 h-4" /> New post</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 font-semibold">Post</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Published</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {p.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={mediaUrl(p.imageUrl)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Newspaper className="w-4 h-4 text-slate-400" /></span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{p.title}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">/blog/{p.handle}{p.author ? ` · ${p.author}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => togglePublish(p)} disabled={busy} title={p.isPublished ? 'Unpublish' : 'Publish'} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition ${p.isPublished ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {p.isPublished ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.publishedAt ? formatDate(p.publishedAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreview(p)} title="Preview" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setEditing({ ...p })} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => duplicate(p)} title="Duplicate" className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900"><Copy className="w-4 h-4" /></button>
                        <button onClick={() => remove(p)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && posts.length > 0 && meta.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-[11px] text-slate-400">Page {meta.page} of {meta.totalPages} · {meta.total} posts</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.totalPages}
              className="flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>

      {/* ── editor drawer ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setEditing(null)} />
          <aside className="relative bg-white w-full max-w-2xl h-full overflow-y-auto flex flex-col shadow-2xl">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-5 h-12 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-900">{editing.id ? 'Edit post' : 'New post'}</p>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-slate-100" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 grid gap-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Title *</p>
                <input autoFocus value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Why lawn season matters" className={inputCls} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Handle</p>
                  <input value={editing.handle ?? ''} onChange={(e) => setEditing({ ...editing, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="auto from title" className={`${inputCls} font-mono text-[12px]`} />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Author</p>
                  <input value={editing.author ?? ''} onChange={(e) => setEditing({ ...editing, author: e.target.value })} placeholder="Khaadi Studio" className={inputCls} />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Excerpt * (used as meta description)</p>
                <textarea rows={2} value={editing.excerpt ?? ''} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} placeholder="A one-line summary shown in listings, search and social shares…" className={inputCls} />
                <p className="text-[10px] text-slate-400 mt-1">{(editing.excerpt || '').length} / 500</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Featured image</p>
                <div className="flex items-center gap-2">
                  {editing.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={mediaUrl(editing.imageUrl)} alt="" className="w-16 h-12 rounded-md object-cover border border-slate-200" />
                  ) : (
                    <div className="w-16 h-12 rounded-md bg-slate-100 border border-slate-200" />
                  )}
                  <label className="inline-flex items-center gap-1 text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Upload
                    <input type="file" accept="image/*" hidden onChange={(e) => uploadImage(e.target.files?.[0])} />
                  </label>
                  {editing.imageUrl && <button onClick={() => setEditing({ ...editing, imageUrl: '' })} className="text-xs text-red-600">Remove</button>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Content</p>
                <textarea rows={14} value={editing.content ?? ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="Write your story…" className={inputCls} />
                <p className="text-[10px] text-slate-400 mt-1">{(editing.content || '').length} / 40000 characters</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 grid gap-3 bg-slate-50/50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SEO &amp; social</p>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">SEO title</p>
                  <input value={editing.seoTitle ?? ''} onChange={(e) => setEditing({ ...editing, seoTitle: e.target.value })} placeholder={editing.title || 'Post title'} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">{(editing.seoTitle || '').length} / 200 · falls back to the post title</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500 mb-1">Meta description</p>
                  <textarea rows={2} value={editing.seoDescription ?? ''} onChange={(e) => setEditing({ ...editing, seoDescription: e.target.value })} placeholder={editing.excerpt || 'Shown in search results and social shares…'} className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">{(editing.seoDescription || '').length} / 300 · falls back to the excerpt</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[13px] font-medium text-slate-700">Published — visible on <span className="font-mono text-slate-500">/blog</span></span>
                <button type="button" onClick={() => setEditing({ ...editing, isPublished: !editing.isPublished })} className={`w-9 h-5 rounded-full transition relative ${editing.isPublished ? 'bg-slate-900' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editing.isPublished ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={save} disabled={busy || !editing.title?.trim()} className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save post
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── preview modal (in-memory; draft-safe) ── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-900 truncate">{preview.title}</p>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {preview.imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl(preview.imageUrl)} alt="" className="w-full h-48 object-cover rounded-xl border border-slate-200" />
              )}
              <h1 className="text-2xl font-black text-slate-900 mt-4">{preview.title}</h1>
              <p className="text-[11px] text-slate-400 mt-1">{preview.publishedAt ? `Published ${formatDate(preview.publishedAt)}` : 'Draft'}{preview.author ? ` · ${preview.author}` : ''}</p>
              <div className="mt-6 text-sm text-slate-700 leading-7 whitespace-pre-wrap">{preview.content || 'This post is empty.'}</div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${preview.isPublished ? 'text-emerald-700' : 'text-slate-500'}`}>{preview.isPublished ? 'Published' : 'Draft — hidden from shoppers'}</span>
              {preview.isPublished && (
                <a href={`${STOREFRONT_URL}/blog/${preview.handle}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 hover:text-slate-900">Open live post <ExternalLink className="w-3.5 h-3.5" /></a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
