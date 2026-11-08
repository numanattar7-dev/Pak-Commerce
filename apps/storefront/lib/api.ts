'use client';

import { FALLBACK_IMAGE, imageUrl } from './media';

// ---------------------------------------------------------------------------
// Pak Commerce Storefront — public API client
// All prices/totals are computed SERVER-SIDE from the database; this client
// only sends item references and displays what the server returns.
// ---------------------------------------------------------------------------

let API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://pak-commerce-api.onrender.com';

export const SUBDOMAIN = 'khaadi';

export function getApiBase() {
  return API_BASE;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, message: string, detail: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch (e) {
    // Honest failure — never retry against localhost in production.
    if (e instanceof TypeError) {
      throw new ApiError(0, 'Store API unreachable — the API is starting up or temporarily down. Please refresh in a moment.', '');
    }
    throw e;
  }

  if (!res.ok) {
    let msg = res.statusText;
    let detail = '';
    try {
      const body = await res.json();
      const m = body?.message;
      if (m) {
        msg = Array.isArray(m) ? m.join('; ') : String(m);
        detail = Array.isArray(m) ? m.join('\n') : String(m);
      }
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, msg || 'Request failed', detail);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types (public API shapes)
// ---------------------------------------------------------------------------

export type StoreVariant = {
  id: string;
  sku?: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  weightGrams?: number;
};

export type StoreProduct = {
  id: string;
  slug: string; // client-generated URL segment (DB has no slug column)
  title: string;
  titleUrdu?: string;
  description?: string;
  descriptionUr?: string;
  category: string;
  tags: string[];
  isHalal: boolean;
  images: string[];
  /** lowest variant price — the "from" price */
  price: number;
  compareAtPrice?: number;
  variants: StoreVariant[];
};

export type PublicProductsResponse = {
  store: { name: string; subdomain: string };
  data: any[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type TrackedOrderItem = { id: string; title: string; quantity: number; price: number };

export type TrackedOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  shippingCity: string;
  shippingAddress: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  riskScore: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  items: TrackedOrderItem[];
  codVerification?: {
    isVerified: boolean;
    attempts: number;
    expiresAt?: string | null;
  } | null;
  fulfillments?: Array<{
    id: string;
    status: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    createdAt: string;
  }>;
};

export type DiscountValidation = {
  valid: boolean;
  reason?: string;
  discount?: { code: string; type: string; value: number };
  discountAmount?: number;
};

export type PlaceOrderPayload = {
  subdomain: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingCity: string;
  shippingAddress: string;
  paymentMethod: 'COD' | 'IBFT' | 'RAAST' | 'JAZZCASH' | 'EASYPAISA';
  items: Array<{ variantId: string; quantity: number }>;
  notes?: string;
  discountCode?: string;
};

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

export function fetchStoreProducts(page = 1, limit = 60) {
  return request<PublicProductsResponse>(
    `/products/store/${SUBDOMAIN}?page=${page}&limit=${limit}`,
  );
}

export function validateDiscount(body: {
  code: string;
  subtotal: number;
  phone?: string;
}) {
  return request<DiscountValidation>('/discounts/validate', {
    method: 'POST',
    body: JSON.stringify({ subdomain: SUBDOMAIN, ...body }),
  });
}

export function placeOrder(payload: PlaceOrderPayload) {
  return request<any>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function trackOrder(orderNumber: string, phone: string) {
  return request<TrackedOrder>(
    `/orders/track/${encodeURIComponent(orderNumber)}/${encodeURIComponent(
      phone,
    )}?subdomain=${SUBDOMAIN}`,
  );
}

export function verifyOtpPublic(body: {
  orderNumber: string;
  phone: string;
  otpCode: string;
}) {
  return request<{ success: boolean; message: string }>('/orders/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ subdomain: SUBDOMAIN, ...body }),
  });
}

export function resendOtpPublic(body: { orderNumber: string; phone: string }) {
  return request<{ success: boolean; message: string; otpExpiresAt?: string }>(
    '/orders/resend-otp',
    { method: 'POST', body: JSON.stringify({ subdomain: SUBDOMAIN, ...body }) },
  );
}

// ---------------------------------------------------------------------------
// Payments (public)
// ---------------------------------------------------------------------------

export type PaymentInitiation = {
  paymentId: string;
  gatewayTxRef: string;
  method: string;
  status: string;
  amount: number;
  redirectUrl?: string | null;
  instructions?: string | null;
  simulation?: boolean;
};

/** Start or resume payment; resolves to a redirect (wallet) or instructions (manual). */
export function initiatePayment(orderNumber: string, phone: string) {
  return request<PaymentInitiation>('/payments/public/initiate', {
    method: 'POST',
    body: JSON.stringify({ subdomain: SUBDOMAIN, orderNumber, phone }),
  });
}

/** Sandbox-only simulation of the hosted checkout outcome. */
export function simulatePayment(body: {
  gatewayTxRef: string;
  orderNumber: string;
  phone: string;
  outcome?: 'SUCCESS' | 'FAILED';
}) {
  return request<{ gatewayTxRef: string; method: string; status: string; amount: number }>(
    `/payments/public/simulate/${encodeURIComponent(body.gatewayTxRef)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        subdomain: SUBDOMAIN,
        orderNumber: body.orderNumber,
        phone: body.phone,
        outcome: body.outcome,
      }),
    },
  );
}

/** Submit bank-transfer proof for an IBFT/RAAST payment. */
export function submitBankProof(body: {
  orderNumber: string;
  phone: string;
  gatewayTxRef: string;
  bankName: string;
  transactionRef: string;
  receiptImageUrl?: string;
}) {
  return request<{ ok: boolean; message: string; status: string }>('/payments/public/bank-proof', {
    method: 'POST',
    body: JSON.stringify({ subdomain: SUBDOMAIN, ...body }),
  });
}

// ---------------------------------------------------------------------------
// Store customization (theme editor) — public config + pages
// ---------------------------------------------------------------------------

// Theme config contract lives in the shared renderer package — re-exported for compatibility.
export type { StoreCustomization } from '@pak-commerce/storefront-renderer';

/** Public — fetch this store's customization config (falls back to defaults client-side). */
export function fetchStoreCustomization() {
  return request<{
    store: {
      name: string;
      subdomain: string;
      logoUrl?: string | null;
      bannerUrl?: string | null;
      phoneSupport?: string | null;
    };
    config: Record<string, unknown>;
  }>(`/store-settings/public/${SUBDOMAIN}`);
}

/** Public — published custom pages (About Us, FAQ…) for footer/header links. */
export function fetchStorePages() {
  return request<Array<{ slug: string; title: string; updatedAt: string }>>(
    `/store-pages/public/${SUBDOMAIN}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute URL for stored/relative image paths (uploads live on the API :4000). */
export function imgUrl(src?: string | null): string | null {
  return imageUrl(src, API_BASE);
}

export { FALLBACK_IMAGE };

export function formatPKR(n: number | null | undefined) {
  const num = Number(n ?? 0);
  return `Rs. ${num.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Map a raw backend product to the storefront shape (URL slug derived client-side). */
export function mapStoreProduct(p: any): StoreProduct {
  const variants: StoreVariant[] = (p.variants || []).map((v: any) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    price: Number(v.price ?? 0),
    compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
    stockQuantity: Number(v.stockQuantity ?? 0),
    weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
  }));
  const price = variants.length
    ? Math.min(...variants.map((v) => v.price))
    : 0;
  const compareAtPrice = variants.reduce<number | undefined>((acc, v) => {
    if (v.compareAtPrice && v.compareAtPrice > v.price) {
      return Math.max(acc ?? 0, v.compareAtPrice);
    }
    return acc;
  }, undefined);
  return {
    ...p,
    slug: `${slugify(p.title || 'product')}-${String(p.id).slice(0, 8)}`,
    price,
    compareAtPrice,
    variants,
  };
}
