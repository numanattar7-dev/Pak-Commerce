'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Pencil, Search, Phone } from 'lucide-react';
import AppShell from '@/components/AppShell';
import {
  Card,
  Modal,
  Spinner,
  Empty,
  Pill,
  btnGhost,
  btnPrimary,
  btnDanger,
  btnSm,
  input,
  label,
} from '@/components/ui';
import { api, formatPKR, formatDate } from '@/lib/api';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags: string[];
  notes?: string | null;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
};

type CustomerDetail = Customer & {
  addresses: Array<{ id: string; city: string; address: string; isDefault: boolean }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    paymentMethod: string;
    orderStatus: string;
    riskScore: string;
    createdAt: string;
  }>;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cNotes, setCNotes] = useState('');

  const load = useCallback(
    async (q = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: '1', limit: '30' });
        if (q.trim()) params.set('search', q.trim());
        const res = await api<{ data: Customer[]; meta: any }>(`/customers?${params.toString()}`);
        setRows(res.data || (res as any) || []);
        setMeta(res.meta || null);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    load('');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (c: Customer) => {
    try {
      setDetail(await api<CustomerDetail>(`/customers/${c.id}`));
    } catch (e: any) {
      setError(e?.message || 'Failed to load customer');
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/customers', {
        method: 'POST',
        body: { name: cName, phone: cPhone, email: cEmail || undefined, notes: cNotes || undefined },
      });
      setNotice('Customer created');
      setCreateOpen(false);
      setCName('');
      setCPhone('');
      setCEmail('');
      setCNotes('');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"? Orders will be kept as guest orders.`)) return;
    try {
      await api(`/customers/${c.id}`, { method: 'DELETE' });
      setNotice('Customer deleted');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
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
          title="Customers"
          subtitle={meta ? `${meta.total} CRM profiles` : '—'}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  placeholder="Search name / phone / email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load(search)}
                  className={`${input} pl-8 !w-56`}
                />
              </div>
              <button onClick={() => load()} className={`${btnGhost} ${btnSm}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setCreateOpen(true)} className={`${btnPrimary} ${btnSm}`}>
                <Plus className="w-3.5 h-3.5" /> New customer
              </button>
            </div>
          }
        >
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty msg="No customers yet — profiles are created automatically at checkout." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Phone</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Total spent</th>
                    <th className="py-3 px-3 text-right">Joined</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <button onClick={() => openDetail(c)} className="font-semibold text-emerald-700 hover:underline">
                          {c.name}
                        </button>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="py-3 px-3 text-right font-semibold">{c.ordersCount}</td>
                      <td className="py-3 px-3 text-right font-bold">{formatPKR(c.totalSpent)}</td>
                      <td className="py-3 px-3 text-right text-xs text-slate-400">{formatDate(c.createdAt)}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => openDetail(c)} className={`${btnGhost} ${btnSm}`}>
                            View
                          </button>
                          <button onClick={() => del(c)} className={btnDanger + ' !px-2'}>
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

      {/* detail modal */}
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={detail.name} wide>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div>
              <p className="text-xs text-slate-400 uppercase">Phone</p>
              <p className="font-mono">{detail.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Email</p>
              <p>{detail.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Orders</p>
              <p className="font-bold">{detail.ordersCount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase">Total spent</p>
              <p className="font-bold text-emerald-700">{formatPKR(detail.totalSpent)}</p>
            </div>
            {detail.notes && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 uppercase">Notes</p>
                <p className="text-slate-600">{detail.notes}</p>
              </div>
            )}
            {detail.addresses.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-slate-400 uppercase mb-1">Addresses</p>
                {detail.addresses.map((a) => (
                  <p key={a.id} className="text-slate-600">
                    {a.address} — <b>{a.city}</b>
                    {a.isDefault && <span className="text-xs text-emerald-600 ml-1">(default)</span>}
                  </p>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Recent orders</p>
          {detail.orders.length === 0 ? (
            <p className="text-sm text-slate-400">No orders.</p>
          ) : (
            <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg">
              {detail.orders.map((o) => (
                <a
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{o.orderNumber}</span>
                    <Pill value={o.orderStatus} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatPKR(o.totalAmount)}</span>
                    <span className="text-xs text-slate-400">{formatDate(o.createdAt)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* create modal */}
      {createOpen && (
        <Modal open onClose={() => setCreateOpen(false)} title="New customer">
          <div className="space-y-3">
            <div>
              <p className={label}>Name *</p>
              <input value={cName} onChange={(e) => setCName(e.target.value)} className={input} />
            </div>
            <div>
              <p className={label}>Phone (03XXXXXXXXX) *</p>
              <input
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="03001234567"
                className={input}
              />
            </div>
            <div>
              <p className={label}>Email</p>
              <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} className={input} />
            </div>
            <div>
              <p className={label}>Notes</p>
              <input value={cNotes} onChange={(e) => setCNotes(e.target.value)} className={input} />
            </div>
            <button onClick={create} disabled={busy || !cName || cPhone.length !== 11} className={`${btnPrimary} w-full`}>
              {busy ? 'Saving…' : 'Create customer'}
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
