'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Search, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import {
  type StoreCustomization,
  mergeStoreConfig,
  patchSection,
} from '@/lib/store-config';

export default function OnlineStorePreferences() {
  const [cfg, setCfg] = useState<StoreCustomization | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [announcementText, setAnnouncementText] = useState('');
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
      setMetaTitle(merged.seo.metaTitle ?? '');
      setMetaDescription(merged.seo.metaDescription ?? '');
      setAnnouncementEnabled(merged.announcement.enabled ?? true);
      setAnnouncementText(merged.announcement.text ?? '');
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load preferences');
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
      let next = patchSection(cfg, 'seo', { metaTitle, metaDescription });
      next = patchSection(next, 'announcement', {
        enabled: announcementEnabled,
        text: announcementText,
      });
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

  const inputCls =
    'w-full rounded-lg border border-slate-300 px-3 py-[7px] text-[13px] outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-[13px] py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-2.5">{error}</div>
      )}

      {/* ── search engine listing (Shopify “Preferences”) ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 grid gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Search className="w-4 h-4 text-slate-600" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-slate-900">Search engine listing</p>
            <p className="text-[11px] text-slate-500">How your store appears on Google and social shares</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1">Homepage title</p>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="Khaadi Unstitched — Premium Lawn & Fabrics"
            className={inputCls}
          />
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1">Homepage meta description</p>
          <textarea
            rows={3}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Authentic lawn, jacquard and festive silks — delivered nationwide, cash on delivery."
            className={inputCls}
          />
        </div>
        {/* live Google-style snippet */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[11px] text-emerald-800">pakcommerce.pk</p>
          <p className="text-[14px] text-[#1a0dab] leading-snug truncate">
            {metaTitle || 'Your store homepage title'}
          </p>
          <p className="text-[12px] text-slate-600 leading-snug line-clamp-2">
            {metaDescription || 'Your meta description will appear here — keep it under ~160 characters.'}
          </p>
        </div>
      </section>

      {/* ── announcement bar ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 grid gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-slate-600" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-slate-900">Announcement bar</p>
            <p className="text-[11px] text-slate-500">A thin banner shown at the top of every storefront page</p>
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
          <span className="text-[13px] text-slate-700">Show announcement</span>
          <button
            type="button"
            onClick={() => setAnnouncementEnabled((v) => !v)}
            className={`w-9 h-5 rounded-full transition relative ${announcementEnabled ? 'bg-slate-900' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                announcementEnabled ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
        <div>
          <p className="text-[11px] font-medium text-slate-500 mb-1">Announcement text</p>
          <input
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="Nationwide delivery · COD available · 7-day exchange"
            className={inputCls}
            disabled={!announcementEnabled}
          />
        </div>
        {announcementEnabled && announcementText && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[12px] px-4 py-2 text-center font-medium">
            {announcementText}
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        {savedTick && <span className="text-[12px] font-semibold text-emerald-700">Saved ✓</span>}
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 bg-slate-900 text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save preferences
        </button>
      </div>
    </div>
  );
}
