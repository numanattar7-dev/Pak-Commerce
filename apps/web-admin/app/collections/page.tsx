'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Pencil, Package } from 'lucide-react';
import AppShell from '@/components/AppShell';
import {
  Card,
  Modal,
  Spinner,
  Empty,
  btnGhost,
  btnPrimary,
  btnDanger,
  btnSm,
  input,
  label,
} from '@/components/ui';
import { api } from '@/lib/api';

type Collection = {
  id: string;
  title: string;
  handle: string;
  isActive: boolean;
  products: Array<{ productId: string }>;
};

type ProductLite = { id: string; title: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function CollectionsPage() {
  const [rows, setRows] = useState<Collection[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Collection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [handle, setHandle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [productIds, setProductIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        api<Collection[] | any>('/collections'),
        api<{ data: ProductLite[] } | any>('/products?page=1&limit=100'),
      ]);
      setRows(Array.isArray(c) ? c : c?.data || []);
      setProducts(p?.data || p || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setHandle('');
    setIsActive(true);
    setProductIds(new Set());
    setModalOpen(true);
  };

  const openEdit = (c: Collection) => {
    setEditing(c);
    setTitle(c.title);
    setHandle(c.handle);
    setIsActive(c.isActive);
    setProductIds(new Set((c.products || []).map((cp) => cp.productId)));
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { title, handle: handle || slugify(title), isActive };

      if (editing) {
        // ProductIds is a FULL replacement of the collection's product set
        const body: any = { ...payload, productIds: Array.from(productIds) };
        await api(`/collections/${editing.id}`, { method: 'PUT', body });
        setNotice('Collection updated');
      } else {
        const body: any = { ...payload };
        if (productIds.size > 0) body.productIds = Array.from(productIds);
        await api('/collections', { method: 'POST', body });
        setNotice('Collection created');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (c: Collection) => {
    if (!confirm(`Delete collection "${c.title}"?`)) return;
    try {
      await api(`/collections/${c.id}`, { method: 'DELETE' });
      setNotice('Collection deleted');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const toggleActive = async (c: Collection) => {
    try {
      await api(`/collections/${c.id}`, { method: 'PUT', body: { isActive: !c.isActive } });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Toggle failed');
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-sm font-medium">
            {notice}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>
        )}

        <Card
          title="Collections"
          subtitle="Manual product groupings shown on the storefront"
          action={
            <div className="flex gap-2">
              <button onClick={load} className={`${btnGhost} ${btnSm}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={openCreate} className={`${btnPrimary} ${btnSm}`}>
                <Plus className="w-3.5 h-3.5" /> New collection
              </button>
            </div>
          }
        >
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty msg="No collections yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{c.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'
                        }`}
                      >
                        {c.isActive ? 'ACTIVE' : 'DRAFT'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      /{c.handle} · {c.products?.length ?? 0} products
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => toggleActive(c)} className={`${btnGhost} ${btnSm}`}>
                      {c.isActive ? 'Pause' : 'Publish'}
                    </button>
                    <button onClick={() => openEdit(c)} className={`${btnGhost} ${btnSm}`}>
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => del(c)} className={btnDanger + ' !px-2'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {modalOpen && (
        <Modal
          open
          onClose={() => setModalOpen(false)}
          title={editing ? `Edit collection — ${editing.title}` : 'New collection'}
          wide
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={label}>Title *</p>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!editing) setHandle(slugify(e.target.value));
                  }}
                  className={input}
                />
              </div>
              <div>
                <p className={label}>Handle (URL slug)</p>
                <input value={handle} onChange={(e) => setHandle(e.target.value)} className={input} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Visible on storefront
            </label>

            <div>
              <p className={label}>Products in collection</p>
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productIds.has(p.id)}
                      onChange={(e) =>
                        setProductIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                          return next;
                        })
                      }
                    />
                    <Package className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-700">{p.title}</span>
                  </label>
                ))}
                {products.length === 0 && <p className="px-3 py-4 text-xs text-slate-400">No products in catalog.</p>}
              </div>
              {editing && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Note: saving replaces the full product list of this collection.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={busy || !title} className={`${btnPrimary} flex-1`}>
                {busy ? 'Saving…' : editing ? 'Save collection' : 'Create collection'}
              </button>
              <button onClick={() => setModalOpen(false)} className={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
