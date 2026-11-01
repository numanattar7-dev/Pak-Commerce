'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Plus, Upload, Download, Trash2, Pencil, ImagePlus } from 'lucide-react';
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
import { api, apiUpload, apiDownload, formatPKR, formatDate } from '@/lib/api';

type Variant = {
  id: string;
  title: string;
  sku?: string | null;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  weightGrams: number;
};

type Product = {
  id: string;
  title: string;
  titleUrdu?: string | null;
  description?: string | null;
  category: string;
  tags: string[];
  isHalal: boolean;
  isActive: boolean;
  images: string[];
  createdAt: string;
  variants: Variant[];
};

type Draft = {
  id?: string;
  title: string;
  titleUrdu: string;
  description: string;
  category: string;
  tags: string;
  isHalal: boolean;
  images: string[];
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
};

const initialDraft: Draft = {
  title: '',
  titleUrdu: '',
  description: '',
  category: 'Unstitched',
  tags: '',
  isHalal: true,
  images: [],
  price: '',
  compareAtPrice: '',
  stockQuantity: '',
};

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ data: Product[]; meta: any }>(`/products?page=${p}&limit=15`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (page > 1) load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setDraft(initialDraft);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const first = p.variants[0];
    setDraft({
      id: p.id,
      title: p.title,
      titleUrdu: p.titleUrdu || '',
      description: p.description || '',
      category: p.category,
      tags: (p.tags || []).join(', '),
      isHalal: p.isHalal,
      images: p.images || [],
      price: first ? String(first.price) : '',
      compareAtPrice: first?.compareAtPrice ? String(first.compareAtPrice) : '',
      stockQuantity: first ? String(first.stockQuantity) : '',
    });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const body: any = {
        title: draft.title,
        category: draft.category,
        isHalal: draft.isHalal,
      };
      if (draft.titleUrdu) body.titleUrdu = draft.titleUrdu;
      if (draft.description) body.description = draft.description;
      const tags = draft.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length) body.tags = tags;
      if (draft.images.length) body.images = draft.images;

      if (draft.id) {
        await api(`/products/${draft.id}`, { method: 'PUT', body });
        setNotice('Product updated');
      } else {
        if (draft.price) body.price = Number(draft.price);
        if (draft.compareAtPrice) body.compareAtPrice = Number(draft.compareAtPrice);
        if (draft.stockQuantity) body.stockQuantity = Number(draft.stockQuantity);
        if (!body.price) body.price = 0;
        await api('/products', { method: 'POST', body });
        setNotice('Product created');
      }
      setDraft(null);
      await load(draft.id ? page : 1);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Product) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      setNotice('Product deleted');
      await load(page);
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const uploadImage = async (file: File) => {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await apiUpload<{ url: string }>('/products/upload-image', file);
      setDraft((d) => (d ? { ...d, images: [...d.images, `${location.protocol}//${location.hostname}:4000${res.url}`] } : d));
    } catch (e: any) {
      setError(e?.message || 'Image upload failed');
    } finally {
      setBusy(false);
    }
  };

  const addVariant = async (p: Product, v: VariantDraft) => {
    try {
      await api(`/products/${p.id}/variants`, { method: 'POST', body: v });
      setNotice('Variant added');
      await load(page);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Variant failed');
    }
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res: any = await apiUpload('/products/import/csv', file);
      setNotice(
        `CSV processed: ${res.rows} rows · created ${res.productsCreated} products / ${res.variantsCreated} variants · updated ${res.productsUpdated} products / ${res.variantsUpdated} variants${
          res.errors?.length ? ` · ${res.errors.length} errors: ${res.errors[0]}` : ''
        }`,
      );
      await load(1);
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setBusy(false);
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Card
          title="Products"
          subtitle={meta ? `${meta.total} products in catalog` : '—'}
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} className={`${btnGhost} ${btnSm}`}>
                <Upload className="w-3.5 h-3.5" /> Import CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => apiDownload('/products/export/csv', 'products-export.csv')}
                className={`${btnGhost} ${btnSm}`}
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={openCreate} className={`${btnPrimary} ${btnSm}`}>
                <Plus className="w-3.5 h-3.5" /> New product
              </button>
            </div>
          }
        >
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty msg="No products yet — create your first product or import a CSV." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {rows.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="h-36 bg-slate-100 relative">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl">🖼</div>
                    )}
                    <span
                      className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
                      }`}
                    >
                      {p.isActive ? 'ACTIVE' : 'DRAFT'}
                    </span>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{p.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.category} · {p.variants.length} variant{p.variants.length === 1 ? '' : 's'} ·{' '}
                      {p.variants.reduce((s, v) => s + v.stockQuantity, 0)} in stock
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.variants.slice(0, 3).map((v) => (
                        <span key={v.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {v.title}: {formatPKR(v.price)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{formatDate(p.createdAt)}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} className={`${btnGhost} ${btnSm}`}>
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => del(p)} className={btnDanger + ' !px-2'}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-slate-500 text-xs">
                Page {meta.page} of {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`${btnGhost} ${btnSm}`}>
                  ← Prev
                </button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className={`${btnGhost} ${btnSm}`}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {draft && (
        <ProductModal
          draft={draft}
          editing={editing}
          busy={busy}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={save}
          onUploadImage={uploadImage}
          onRemoveImage={(url) => setDraft((d) => (d ? { ...d, images: d.images.filter((u) => u !== url) } : d))}
          onAddVariant={addVariant}
        />
      )}
    </AppShell>
  );
}

type VariantDraft = {
  title: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity?: number;
};

function ProductModal({
  draft,
  editing,
  busy,
  onChange,
  onClose,
  onSave,
  onUploadImage,
  onRemoveImage,
  onAddVariant,
}: {
  draft: Draft;
  editing: Product | null;
  busy: boolean;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
  onUploadImage: (f: File) => void;
  onRemoveImage: (url: string) => void;
  onAddVariant: (p: Product, v: VariantDraft) => Promise<void>;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const imgRef = useRef<HTMLInputElement>(null);

  return (
    <Modal open onClose={onClose} title={draft.id ? 'Edit product' : 'New product'} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className={label}>Title *</p>
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={input} />
          </div>
          <div>
            <p className={label}>Urdu title</p>
            <input value={draft.titleUrdu} onChange={(e) => set({ titleUrdu: e.target.value })} className={input} dir="rtl" />
          </div>
          <div>
            <p className={label}>Category *</p>
            <input value={draft.category} onChange={(e) => set({ category: e.target.value })} className={input} />
          </div>
          <div>
            <p className={label}>Tags (comma separated)</p>
            <input value={draft.tags} onChange={(e) => set({ tags: e.target.value })} className={input} />
          </div>
          <div className="col-span-2">
            <p className={label}>Description</p>
            <textarea
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className={input}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.isHalal} onChange={(e) => set({ isHalal: e.target.checked })} />
            Sharia / halal compliance flag
          </label>
        </div>

        {/* images */}
        <div>
          <div className="flex items-center justify-between">
            <p className={label}>Images</p>
            <button onClick={() => imgRef.current?.click()} className={`${btnGhost} ${btnSm}`}>
              <ImagePlus className="w-3.5 h-3.5" /> Upload
            </button>
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadImage(f);
                if (imgRef.current) imgRef.current.value = '';
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {draft.images.map((url) => (
              <div key={url} className="relative group">
                <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                <button
                  onClick={() => onRemoveImage(url)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none opacity-80 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
            {draft.images.length === 0 && <p className="text-xs text-slate-400">No images uploaded.</p>}
          </div>
        </div>

        {/* default variant (create only) */}
        {!draft.id && (
          <div className="grid grid-cols-3 gap-3 border border-slate-100 rounded-lg p-3">
            <div>
              <p className={label}>Price (PKR) *</p>
              <input value={draft.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, '') })} className={input} />
            </div>
            <div>
              <p className={label}>Compare-at price</p>
              <input value={draft.compareAtPrice} onChange={(e) => set({ compareAtPrice: e.target.value.replace(/[^\d.]/g, '') })} className={input} />
            </div>
            <div>
              <p className={label}>Stock</p>
              <input value={draft.stockQuantity} onChange={(e) => set({ stockQuantity: e.target.value.replace(/\D/g, '') })} className={input} />
            </div>
          </div>
        )}

        {/* variants (edit only) */}
        {draft.id && editing && (
          <VariantEditor product={editing} busy={busy} onAdd={onAddVariant} />
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onSave} disabled={busy} className={`${btnPrimary} flex-1`}>
            {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create product'}
          </button>
          <button onClick={onClose} className={btnGhost}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VariantEditor({
  product,
  busy,
  onAdd,
}: {
  product: Product;
  busy: boolean;
  onAdd: (p: Product, v: VariantDraft) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [compare, setCompare] = useState('');
  const [stock, setStock] = useState('');

  return (
    <div className="border border-slate-100 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-500 uppercase">Variants ({product.variants.length})</p>
        <button onClick={() => setOpen((o) => !o)} className={`${btnGhost} ${btnSm}`}>
          <Plus className="w-3 h-3" /> Add variant
        </button>
      </div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-slate-50">
          {product.variants.map((v) => (
            <tr key={v.id}>
              <td className="py-1.5 font-medium text-slate-700">{v.title}</td>
              <td className="py-1.5 text-slate-400">{v.sku}</td>
              <td className="py-1.5 text-right font-semibold">{formatPKR(v.price)}</td>
              <td className="py-1.5 text-right text-slate-500">{v.stockQuantity} pcs</td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && (
        <div className="mt-2 space-y-2 border-t border-dashed border-slate-200 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Variant title (e.g. Size M)" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
            <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} className={input} />
            <input placeholder="Price (PKR)" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} className={input} />
            <input placeholder="Compare-at price" value={compare} onChange={(e) => setCompare(e.target.value.replace(/[^\d.]/g, ''))} className={input} />
            <input placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))} className={input} />
          </div>
          <button
            disabled={busy || !title || !price}
            onClick={async () => {
              await onAdd(product, {
                title,
                sku: sku || undefined,
                price: Number(price),
                compareAtPrice: compare ? Number(compare) : undefined,
                stockQuantity: stock ? Number(stock) : undefined,
              });
              setOpen(false);
              setTitle('');
              setSku('');
              setPrice('');
              setCompare('');
              setStock('');
            }}
            className={`${btnPrimary} w-full`}
          >
            Save variant
          </button>
        </div>
      )}
    </div>
  );
}
