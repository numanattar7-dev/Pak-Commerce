'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Palette,
  Image as ImageIcon,
  Megaphone,
  Sparkles,
  LayoutGrid,
  Menu as MenuIcon,
  PanelBottom,
  CreditCard,
  ShoppingBag,
  Search,
  RotateCcw,
  Upload,
  Trash2,
  Plus,
  FileText,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import {
  Card,
  Spinner,
  Empty,
  btnGhost,
  btnPrimary,
  btnDanger,
  btnSm,
  input,
  label,
  Pill,
} from '@/components/ui';
import { api, apiUpload, getApiBase } from '@/lib/api';

type LinkRow = { label: string; href: string };

type Customization = {
  branding: { logoUrl?: string; faviconUrl?: string; tagline?: string };
  theme: { primary?: string; accent?: string };
  announcement: { enabled?: boolean; text?: string };
  hero: {
    enabled?: boolean;
    badge?: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
  };
  sections: { showFeatures?: boolean; featuredCount?: number; aboutBlurb?: string };
  header: { menuLinks?: LinkRow[] };
  footer: {
    aboutText?: string;
    quickLinks?: LinkRow[];
    social?: { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };
    copyright?: string;
  };
  payments: { COD?: boolean; IBFT?: boolean; RAAST?: boolean; JAZZCASH?: boolean; EASYPAISA?: boolean };
  checkout: { confirmationMsg?: string; allowNotes?: boolean };
  seo: { metaTitle?: string; metaDescription?: string };
};

type StorePageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
};

const DEFAULTS: Customization = {
  branding: { logoUrl: '', faviconUrl: '', tagline: '' },
  theme: { primary: '#059669', accent: '#0d9488' },
  announcement: {
    enabled: true,
    text: 'Nationwide Delivery to 100+ Cities · Cash on Delivery Available · 7-Day Exchange',
  },
  hero: {
    enabled: true,
    badge: 'New Season · Summer Collection 2026',
    title: "Pakistan's Premium Unstitched Collection",
    subtitle:
      'Authentic lawn, cotton jacquard and festive silks with nationwide delivery — pay at your doorstep with Cash on Delivery.',
    imageUrl: '',
    ctaText: 'Shop the Collection',
    ctaLink: '/products',
  },
  sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
  header: { menuLinks: [] },
  footer: {
    aboutText:
      'Premium Pakistani unstitched fabrics — lawn, cotton jacquard and festive silks, delivered nationwide with COD.',
    quickLinks: [],
    social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
    copyright: '',
  },
  payments: { COD: true, IBFT: true, RAAST: true, JAZZCASH: true, EASYPAISA: true },
  checkout: { confirmationMsg: '', allowNotes: true },
  seo: { metaTitle: '', metaDescription: '' },
};

const COLOR_PRESETS = ['#059669', '#2563eb', '#7c3aed', '#dc2626', '#ea580c', '#0f172a', '#be185d', '#0d9488'];

