'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2, Check, Menu, PanelBottom } from 'lucide-react';
import { api } from '@/lib/api';
import {
  type LinkRow,
  type StoreCustomization,
  mergeStoreConfig,
  patchSection,
} from '@/lib/store-config';

export default function OnlineStoreNavigation() {
  const [cfg, setCfg] = useState<StoreCustomization | null>(null);
  const [menuLinks, setMenuLinks] = useState<LinkRow[]>([]);
  const [quickLinks, setQuickLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api<{ config: Record<string, unknown> }>('/store-settings');
      const merged = mergeStoreConfig(s.config);
      setCfg(merged);
      setMenuLinks(merged.header.menuLinks ?? []);
      setQuickLinks(merged.footer.quickLinks ?? []);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load navigation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      let next = patchSection(cfg, 'header', { menuLinks });
      next = patchSection(next, 'footer', { quickLinks });
      await api('/store-settings', { method: 'PUT', body: { config: next } });
      setCfg(next);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 2500);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const move = (rows: LinkRow[], setRows: (r: LinkRow[]) => void, i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const update = (rows: LinkRow[], setRows: (r: LinkRow[]) => void, i: number, key: keyof LinkRow, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [key]: v };
    setRows(next);
  };

  const removeRow = (rows: LinkRow[], setRows: (r: LinkRow[]) => void, i: number) =>
    setRows(rows.filter((_, idx) => idx !== i));

  const addRow = (rows: LinkRow[], setRows: (r: LinkRow[]) => void) =>
    setRows([...rows, { label: '', href: '/' }]);

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

  const LinkEditor = ({
    title,
    subtitle,
    icon: Icon,
    rows,
    setRows,
  }: {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    rows: LinkRow[];
    setRows: (r: LinkRow[]) => void;
  }) => (
    <section className="bg-white rounded-xl border border-slate-200 p-5 grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-slate-600" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{title}</p>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => addRow(rows, setRows)}
          className="flex items-center gap-1.5 border border-slate-300 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add link
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
          No links yet — add your first one.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-300 w-4 text-center">{i + 1}</span>
              <input
                value={row.label}
                onChange={(e) => update(rows, setRows, i, 'label', e.target.value)}
                placeholder="Label (e.g. New In)"
                className={`${inputCls} flex-1 min-w-0`}
              />
              <input
                value={row.href}
                onChange={(e) => update(rows, setRows, i, 'href', e.target.value)}
                placeholder="/products"
                className={`${inputCls} flex-1 min-w-0 font-mono text-[12px]`}
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => move(rows, setRows, i, -1)} title="Move up" className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(rows, setRows, i, 1)} title="Move down" className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeRow(rows, setRows, i)} title="Remove" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-[13px] py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading navigation…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-2.5">{error}</div>
      )}
      <LinkEditor
        title="Header menu"
        subtitle="Links shown in the storefront top navigation"
        icon={Menu}
        rows={menuLinks}
        setRows={setMenuLinks}
      />
      <LinkEditor
        title="Footer quick links"
        subtitle="Links shown in the storefront footer"
        icon={PanelBottom}
        rows={quickLinks}
        setRows={setQuickLinks}
      />
      <div className="flex items-center justify-end gap-3">
        {savedTick && <span className="text-[12px] font-semibold text-emerald-700">Saved ✓</span>}
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save navigation
        </button>
      </div>
    </div>
  );
}
