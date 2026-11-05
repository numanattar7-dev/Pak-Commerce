'use client';

// ---------------------------------------------------------------------------
// Store context — loads the tenant catalog + customization ONCE and shares it
// across pages (products, categories, store identity, theme, content).
// Theme types/defaults come from the shared renderer package — do not edit here.
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
  DEFAULT_CUSTOMIZATION,
  mergeStoreConfig,
  PREVIEW_MESSAGE_TYPE,
} from '@pak-commerce/storefront-renderer';
import {
  fetchStoreCustomization,
  fetchStoreProducts,
  getApiBase,
  mapStoreProduct,
  StoreProduct,
} from './api';

type StoreInfo = { name: string; subdomain: string };

export { DEFAULT_CUSTOMIZATION };

const mergeConfig = mergeStoreConfig;

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
        if (!e.data || e.data.type !== PREVIEW_MESSAGE_TYPE) return;
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
