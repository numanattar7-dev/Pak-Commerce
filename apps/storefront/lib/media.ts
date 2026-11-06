// Server-safe media helpers. Import this from Server Components; the API
// client in `lib/api.ts` re-uses `imageUrl` with its runtime base.

export const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';

export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80';

/** Absolute URL for stored/relative image paths (uploads live on the API). */
export function imageUrl(src: string | null | undefined, base: string): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${base.replace(/\/+$/, '')}/${src.replace(/^\/+/, '')}`;
}

export function imgUrl(src?: string | null): string | null {
  return imageUrl(src, DEFAULT_API_BASE);
}
