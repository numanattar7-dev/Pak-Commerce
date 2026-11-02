'use client';

// ---------------------------------------------------------------------------
// Cart — client-side ONLY.
// The cart is a shopping basket: it sends variant references at checkout and
// the SERVER recomputes every price/total from the database. Never trust
// client prices (they are advisory at most).
// ---------------------------------------------------------------------------

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CartItem = {
  variantId: string;
  productId: string;
  productKey: string; // detail URL segment
  title: string;
  variantTitle: string;
  price: number; // display only — server recomputes
  image?: string | null;
  quantity: number;
  maxStock: number;
};

type CartContextValue = {
  items: CartItem[];
  hydrated: boolean;
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'pkc_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (i: CartItem) => i && i.variantId && Number(i.quantity) > 0,
            ),
          );
        }
      }
    } catch {
      /* corrupted cart = start fresh */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full/private mode — cart stays in memory */
    }
  }, [items, hydrated]);

  const add: CartContextValue['add'] = useCallback((item, qty = 1) => {
    setItems((prev) => {
      const cap = Math.max(1, item.maxStock || 99);
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: Math.min(i.quantity + qty, cap) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: Math.min(qty, cap) }];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: Math.max(0, Math.min(qty, Math.max(1, i.maxStock || 99))) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  );
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ items, hydrated, add, setQty, remove, clear, subtotal, count }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Last-placed-order memory (so the customer can revisit the status page)
// ---------------------------------------------------------------------------

export function rememberLastOrder(orderNumber: string, phone: string) {
  try {
    window.localStorage.setItem(
      'pkc_last_order',
      JSON.stringify({ orderNumber, phone }),
    );
  } catch {
    /* ignore */
  }
}

export function getLastOrder(): { orderNumber: string; phone: string } | null {
  try {
    const raw = window.localStorage.getItem('pkc_last_order');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.orderNumber && parsed?.phone) return parsed;
    return null;
  } catch {
    return null;
  }
}
