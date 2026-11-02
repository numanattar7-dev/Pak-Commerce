'use client';

// ---------------------------------------------------------------------------
// Store context — loads the tenant catalog ONCE and shares it across pages
// (products, categories, store identity for theming).
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StoreProduct, fetchStoreProducts, mapStoreProduct } from './api';

type StoreInfo = { name: string; subdomain: string };

type StoreContextValue = {
  store: StoreInfo | null;
  products: StoreProduct[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  categories: string[];
  findByKey: (key: string) => StoreProduct | undefined;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

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
      value={{ store, products, loading, error, reload: load, categories, findByKey }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
