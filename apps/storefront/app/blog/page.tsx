// Blog listing — public, published posts only. Server-rendered for SEO.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Newspaper, ChevronRight } from 'lucide-react';
import { imgUrl } from '@/lib/media';
import { storeSeo } from '@/lib/seo';

const SUBDOMAIN = 'khaadi';
const PER_PAGE = 12;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await storeSeo();
  const title = seo.title || 'Journal';
  const description =
    seo.description ||
    'Notes, guides and stories from the Pak Commerce store — lawn care, shipping updates and fabric stories.';
  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: {
      type: 'website',
      title,
      description,
      url: '/blog',
      images: seo.image ? [{ url: seo.image }] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

async function loadPosts(page: number) {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/blog-posts/public/${SUBDOMAIN}?page=${page}&limit=${PER_PAGE}`, {
      // Unpublishing must remove a post from the public listing immediately.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      data: Array<{
        id: string; title: string; handle: string; excerpt: string;
        author: string | null; imageUrl: string | null; publishedAt: string | null; createdAt: string;
      }>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    };
  } catch {
    return null;
  }
}

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const result = await loadPosts(page);
  const posts = result?.data ?? [];
  const meta = result?.meta ?? { total: 0, page: 1, totalPages: 1 };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)] px-2.5 py-1 rounded-full">
            <Newspaper className="w-3.5 h-3.5" /> Journal
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-black text-slate-900">Stories &amp; guides</h1>
          <p className="text-xs text-slate-500 mt-1">Care guides, fabric notes and order updates — published directly from the shop.</p>
        </div>
        <p className="text-[11px] text-slate-400">{meta.total} {meta.total === 1 ? 'post' : 'posts'}</p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <Newspaper className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-600">No posts yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">The journal will open with the first article.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.handle}`}
              className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition"
            >
              <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl(p.imageUrl) || ''}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Newspaper className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="font-black text-slate-900 leading-snug group-hover:text-[var(--pk-primary-text)] transition-colors">
                  {p.title}
                </h2>
                <p className="mt-1.5 text-[12px] text-slate-500 leading-snug line-clamp-2">{p.excerpt}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {p.author || 'Studio'} · {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-10" aria-label="Pagination">
          {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={n === 1 ? '/blog' : `/blog?page=${n}`}
              aria-current={n === meta.page ? 'page' : undefined}
              className={`w-9 h-9 rounded-lg text-[12px] font-bold flex items-center justify-center transition ${
                n === meta.page ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>
      )}

      <div className="text-center mt-6">
        <Link href="/" className="text-xs font-bold text-[var(--pk-primary-text)] hover:underline inline-flex items-center gap-1">
          Back to store <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </main>
  );
}
