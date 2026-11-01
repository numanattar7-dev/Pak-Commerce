'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Pencil, TicketPercent, Search } from 'lucide-react';
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
import { api, formatPKR, formatDate } from '@/lib/api';

type Discount = {
  id: string;
  code: string;
  description?: string | null;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  value: number;
  minSubtotal?: number | null;
  maxUses?: number | null;
  usedCount: number;
  firstOnly: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
};

type Usage = {
  discount: { code: string; maxUses?: number | null; usedCount: number };
  ordersUsing: number;
  totalSaved: number;
  totalOrderValue: number;
};

type Draft = {
  code: string;
  description: string;
  type: Discount['type'];
  value: string;
  minSubtotal: string;
  maxUses: string;
  firstOnly: boolean;
  startsAt: string;
  endsAt: string;
};

const initialDraft: Draft = {
  code: '',
  description: '',
  type: 'PERCENTAGE',
  value: '',
  minSubtotal: '',
  maxUses: '',
  firstOnly: false,
  startsAt: '',
  endsAt: '',
};

const typeLabel: Record<string, string> = {
  PERCENTAGE: '% off',
  FIXED: 'PKR off',
  FREE_SHIPPING: 'free shipping',
};

export default function DiscountsPage() {
  const [rows, setRows] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<Discount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(
    async (st = statusFilter, q = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', limit: '30' });
        if (st) params.set('status', st);
        if (q.trim()) params.set('search', q.trim());
        const res = await api<{ data: Discount[] }>(`/discounts?${params.toString()}`);
        setRows(res.data || (res as any) || []);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load discounts');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search],
  );

  useEffect(() => {
    load('', '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null);
    setDraft(initialDraft);
    setModalOpen(true);
  };

  const openEdit = (d: Discount) => {
    setEditing(d);
    setDraft({
      code: d.code,
      description: d.description || '',
      type: d.type,
      value: String(d.value),
      minSubtotal: d.minSubtotal ? String(d.minSubtotal) : '',
      maxUses: d.maxUses ? String(d.maxUses) : '',
      firstOnly: d.firstOnly,
      startsAt: d.startsAt ? d.startsAt.slice(0, 10) : '',
      endsAt: d.endsAt ? d.endsAt.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: any = {};
      if (draft.description) body.description = draft.description;
      body.value = Number(draft.value || 0);
      if (draft.minSubtotal) body.minSubtotal = Number(draft.minSubtotal);
      if (draft.maxUses) body.maxUses = Number(draft.maxUses);
      body.firstOnly = draft.firstOnly;
      if (draft.startsAt) body.startsAt = new Date(draft.startsAt).toISOString();
      if (draft.endsAt) body.endsAt = new Date(`${draft.endsAt}T23:59:59`).toISOString();

      if (editing) {
        await api(`/discounts/${editing.id}`, { method: 'PUT', body });
        setNotice(`Discount ${draft.code} updated`);
      } else {
        await api('/discounts', {
          method: 'POST',
          body: { code: draft.code, type: draft.type, ...body },
        });
        setNotice(`Discount ${draft.code} created`);
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (d: Discount) => {
    try {
      await api(`/discounts/${d.id}`, { method: 'PUT', body: { isActive: !d.isActive } });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Toggle failed');
    }
  };

  const del = async (d: Discount) => {
    if (!confirm(`Delete discount code "${d.code}"?`)) return;
    try {
      await api(`/discounts/${d.id}`, { method: 'DELETE' });
      setNotice('Discount deleted');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const showUsage = async (d: Discount) => {
    try {
      setUsage(await api<Usage>(`/discounts/${d.id}/usage`));
    } catch (e: any) {
      setError(e?.message || 'Usage failed');
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
          title="Discount codes"
          subtitle="Percentage, fixed-amount and free-shipping promotions"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  placeholder="Search code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load(statusFilter, search)}
                  className={`${input} pl-8 !w-44`}
                />
              </div>
              <button onClick={() => load(statusFilter)} className={`${btnGhost} ${btnSm}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={openCreate} className={`${btnPrimary} ${btnSm}`}>
                <Plus className="w-3.5 h-3.5" /> New discount
              </button>
            </div>
          }
        >
          <div className="flex gap-1.5 mb-4">
            {[
              { id: '', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'expired', label: 'Expired' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setStatusFilter(f.id);
                  load(f.id, search);
                }}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  statusFilter === f.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty msg="No discount codes yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Used</th>
                    <th className="py-3 px-3">Limits</th>
                    <th className="py-3 px-3 text-right">Ends</th>
                    <th className="py-3 px-3">State</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-emerald-700">{d.code}</span>
                        {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {d.type === 'PERCENTAGE' ? `${d.value}%` : d.type === 'FIXED' ? formatPKR(d.value) : '—'}{' '}
                        <span className="text-xs text-slate-400">{typeLabel[d.type]}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {d.usedCount}
                        {d.maxUses ? ` / ${d.maxUses}` : ''}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500">
                        {d.minSubtotal ? `min ${formatPKR(d.minSubtotal)}` : 'no minimum'}
                        {d.firstOnly && ' · first order'}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-400">
                        {d.endsAt ? new Date(d.endsAt).toLocaleDateString('en-PK') : 'never'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            d.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {d.isActive ? 'ACTIVE' : 'OFF'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => showUsage(d)} className={`${btnGhost} ${btnSm}`} title="Usage stats">
                            <TicketPercent className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(d)} className={`${btnGhost} ${btnSm}`}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => toggle(d)} className={`${btnGhost} ${btnSm}`}>
                            {d.isActive ? 'Pause' : 'Enable'}
                          </button>
                          <button onClick={() => del(d)} className={btnDanger + ' !px-2'}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {modalOpen && (
        <Modal
          open
          onClose={() => setModalOpen(false)}
          title={editing ? `Edit ${editing.code}` : 'Create discount code'}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={label}>Code *</p>
                <input
                  value={draft.code}
                  disabled={!!editing}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                  placeholder="SUMMER20"
                  className={input}
                />
              </div>
              <div>
                <p className={label}>Type *</p>
                <select
                  value={draft.type}
                  disabled={!!editing}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as Discount['type'] }))}
                  className={input}
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED">Fixed (PKR)</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                </select>
              </div>
            </div>
            {draft.type !== 'FREE_SHIPPING' && (
              <div>
                <p className={label}>Value {draft.type === 'PERCENTAGE' ? '(0-100 %) *' : '(PKR) *'}</p>
                <input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value.replace(/[^\d.]/g, '') }))} className={input} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={label}>Minimum order subtotal (PKR)</p>
                <input value={draft.minSubtotal} onChange={(e) => setDraft((d) => ({ ...d, minSubtotal: e.target.value.replace(/[^\d.]/g, '') }))} className={input} />
              </div>
              <div>
                <p className={label}>Max uses (blank = unlimited)</p>
                <input value={draft.maxUses} onChange={(e) => setDraft((d) => ({ ...d, maxUses: e.target.value.replace(/\D/g, '') }))} className={input} />
              </div>
              <div>
                <p className={label}>Starts at</p>
                <input type="date" value={draft.startsAt} onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))} className={input} />
              </div>
              <div>
                <p className={label}>Ends at</p>
                <input type="date" value={draft.endsAt} onChange={(e) => setDraft((d) => ({ ...d, endsAt: e.target.value }))} className={input} />
              </div>
            </div>
            <div>
              <p className={label}>Description</p>
              <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className={input} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.firstOnly}
                disabled={!!editing}
                onChange={(e) => setDraft((d) => ({ ...d, firstOnly: e.target.checked }))}
              />
              First order only
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={busy} className={`${btnPrimary} flex-1`}>
                {busy ? 'Saving…' : editing ? 'Save' : 'Create discount'}
              </button>
              <button onClick={() => setModalOpen(false)} className={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {usage && (
        <Modal open onClose={() => setUsage(null)} title={`Usage — ${usage.discount.code}`}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatBox label="Orders using code" value={String(usage.ordersUsing)} />
            <StatBox label="Total saved by customers" value={formatPKR(usage.totalSaved)} />
            <StatBox label="Capped uses" value={`${usage.discount.usedCount} / ${usage.discount.maxUses ?? '∞'}`} />
            <StatBox label="Order value driven" value={formatPKR(usage.totalOrderValue)} />
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 rounded-lg p-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
