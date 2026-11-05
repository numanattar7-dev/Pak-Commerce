'use client';

// ---------------------------------------------------------------------------
// Pak Commerce Admin — API client
// Talks to the api-backend (NestJS). JWT token lives in localStorage.
// ---------------------------------------------------------------------------

let API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000'; // try IPv4 loopback first (Node/IPv6-safe)

export const TOKEN_KEY = 'pkc_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBase() {
  return API_BASE;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  /** Raw error response body (when provided by the API). */
  raw?: unknown;
  constructor(status: number, message: string, detail: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/** Authenticated request. Falls back to localhost:4000 if 127.0.0.1 is unreachable. */
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; skipFallback?: boolean } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const attempt = async (base: string): Promise<Response> => {
    const res = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (res.ok) return res;
    let msg = res.statusText;
    let detail = '';
    let raw: unknown;
    try {
      const body = await res.json();
      raw = body;
      // NestJS: { message: string | string[], ... } or { statusCode, message }
      const m = body?.message;
      if (m) {
        const text = Array.isArray(m) ? m.join('; ') : String(m);
        msg = text.length > 120 ? `${text.slice(0, 120)}…` : text;
        detail = Array.isArray(m) ? m.join('\n') : String(m);
      }
    } catch {
      /* keep statusText */
    }
    const err = new ApiError(res.status, msg, detail);
    (err as any).raw = raw;
    throw err;
  };

  try {
    return (await attempt(API_BASE).then((r) => r.json())) as T;
  } catch (err) {
    if (err instanceof ApiError || options.skipFallback) throw err;
    // Network failure → try localhost hostname (dev only; custom API base = no fallback)
    if (process.env.NEXT_PUBLIC_API_BASE) throw err;
    const second = 'http://localhost:4000';
    if (API_BASE === second) throw err;
    try {
      const res = await attempt(second);
      API_BASE = second;
      return (await res.json()) as T;
    } catch (e2) {
      throw e2 instanceof ApiError ? e2 : err;
    }
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).catch(async () => {
    API_BASE = 'http://localhost:4000';
    return fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const b = await res.json();
      msg = Array.isArray(b?.message) ? b.message.join('; ') : String(b?.message ?? msg);
    } catch {}
    throw new ApiError(res.status, msg || 'Login failed', msg);
  }
  const data = await res.json();
  setToken(data.accessToken);
  return data;
}

export async function getCurrentUser() {
  return api<{ user: { id: string; name: string; email: string; role: string; tenantId: string } }>(
    '/auth/me',
  );
}

/** Authenticated multipart document (CSV import / image upload). */
export async function apiUpload<T = any>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const send = (base: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '' },
      body: form,
    });
  let res = await send(API_BASE);
  if (!res.ok || !API_BASE.includes('127.0.0.1')) {
    // also tolerate IPv6-only binding by retrying via localhost on failure
    if (res.status === 0) res = await send('http://localhost:4000');
  }
  if (!res.ok) {
    let msg = res.statusText;
    let raw: unknown;
    try {
      const b = await res.json();
      raw = b;
      msg = Array.isArray(b?.message) ? b.message.join('; ') : String(b?.message ?? msg);
    } catch {}
    const err = new ApiError(res.status, msg || 'Upload failed', msg);
    (err as any).raw = raw;
    throw err;
  }
  return res.json();
}

/** Raw binary download (CSV export). */
export async function apiDownload(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`, '');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatPKR(n: number | null | undefined) {
  const num = Number(n ?? 0);
  return `Rs. ${num.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export type OrderStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RTO';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'VERIFIED',
  'PROCESSING',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
  'RTO',
];
