// /p/[slug] — custom static pages. Server-rendered with per-page SEO metadata.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { storeOgImage } from '@/lib/seo';

const SUBDOMAIN = 'khaadi';

async function getPage(slug: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/store-pages/public/${SUBDOMAIN}/${encodeURIComponent(slug)}`, {
      // Never serve a cached copy of a page after it is unpublished.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      slug: string;
      title: string;
      content: string;
      seoTitle: string | null;
      seoDescription: string | null;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return { title: 'Page not found', robots: { index: false } };
  const title = page.seoTitle?.trim() || page.title;
  const description =
    page.seoDescription?.trim() ||
    (page.content || '').replace(/\s+/g, ' ').trim().slice(0, 155) ||
    title;
  const image = await storeOgImage();
  return {
    title,
    description,
    alternates: { canonical: `/p/${page.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/p/${page.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CustomStorePage({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getPage(params.slug);
  if (!page) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-3xl font-black text-slate-900">{page.title}</h1>
      <div className="mt-2 h-1 w-14 rounded-full bg-[var(--pk-primary)]" />
      <div className="mt-8 text-[15px] text-slate-700 leading-8 whitespace-pre-wrap bg-white rounded-2xl border border-slate-200 p-6">
        {page.content || 'This page is empty.'}
      </div>
      <div className="text-center mt-8">
        <Link href="/" className="text-xs font-bold text-[var(--pk-primary)] hover:underline">
          ← Back to store
        </Link>
      </div>
    </main>
  );
}
