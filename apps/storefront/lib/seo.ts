// Server-side SEO helpers shared by storefront metadata routes.
// Never exposes anything beyond the public store settings endpoint.

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://khaadi.pakcommerce.pk'
).replace(/\/+$/, '');

export const STORE_SUBDOMAIN = process.env.NEXT_PUBLIC_STORE_SUBDOMAIN || 'khaadi';

function absoluteMedia(src?: string | null): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  return `${base}/${src.replace(/^\/+/, '')}`;
}

export type StoreSeo = {
  /** Blog listing overrides from Customize → SEO (falls back to store SEO). */
  title?: string;
  description?: string;
  image?: string;
};

export async function storeSeo(): Promise<StoreSeo> {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/store-settings/public/${STORE_SUBDOMAIN}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const seo = data?.config?.seo ?? {};
    const image = absoluteMedia(data?.store?.logoUrl || data?.store?.bannerUrl);
    return {
      title: (seo.blogTitle || seo.metaTitle || '').trim() || undefined,
      description: (seo.blogDescription || seo.metaDescription || '').trim() || undefined,
      image,
    };
  } catch {
    return {};
  }
}

/** Store logo/banner as an absolute Open Graph image, or undefined. */
export async function storeOgImage(): Promise<string | undefined> {
  return (await storeSeo()).image;
}
