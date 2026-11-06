// Individual blog post — server-rendered with per-post SEO metadata.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Newspaper } from 'lucide-react';
import { imgUrl } from '@/lib/media';
import { storeOgImage } from '@/lib/seo';

const SUBDOMAIN = 'khaadi';

async function getPost(handle: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/blog-posts/public/${SUBDOMAIN}/${encodeURIComponent(handle)}`, {
      // Never serve a cached copy of a post after it is unpublished.
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as any;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const post = await getPost(params.handle);
  if (!post) return { title: 'Post not found', robots: { index: false } };
  const url = `/blog/${post.handle}`;
  const title = post.seoTitle?.trim() || post.title;
  const description = post.seoDescription?.trim() || post.excerpt || '';
  const image = post.imageUrl ? imgUrl(post.imageUrl) : await storeOgImage();
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { handle: string };
}) {
  const post = await getPost(params.handle);
  if (!post) notFound();
  const image = post.imageUrl ? imgUrl(post.imageUrl) : null;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700">
        <ArrowLeft className="w-3.5 h-3.5" /> Journal
      </Link>

      <article className="mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={post.title} className="w-full h-64 sm:h-80 object-cover border-b border-slate-200" />
        )}
        <div className="p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)] px-2.5 py-1 rounded-full">
            <Newspaper className="w-3 h-3" /> Journal
          </span>
          <h1 className="mt-3 text-3xl font-black text-slate-900 leading-tight">{post.title}</h1>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {post.author || 'Studio'} · {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
          </p>
          <div className="mt-6 text-[15px] text-slate-700 leading-8 whitespace-pre-wrap">{post.content}</div>
        </div>
      </article>

      <div className="text-center mt-8">
        <Link href="/blog" className="text-xs font-bold text-[var(--pk-primary-text)] hover:underline">
          ← All posts
        </Link>
      </div>
    </main>
  );
}
