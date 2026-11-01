'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Trash2, Save, Building2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Card, Spinner, Empty, btnGhost, btnPrimary, btnDanger, btnSm, input, label } from '@/components/ui';
import { api, formatPKR, formatDate } from '@/lib/api';

type Tenant = {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  currency: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  logoUrl?: string | null;
  bannerUrl?: string | null;
  phoneSupport?: string | null;
  createdAt: string;
};

type ShippingRule = {
  id: string;
  city: string;
  rate: number;
  isFreeAbove?: number | null;
  createdAt: string;
};

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [rules, setRules] = useState<ShippingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // new rule form
  const [city, setCity] = useState('');
  const [rate, setRate] = useState('');
  const [freeAbove, setFreeAbove] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([api<Tenant>('/tenants/me'), api<ShippingRule[] | any>('/shipping-rules')]);
      setTenant(t);
      setRules(Array.isArray(r) ? r : r?.data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRule = async () => {
    if (!city || !rate) return;
    setBusy(true);
    setError(null);
    try {
      const body: any = { city: city.trim(), rate: Number(rate) };
      if (freeAbove) body.isFreeAbove = Number(freeAbove);
      await api('/shipping-rules', { method: 'POST', body });
      setNotice(`Shipping rule for "${city.trim()}" saved`);
      setCity('');
      setRate('');
      setFreeAbove('');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const setRuleRate = async (rule: ShippingRule, value: string) => {
    const n = Number(value.replace(/[^\d.]/g, ''));
    if (isNaN(n)) return;
    try {
      await api(`/shipping-rules/${rule.id}`, { method: 'PUT', body: { rate: n } });
      setNotice(`Rate for ${rule.city} updated to ${formatPKR(n)}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    }
  };

  const delRule = async (r: ShippingRule) => {
    if (!confirm(`Delete shipping rule for "${r.city}"?`)) return;
    try {
      await api(`/shipping-rules/${r.id}`, { method: 'DELETE' });
      setNotice('Shipping rule deleted');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

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
          title="Store profile"
          subtitle="Tenant identity served to the storefront via subdomain"
          action={
            <button onClick={load} className={`${btnGhost} ${btnSm}`}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          }
        >
          {tenant && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase">Store name</p>
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> {tenant.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Status</p>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    tenant.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tenant.status === 'TRIAL'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {tenant.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Subdomain</p>
                <p className="font-mono text-emerald-700 cursor-pointer hover:underline">
                  <a href={`http://localhost:3001`} target="_blank" rel="noreferrer">
                    {tenant.subdomain}.pakcommerce.pk ↗
                  </a>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Custom domain</p>
                <p className="text-slate-600">{tenant.customDomain || 'not configured'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Currency</p>
                <p className="text-slate-600">{tenant.currency}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Support WhatsApp / helpline</p>
                <p className="text-slate-600">{tenant.phoneSupport || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Storefront URL (dev)</p>
                <p className="font-mono text-xs text-slate-500">http://localhost:3001</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Created</p>
                <p className="text-slate-600">{formatDate(tenant.createdAt)}</p>
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Shipping rules by city"
          subtitle="Rate overrides per city; 'All Pakistan' acts as the country-wide fallback"
        >
          {/* add form */}
          <div className="flex flex-wrap items-end gap-2 mb-5 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex-1 min-w-[140px]">
              <p className={label}>City *</p>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Karachi or All Pakistan"
                className={input}
              />
            </div>
            <div className="w-28">
              <p className={label}>Rate (PKR) *</p>
              <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} className={input} />
            </div>
            <div className="w-36">
              <p className={label}>Free above (PKR)</p>
              <input
                value={freeAbove}
                onChange={(e) => setFreeAbove(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="optional"
                className={input}
              />
            </div>
            <button onClick={addRule} disabled={busy || !city || !rate} className={btnPrimary}>
              <Plus className="w-4 h-4" /> Add rule
            </button>
          </div>

          {rules.length === 0 ? (
            <Empty msg="No shipping rules yet — add one above." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 text-xs uppercase">
                <tr>
                  <th className="pb-2">City</th>
                  <th className="pb-2 text-right">Rate (editable)</th>
                  <th className="pb-2 text-center">Free above</th>
                  <th className="pb-2 text-right">Created</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-semibold text-slate-800">
                      {r.city}
                      {r.city === 'All Pakistan' && (
                        <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded">fallback</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        defaultValue={String(r.rate)}
                        onBlur={(e) => {
                          if (String(r.rate) !== e.target.value) setRuleRate(r, e.target.value);
                        }}
                        className={`${input} !w-24 text-right`}
                      />
                    </td>
                    <td className="py-2 text-center text-slate-600">
                      {r.isFreeAbove ? formatPKR(r.isFreeAbove) : '—'}
                    </td>
                    <td className="py-2 text-right text-xs text-slate-400">{formatDate(r.createdAt)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => delRule(r)} className={btnDanger + ' !px-2'}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[10px] text-slate-400 mt-3">
            Tip: press Enter inside a rate field, then click away (blur) to save.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
