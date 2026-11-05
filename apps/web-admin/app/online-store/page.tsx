'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Store,
  Copy,
  Check,
  FileText,
  Menu,
  Settings,
  ExternalLink,
  Eye,
  Megaphone,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  type StoreCustomization,
  type StorePageRow,
  mergeStoreConfig,
} from '@/lib/store-config';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3001';

export default function OnlineStoreOverview() {
  const [cfg, setCfg] = useState<StoreCustomization | null>(null);
  const [pages, setPages] = useState<StorePageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p] = await Promise.all([
        api<{ config: Record<string, unknown> }>('/store-settings'),
        api<StorePageRow[]>('/store-pages'),
      ]);
      setCfg(mergeStoreConfig(s.config));
      setPages(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Failed to load online store');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(STOREFRONT_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const published = pages.filter((p) => p.isPublished).length;
  const drafts = pages.length - published;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-[13px] py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading online store…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-[13px] px-4 py-3">
        {error}
        <button onClick={load} className="ml-3 underline font-semibold">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* ── channel card (Shopify-style) ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#95bf47] flex items-center justify-center shrink-0">
          <Store className="w-6 h-6 text-[#1a1a1a]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sales channel</p>
          <h2 className="text-[15px] font-bold text-slate-900">Online Store</h2>
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="truncate">{STOREFRONT_URL.replace(/^https?:\/\//, '')}</span>
            <button
              onClick={copyLink}
              title="Copy store link"
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 bg-slate-900 text-white px-3.5 py-2 rounded-lg text-[12px] font-semibold hover:bg-slate-800 transition shrink-0"
        >
          <Eye className="w-4 h-4" /> View store <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      </section>

      {/* ── quick status row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pages</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{pages.length}</p>
          <p className="text-[11px] text-slate-500">{published} published · {drafts} drafts</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Announcement</p>
          <p className="text-[12px] font-semibold text-slate-800 mt-1 leading-snug">
            {cfg?.announcement?.enabled ? 'Showing on storefront' : 'Hidden'}
          </p>
          <p className="text-[11px] text-slate-500 line-clamp-1">{cfg?.announcement?.text || '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SEO title</p>
          <p className="text-[12px] font-semibold text-slate-800 mt-1 leading-snug line-clamp-2">
            {cfg?.seo?.metaTitle || 'Not set — add one in Preferences'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{cfg?.header?.menuLinks?.length ?? 0}</p>
          <p className="text-[11px] text-slate-500">menu links in header</p>
        </div>
      </div>

      {/* ── section cards ── */}
      <div className="grid md:grid-cols-3 gap-3">
        <a
          href="/online-store/pages"
          className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition"
        >
          <FileText className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
          <p className="mt-2 text-[13px] font-bold text-slate-900">Pages</p>
          <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">
            Create and publish custom pages — About us, FAQ, shipping, policies.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">
            Manage pages <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </a>
        <a
          href="/online-store/navigation"
          className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition"
        >
          <Menu className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
          <p className="mt-2 text-[13px] font-bold text-slate-900">Navigation</p>
          <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">
            Edit the header menu and footer quick links shown on your storefront.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">
            Manage menus <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </a>
        <a
          href="/online-store/preferences"
          className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition"
        >
          <Settings className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
          <p className="mt-2 text-[13px] font-bold text-slate-900">Preferences</p>
          <p className="mt-0.5 text-[12px] text-slate-500 leading-snug">
            Search engine listing, announcement bar and storefront preferences.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">
            Edit preferences <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </a>
      </div>

      {/* ── announcement preview ── */}
      {cfg?.announcement?.enabled && cfg?.announcement?.text ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2 text-[12px] text-amber-900">
          <Megaphone className="w-4 h-4 shrink-0" />
          <span className="truncate">{cfg.announcement.text}</span>
        </div>
      ) : null}
    </div>
  );
}
