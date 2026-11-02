'use client';

// ---------------------------------------------------------------------------
// Pak Commerce Storefront — public API client
// All prices/totals are computed SERVER-SIDE from the database; this client
// only sends item references and displays what the server returns.
// ---------------------------------------------------------------------------

let API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000'; // IPv4-first (Node/IPv6-safe, same as admin)
const FALLBACK_BASE = 'http://localhost:4000';

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
  const send = (base: string) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });

  let res: Response;
  try {
    res = await send(API_BASE);
  } catch (e) {
    // network-level failure (IPv6 ::1 miss) → retry once via localhost (dev only;
    // skip the fallback when a custom API base is configured, e.g. staging/prod)
    if (process.env.NEXT_PUBLIC_API_BASE) throw e;
    res = await send(FALLBACK_BASE);
    API_BASE = FALLBACK_BASE;
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
// Helpers
// ---------------------------------------------------------------------------

/** Absolute URL for stored/relative image paths (uploads live on the API :4000). */
export function imgUrl(src?: string | null): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${API_BASE}/${src.replace(/^\/+/, '')}`;
}

export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80';

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
