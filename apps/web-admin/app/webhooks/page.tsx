'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Send, Webhook as WebhookIcon } from 'lucide-react';
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
import { api, formatDate } from '@/lib/api';

type Webhook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: 'ACTIVE' | 'PAUSED';
  _count?: { deliveries: number };
};

type Delivery = {
  id: string;
  event: string;
  responseCode?: number | null;
  attempts: number;
  success: boolean;
  status: string;
  lastAttempt?: string | null;
  error?: string | null;
};

const ALL_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.fulfilled',
  'order.shipped',
  'order.refunded',
  'webhook.test',
];

export default function WebhooksPage() {
  const [rows, setRows] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<Set<string>>(new Set(['order.created']));
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<{ hook: Webhook; items: Delivery[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Webhook[] | any>('/webhooks');
      setRows(Array.isArray(res) ? res : res?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setUrl('');
    setEvents(new Set(['order.created']));
    setStatus('ACTIVE');
    setModalOpen(true);
  };

  const openEdit = (w: Webhook) => {
    setEditing(w);
    setUrl(w.url);
    setEvents(new Set(w.events));
    setStatus(w.status);
    setModalOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: any = { url, events: Array.from(events), status };
      if (editing) {
        await api(`/webhooks/${editing.id}`, { method: 'PUT', body });
        setNotice('Webhook updated');
      } else {
        const created = await api<Webhook>('/webhooks', { method: 'POST', body });
        setNewSecret(created.secret);
        setNotice('Webhook created');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const del = async (w: Webhook) => {
    if (!confirm(`Delete webhook endpoint "${w.url}"?`)) return;
    try {
      await api(`/webhooks/${w.id}`, { method: 'DELETE' });
      setNotice('Webhook deleted');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const toggle = async (w: Webhook) => {
    try {
      await api(`/webhooks/${w.id}`, { method: 'PUT', body: { status: w.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Toggle failed');
    }
  };

  const sendTest = async (w: Webhook) => {
    setBusy(true);
    try {
      await api(`/webhooks/${w.id}/test`, { method: 'POST' });
      setNotice('Test payload queued — check deliveries in ~10s');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  };

  const openDeliveries = async (w: Webhook) => {
    try {
      const items = await api<Delivery[] | any>(`/webhooks/${w.id}/deliveries?limit=25`);
      setDeliveries({ hook: w, items: Array.isArray(items) ? items : items?.data || [] });
    } catch (e: any) {
      setError(e?.message || 'Failed to load deliveries');
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
          title="Webhook endpoints"
          subtitle="Events are delivered with an X-Pak-Commerce-Signature header (HMAC-SHA256). Retries: 32s → 2m → 10m → 30m → 2h."
          action={
            <div className="flex gap-2">
              <button onClick={load} className={`${btnGhost} ${btnSm}`}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={openCreate} className={`${btnPrimary} ${btnSm}`}>
                <Plus className="w-3.5 h-3.5" /> New endpoint
              </button>
            </div>
          }
        >
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty msg="No webhook endpoints registered." />
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((w) => (
                <div key={w.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <WebhookIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800 truncate">{w.url}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            w.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {w.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        sign key: <span className="font-mono">{w.secret.slice(0, 14)}…</span> ·{' '}
                        {w._count?.deliveries ?? 0} deliveries
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {w.events.map((ev) => (
                          <span key={ev} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                      <button onClick={() => sendTest(w)} disabled={busy} className={`${btnGhost} ${btnSm}`}>
                        <Send className="w-3 h-3" /> Test
                      </button>
                      <button onClick={() => openDeliveries(w)} className={`${btnGhost} ${btnSm}`}>
                        Deliveries
                      </button>
                      <button onClick={() => toggle(w)} className={`${btnGhost} ${btnSm}`}>
                        {w.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => openEdit(w)} className={`${btnGhost} ${btnSm}`}>
                        Edit
                      </button>
                      <button onClick={() => del(w)} className={btnDanger + ' !px-2'}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {modalOpen && (
        <Modal open onClose={() => setModalOpen(false)} title={editing ? 'Edit webhook endpoint' : 'New webhook endpoint'}>
          <div className="space-y-3">
            <div>
              <p className={label}>Target URL *</p>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.example.com/hooks"
                className={input}
              />
            </div>
            <div>
              <p className={label}>Events *</p>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-50 max-h-52 overflow-y-auto">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={events.has(ev)}
                      onChange={(e) =>
                        setEvents((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(ev);
                          else next.delete(ev);
                          return next;
                        })
                      }
                    />
                    <span className="font-mono text-xs text-slate-700">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className={label}>State</p>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={input}>
                <option value="ACTIVE">ACTIVE — delivery enabled</option>
                <option value="PAUSED">PAUSED — skip deliveries</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={busy || !url || events.size === 0} className={`${btnPrimary} flex-1`}>
                {busy ? 'Saving…' : editing ? 'Save endpoint' : 'Create endpoint'}
              </button>
              <button onClick={() => setModalOpen(false)} className={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {newSecret && (
        <Modal open onClose={() => setNewSecret(null)} title="Endpoint created — copy your signing secret">
          <p className="text-sm text-slate-600 mb-3">
            This secret is used to sign the <code className="bg-slate-100 px-1">X-Pak-Commerce-Signature</code> header. Copy it
            now, the full value is not shown again.
          </p>
          <div className="bg-slate-900 text-emerald-300 font-mono text-xs p-3 rounded-lg break-all">{newSecret}</div>
          <button onClick={() => setNewSecret(null)} className={`${btnPrimary} w-full mt-3`}>
            I saved it
          </button>
        </Modal>
      )}

      {deliveries && (
        <Modal open onClose={() => setDeliveries(null)} title={`Deliveries — ${deliveries.hook.url}`} wide>
          {deliveries.items.length === 0 ? (
            <Empty msg="No deliveries recorded yet." />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 uppercase">
                <tr>
                  <th className="pb-2">Event</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">HTTP</th>
                  <th className="pb-2 text-right">Attempts</th>
                  <th className="pb-2 text-right">Last attempt</th>
                  <th className="pb-2 pl-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deliveries.items.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 font-mono">{d.event}</td>
                    <td className="py-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">{d.responseCode ?? '—'}</td>
                    <td className="py-2 text-right">{d.attempts}</td>
                    <td className="py-2 text-right text-slate-400">{formatDate(d.lastAttempt)}</td>
                    <td className="py-2 pl-3 text-slate-400 max-w-xs truncate" title={d.error || ''}>
                      {d.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </AppShell>
  );
}
