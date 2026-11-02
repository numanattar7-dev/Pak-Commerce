'use client';

// ---------------------------------------------------------------------------
// Store context — loads the tenant catalog + customization ONCE and shares it
// across pages (products, categories, store identity, theme, content).
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  StoreCustomization,
  StoreProduct,
  fetchStoreCustomization,
  fetchStoreProducts,
  getApiBase,
  mapStoreProduct,
} from './api';

type StoreInfo = { name: string; subdomain: string };

/** Defaults mirror the original hardcoded storefront — stores look identical until customized. */
export const DEFAULT_CUSTOMIZATION: StoreCustomization = {
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

/** Shallow-merge top-level sections so merchants only override what they set. */
function mergeConfig(
  base: StoreCustomization,
  override: Record<string, unknown> | undefined,
): StoreCustomization {
  if (!override) return base;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const o = override[key];
    if (o === undefined || o === null) {
      out[key] = (base as Record<string, unknown>)[key];
    } else if (typeof o === 'object' && !Array.isArray(o)) {
      out[key] = { ...((base as Record<string, unknown>)[key] as object), ...(o as object) };
    } else {
      out[key] = o;
    }
  }
  return out as unknown as StoreCustomization;
}

type StoreContextValue = {
  store: StoreInfo | null;
  products: StoreProduct[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  categories: string[];
  findByKey: (key: string) => StoreProduct | undefined;
  customization: StoreCustomization;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customization, setCustomization] = useState<StoreCustomization>(DEFAULT_CUSTOMIZATION);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStoreProducts(1, 60);
      setStore(res.store ?? null);
      setProducts((res.data || []).map(mapStoreProduct));
    } catch (e: any) {
      setError(e?.message || 'Failed to load store');
    } finally {
      setLoading(false);
    }
  }, []);

  // Customization loads independently — the shop still works if it fails
  useEffect(() => {
    fetchStoreCustomization()
      .then((r) => setCustomization(mergeConfig(DEFAULT_CUSTOMIZATION, r.config)))
      .catch(() => setCustomization(DEFAULT_CUSTOMIZATION));
  }, []);

  // LIVE PREVIEW (theme editor): the admin panel pushes its draft config here
  // via postMessage while the merchant types. Origin-checked for safety.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        if (!e.data || e.data.type !== 'pk-preview-config') return;
        if (e.origin === window.location.origin) return; // never accept from the storefront's own origin
        const adminHost = new URL(e.origin).hostname;
        const sameMachine = adminHost === 'localhost' || adminHost === '127.0.0.1';
        const trustedDomain = /(^|\.)vercel\.app$/.test(adminHost) || /pakcommerce\.pk$/.test(adminHost);
        if (!sameMachine && !trustedDomain) return;
        if (e.data.config && typeof e.data.config === 'object') {
          setCustomization(mergeConfig(DEFAULT_CUSTOMIZATION, e.data.config));
        }
      } catch {
        /* ignore malformed messages */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply the merchant's theme colors as CSS variables + favicon
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pk-primary', customization.theme.primary || '#059669');
    root.style.setProperty('--pk-accent', customization.theme.accent || '#0d9488');
    if (customization.branding.faviconUrl) {
      const fav = customization.branding.faviconUrl.startsWith('http')
        ? customization.branding.faviconUrl
        : `${getApiBase()}/${customization.branding.faviconUrl.replace(/^\/+/, '')}`;
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = fav;
    }
  }, [customization]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const findByKey = useCallback(
    (key: string) => products.find((p) => p.slug === key || p.id === key),
    [products],
  );

  return (
    <StoreContext.Provider
      value={{ store, products, loading, error, reload: load, categories, findByKey, customization }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside <StoreProvider>');
  return ctx;
}
