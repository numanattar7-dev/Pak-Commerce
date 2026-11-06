// Collection detail — public, server-rendered.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

const SUBDOMAIN = 'khaadi';

async function load() {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/collections/store/${SUBDOMAIN}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? []) as Array<{
      id: string; title: string; handle: string; products: any[];
    }>;
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const col = (await load()).find((c) => c.handle === params.handle);
  if (!col) return { title: 'Collection not found', robots: { index: false } };
  return {
    title: col.title,
    description: `Shop the ${col.title} collection — ${col.products.length} pieces, cash on delivery nationwide.`,
    alternates: { canonical: `/collections/${col.handle}` },
    openGraph: { type: 'website', title: col.title },
    robots: { index: true, follow: true },
  };
}

export default async function CollectionDetail({
  params,
}: {
  params: { handle: string };
}) {
  const collection = (await load()).find((c) => c.handle === params.handle);
  if (!collection) notFound();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <Link href="/collections" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700">
        <ArrowLeft className="w-3.5 h-3.5" /> Collections
      </Link>
      <h1 className="mt-3 text-3xl md:text-4xl font-black text-slate-900">{collection.title}</h1>
      <p className="text-xs text-slate-500 mt-1">{collection.products.length} {collection.products.length === 1 ? 'item' : 'items'}</p>

      {collection.products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center mt-8">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-600">Collection is being curated</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {collection.products.map((p: any) => {
            const variants = (p.variants ?? []).map((v: any) => ({
              id: v.id,
              sku: v.sku,
              title: v.title,
              price: Number(v.price ?? 0),
              compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
              stockQuantity: Number(v.stockQuantity ?? 0),
              weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
            }));
            const product = {
              ...p,
              slug: `${slugify(p.title || 'product')}-${String(p.id).slice(0, 8)}`,
              price: variants.length ? Math.min(...variants.map((v: any) => v.price)) : 0,
              compareAtPrice: undefined,
              variants,
            };
            return <ProductCard key={p.id} product={product as any} />;
          })}
        </div>
      )}
    </main>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
