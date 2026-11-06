// XML sitemap — static routes plus all published pages and blog posts.
import type { MetadataRoute } from 'next';

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://khaadi.pakcommerce.pk').replace(/\/+$/, '');
const SUBDOMAIN = 'khaadi';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/collections`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/track`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const api = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  const fetchJson = async (path: string) => {
    try {
      const res = await fetch(`${api}${path}`, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  };

  const [pages, posts] = await Promise.all([
    fetchJson(`/store-pages/public/${SUBDOMAIN}`),
    (async () => {
      const all: any[] = [];
      // The public blog endpoint caps `limit` at 24, so walk every page.
      for (let page = 1; page <= 50; page++) {
        const payload = await fetchJson(
          `/blog-posts/public/${SUBDOMAIN}?page=${page}&limit=24`,
        );
        const batch = Array.isArray(payload?.data) ? payload.data : [];
        all.push(...batch);
        const totalPages = Math.max(1, Number(payload?.meta?.totalPages) || 1);
        if (batch.length === 0 || page >= totalPages) break;
      }
      return all;
    })(),
  ]);

  for (const p of (Array.isArray(pages) ? pages : []) as any[]) {
    base.push({
      url: `${BASE}/p/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }
  for (const p of (Array.isArray(posts) ? posts : []) as any[]) {
    base.push({
      url: `${BASE}/blog/${p.handle}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }
  return base;
}