export default function CustomizePage() {
  const [cfg, setCfg] = useState<Customization>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);

  // pages manager
  const [pages, setPages] = useState<StorePageRow[]>([]);
  const [pageEditing, setPageEditing] = useState<Partial<StorePageRow> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api<{ config: Record<string, unknown> }>('/store-settings'),
        api<StorePageRow[]>('/store-pages'),
      ]);
      const merged: Record<string, unknown> = {};
      for (const key of Object.keys(DEFAULTS)) {
        merged[key] = { ...(DEFAULTS as any)[key], ...((s.config as any)?.[key] ?? {}) };
      }
      setCfg(merged as unknown as Customization);
      setPages(Array.isArray(p) ? p : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load customization');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (section: keyof Customization, key: string, value: unknown) => {
    setCfg((c) => ({
      ...c,
      [section]: { ...(c[section] as Record<string, unknown>), [key]: value },
    }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/store-settings', { method: 'PUT', body: { config: cfg } });
      setNotice('Store customization saved — refresh your storefront to see it live');
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    if (!confirm('Reset everything back to the default look? You still need to press Save.')) return;
    setCfg(JSON.parse(JSON.stringify(DEFAULTS)));
  };

  const upload = async (section: keyof Customization, key: string, file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiUpload<{ url: string }>('/products/upload-image', file);
      set(section, key, res.url);
      setNotice('Image uploaded — press Save to apply');
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const resolveImg = (src?: string) =>
    src ? (src.startsWith('http') ? src : `${getApiBase()}/${src.replace(/^\/+/, '')}`) : '';

  // ---------------- pages CRUD ----------------

  const savePage = async () => {
    if (!pageEditing?.title?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (pageEditing.id) {
        await api(`/store-pages/${pageEditing.id}`, {
          method: 'PUT',
          body: {
            title: pageEditing.title,
            slug: pageEditing.slug || undefined,
            content: pageEditing.content || '',
            isPublished: pageEditing.isPublished ?? false,
          },
        });
      } else {
        await api('/store-pages', {
          method: 'POST',
          body: {
            title: pageEditing.title,
            slug: pageEditing.slug || undefined,
            content: pageEditing.content || '',
            isPublished: pageEditing.isPublished ?? false,
          },
        });
      }
      setNotice('Page saved');
      setPageEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const delPage = async (p: StorePageRow) => {
    if (!confirm(`Delete page "${p.title}"?`)) return;
    try {
      await api(`/store-pages/${p.id}`, { method: 'DELETE' });
      setNotice('Page deleted');
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

  const linksOf = (arr: LinkRow[] | undefined) => arr ?? [];

  return (
    <AppShell>
      <div className="space-y-5">
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-between">
            <span>{notice}</span>
            <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="text-xs font-bold underline">
              View storefront ↗
            </a>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>
        )}

        {/* sticky save bar */}
        <div className="sticky top-16 z-20 bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="font-black text-slate-900 flex items-center gap-2">
              <Palette className="w-4.5 h-4.5 text-[var(--pk-primary)]" /> Customize Store
            </h1>
            <p className="text-[11px] text-slate-400">Every visible part of your storefront, in one place</p>
          </div>
          <div className="flex gap-2">
            <button onClick={resetAll} className={`${btnGhost} ${btnSm}`} title="Reset to defaults">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={save} disabled={busy} className={btnPrimary}>
              {busy ? 'Saving…' : <><Check className="w-4 h-4" /> Save all changes</>}
            </button>
          </div>
        </div>

        {/* 1. Branding */}
        <Card title="Branding" subtitle="Logo, favicon and tagline shown in the header and footer">
          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <p className={label}>Logo</p>
              <div className="flex items-center gap-3">
                {cfg.branding.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={resolveImg(cfg.branding.logoUrl)} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => logoInput.current?.click()} className={`${btnGhost} ${btnSm}`}>
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  {cfg.branding.logoUrl && (
                    <button onClick={() => set('branding', 'logoUrl', '')} className={`${btnDanger} ${btnSm}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => upload('branding', 'logoUrl', e.target.files?.[0])} />
              </div>
            </div>
            <div>
              <p className={label}>Favicon (browser tab icon)</p>
              <div className="flex items-center gap-3">
                {cfg.branding.faviconUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={resolveImg(cfg.branding.faviconUrl)} alt="favicon" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-bold">?</div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={() => faviconInput.current?.click()} className={`${btnGhost} ${btnSm}`}>
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  {cfg.branding.faviconUrl && (
                    <button onClick={() => set('branding', 'faviconUrl', '')} className={`${btnDanger} ${btnSm}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input ref={faviconInput} type="file" accept="image/*" hidden onChange={(e) => upload('branding', 'faviconUrl', e.target.files?.[0])} />
              </div>
            </div>
            <div>
              <p className={label}>Tagline (under store name)</p>
              <input
                value={cfg.branding.tagline || ''}
                onChange={(e) => set('branding', 'tagline', e.target.value)}
                placeholder="e.g. Pure Fabrics Since 1995"
                className={input}
              />
            </div>
          </div>
        </Card>

        {/* 2. Theme colors */}
        <Card title="Theme colors" subtitle="Your brand colors — the whole storefront recolors instantly">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <p className={label}>Primary color</p>
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.theme.primary || '#059669'} onChange={(e) => set('theme', 'primary', e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                {COLOR_PRESETS.map((c) => (
                  <button key={c} onClick={() => set('theme', 'primary', c)} className={`w-8 h-8 rounded-lg border-2 ${cfg.theme.primary === c ? 'border-slate-900' : 'border-transparent'} shadow-sm`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <p className={label}>Accent color (highlights & links)</p>
              <div className="flex items-center gap-2">
                <input type="color" value={cfg.theme.accent || '#0d9488'} onChange={(e) => set('theme', 'accent', e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                {COLOR_PRESETS.slice().reverse().map((c) => (
                  <button key={c} onClick={() => set('theme', 'accent', c)} className={`w-8 h-8 rounded-lg border-2 ${cfg.theme.accent === c ? 'border-slate-900' : 'border-transparent'} shadow-sm`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Announcement bar */}
        <Card title="Announcement bar" subtitle="The strip at the very top of every page">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={cfg.announcement.enabled !== false} onChange={(e) => set('announcement', 'enabled', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Show announcement bar
            </label>
            <div>
              <p className={label}>Text</p>
              <input value={cfg.announcement.text || ''} onChange={(e) => set('announcement', 'text', e.target.value)} className={input} />
            </div>
          </div>
        </Card>

        {/* 4. Hero */}
        <Card title="Hero section" subtitle="The big banner at the top of your home page">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={cfg.hero.enabled !== false} onChange={(e) => set('hero', 'enabled', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Show hero section
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className={label}>Small badge text</p>
                <input value={cfg.hero.badge || ''} onChange={(e) => set('hero', 'badge', e.target.value)} className={input} />
              </div>
              <div>
                <p className={label}>Button text</p>
                <input value={cfg.hero.ctaText || ''} onChange={(e) => set('hero', 'ctaText', e.target.value)} className={input} />
              </div>
              <div className="md:col-span-2">
                <p className={label}>Main heading</p>
                <input value={cfg.hero.title || ''} onChange={(e) => set('hero', 'title', e.target.value)} className={input} />
              </div>
              <div className="md:col-span-2">
                <p className={label}>Sub-heading</p>
                <textarea rows={2} value={cfg.hero.subtitle || ''} onChange={(e) => set('hero', 'subtitle', e.target.value)} className={input} />
              </div>
              <div>
                <p className={label}>Button link</p>
                <input value={cfg.hero.ctaLink || ''} onChange={(e) => set('hero', 'ctaLink', e.target.value)} placeholder="/products" className={input} />
              </div>
              <div>
                <p className={label}>Hero image (optional — defaults to latest product)</p>
                <div className="flex items-center gap-2">
                  {cfg.hero.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={resolveImg(cfg.hero.imageUrl)} alt="" className="w-10 h-12 rounded-lg object-cover border border-slate-200" />
                  )}
                  <button onClick={() => heroInput.current?.click()} className={`${btnGhost} ${btnSm}`}>
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>
                  {cfg.hero.imageUrl && (
                    <button onClick={() => set('hero', 'imageUrl', '')} className={`${btnDanger} ${btnSm}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input ref={heroInput} type="file" accept="image/*" hidden onChange={(e) => upload('hero', 'imageUrl', e.target.files?.[0])} />
              </div>
            </div>
          </div>
        </Card>

        {/* 5. Home sections */}
        <Card title="Home page sections" subtitle="What appears on the home page and how much">
          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={cfg.sections.showFeatures !== false} onChange={(e) => set('sections', 'showFeatures', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Show feature highlights
            </label>
            <div>
              <p className={label}>Featured products shown</p>
              <input
                value={String(cfg.sections.featuredCount ?? 8)}
                onChange={(e) => set('sections', 'featuredCount', Number(e.target.value.replace(/\D/g, '')) || 8)}
                className={`${input} !w-24`}
              />
            </div>
            <div>
              <p className={label}>Home blurb (optional)</p>
              <input value={cfg.sections.aboutBlurb || ''} onChange={(e) => set('sections', 'aboutBlurb', e.target.value)} className={input} />
            </div>
          </div>
        </Card>

        {/* 6. Header menu links */}
        <Card title="Header menu" subtitle="Extra links in the top navigation (home, shop, track are always there)">
          <div className="space-y-2">
            {linksOf(cfg.header.menuLinks).map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={l.label}
                  placeholder="Label (e.g. Sale)"
                  onChange={(e) => {
                    const arr = [...linksOf(cfg.header.menuLinks)];
                    arr[i] = { ...arr[i], label: e.target.value };
                    set('header', 'menuLinks', arr);
                  }}
                  className={`${input} !w-44`}
                />
                <input
                  value={l.href}
                  placeholder="/products?search=sale"
                  onChange={(e) => {
                    const arr = [...linksOf(cfg.header.menuLinks)];
                    arr[i] = { ...arr[i], href: e.target.value };
                    set('header', 'menuLinks', arr);
                  }}
                  className={input}
                />
                <button
                  onClick={() => set('header', 'menuLinks', linksOf(cfg.header.menuLinks).filter((_, x) => x !== i))}
                  className={`${btnDanger} ${btnSm}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => set('header', 'menuLinks', [...linksOf(cfg.header.menuLinks), { label: '', href: '' }])}
              className={`${btnGhost} ${btnSm}`}
            >
              <Plus className="w-3.5 h-3.5" /> Add menu link
            </button>
          </div>
        </Card>

        {/* 7. Footer */}
        <Card title="Footer" subtitle="About text, quick links, social media and copyright">
          <div className="space-y-4">
            <div>
              <p className={label}>About text</p>
              <textarea rows={2} value={cfg.footer.aboutText || ''} onChange={(e) => set('footer', 'aboutText', e.target.value)} className={input} />
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <p className={label}>WhatsApp number</p>
                <input value={cfg.footer.social?.whatsapp || ''} onChange={(e) => set('footer', 'social', { ...cfg.footer.social, whatsapp: e.target.value })} placeholder="0321…" className={input} />
              </div>
              <div>
                <p className={label}>Instagram URL</p>
                <input value={cfg.footer.social?.instagram || ''} onChange={(e) => set('footer', 'social', { ...cfg.footer.social, instagram: e.target.value })} placeholder="https://instagram.com/…" className={input} />
              </div>
              <div>
                <p className={label}>Facebook URL</p>
                <input value={cfg.footer.social?.facebook || ''} onChange={(e) => set('footer', 'social', { ...cfg.footer.social, facebook: e.target.value })} className={input} />
              </div>
              <div>
                <p className={label}>TikTok URL</p>
                <input value={cfg.footer.social?.tiktok || ''} onChange={(e) => set('footer', 'social', { ...cfg.footer.social, tiktok: e.target.value })} className={input} />
              </div>
            </div>
            <div className="space-y-2">
              {linksOf(cfg.footer.quickLinks).map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={l.label}
                    placeholder="Label (e.g. About Us)"
                    onChange={(e) => {
                      const arr = [...linksOf(cfg.footer.quickLinks)];
                      arr[i] = { ...arr[i], label: e.target.value };
                      set('footer', 'quickLinks', arr);
                    }}
                    className={`${input} !w-44`}
                  />
                  <input
                    value={l.href}
                    placeholder="/p/about-us or /products"
                    onChange={(e) => {
                      const arr = [...linksOf(cfg.footer.quickLinks)];
                      arr[i] = { ...arr[i], href: e.target.value };
                      set('footer', 'quickLinks', arr);
                    }}
                    className={input}
                  />
                  <button
                    onClick={() => set('footer', 'quickLinks', linksOf(cfg.footer.quickLinks).filter((_, x) => x !== i))}
                    className={`${btnDanger} ${btnSm}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => set('footer', 'quickLinks', [...linksOf(cfg.footer.quickLinks), { label: '', href: '' }])}
                className={`${btnGhost} ${btnSm}`}
              >
                <Plus className="w-3.5 h-3.5" /> Add quick link
              </button>
            </div>
            <div>
              <p className={label}>Copyright note</p>
              <input value={cfg.footer.copyright || ''} onChange={(e) => set('footer', 'copyright', e.target.value)} placeholder="All rights reserved" className={input} />
            </div>
          </div>
        </Card>

        {/* 8. Payments */}
        <Card title="Payment methods" subtitle="Which methods customers can choose at checkout">
          <div className="flex flex-wrap gap-4">
            {(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-400 transition">
                <input
                  type="checkbox"
                  checked={cfg.payments[m] !== false}
                  onChange={(e) => set('payments', m, e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                {m}
              </label>
            ))}
          </div>
        </Card>

        {/* 9. Checkout */}
        <Card title="Checkout" subtitle="Extra message and fields during checkout">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className={label}>Confirmation message (on order page)</p>
              <input value={cfg.checkout.confirmationMsg || ''} onChange={(e) => set('checkout', 'confirmationMsg', e.target.value)} placeholder="e.g. Shukriya! We will call to confirm." className={input} />
            </div>
            <label className="flex items-end gap-2 text-sm font-semibold text-slate-700 cursor-pointer pb-2">
              <input type="checkbox" checked={cfg.checkout.allowNotes !== false} onChange={(e) => set('checkout', 'allowNotes', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              Show order notes field
            </label>
          </div>
        </Card>

        {/* 10. SEO */}
        <Card title="SEO" subtitle="How your store appears on Google">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className={label}>Meta title</p>
              <input value={cfg.seo.metaTitle || ''} onChange={(e) => set('seo', 'metaTitle', e.target.value)} className={input} />
            </div>
            <div>
              <p className={label}>Meta description</p>
              <input value={cfg.seo.metaDescription || ''} onChange={(e) => set('seo', 'metaDescription', e.target.value)} className={input} />
            </div>
          </div>
        </Card>

        {/* 11. Custom pages */}
        <Card title="Custom pages" subtitle="About Us, FAQ, Privacy Policy — published at /p/your-slug">
          {pageEditing ? (
            <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className={label}>Title *</p>
                  <input
                    value={pageEditing.title || ''}
                    onChange={(e) => setPageEditing({ ...pageEditing, title: e.target.value })}
                    placeholder="About Us"
                    className={input}
                  />
                </div>
                <div>
                  <p className={label}>Slug (URL — leave empty to auto-generate)</p>
                  <input
                    value={pageEditing.slug || ''}
                    onChange={(e) => setPageEditing({ ...pageEditing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="about-us"
                    className={input}
                  />
                </div>
              </div>
              <div>
                <p className={label}>Content</p>
                <textarea
                  rows={7}
                  value={pageEditing.content || ''}
                  onChange={(e) => setPageEditing({ ...pageEditing, content: e.target.value })}
                  placeholder="Write your page content here…"
                  className={input}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pageEditing.isPublished ?? false}
                  onChange={(e) => setPageEditing({ ...pageEditing, isPublished: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                Published (visible on the storefront)
              </label>
              <div className="flex gap-2">
                <button onClick={savePage} disabled={busy || !pageEditing.title?.trim()} className={btnPrimary}>
                  <Check className="w-4 h-4" /> Save page
                </button>
                <button onClick={() => setPageEditing(null)} className={`${btnGhost} ${btnSm}`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {pages.length === 0 ? (
                <Empty msg="No custom pages yet. Add an About Us or FAQ page." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="pb-2">Title</th>
                      <th className="pb-2">URL</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pages.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 font-bold text-slate-800">{p.title}</td>
                        <td className="py-2.5 font-mono text-xs text-slate-500">/p/{p.slug}</td>
                        <td className="py-2.5"><Pill value={p.isPublished ? 'ACTIVE' : 'PAUSED'} /></td>
                        <td className="py-2.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setPageEditing({ ...p })}
                              className={`${btnGhost} ${btnSm}`}
                            >
                              Edit
                            </button>
                            <button onClick={() => delPage(p)} className={`${btnDanger} ${btnSm}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button onClick={() => setPageEditing({ title: '', content: '', isPublished: false })} className={`${btnGhost} mt-3`}>
                <Plus className="w-4 h-4" /> New page
              </button>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
