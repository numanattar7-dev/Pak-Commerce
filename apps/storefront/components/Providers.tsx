'use client';

import React from 'react';
import { CartProvider } from '@/lib/cart';
import { StoreProvider } from '@/lib/store';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <CartProvider>{children}</CartProvider>
    </StoreProvider>
  );
}
