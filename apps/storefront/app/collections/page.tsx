// Collections listing — public, server-rendered.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, ChevronRight, Package } from 'lucide-react';
import { imgUrl } from '@/lib/media';

const SUBDOMAIN = 'khaadi';

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Shop curated collections — lawn, silk, unstitched suits and more from Pak Commerce.',
  openGraph: { type: 'website', title: 'Collections — Pak Commerce' },
  robots: { index: true, follow: true },
};

async function load() {
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
  try {
    const res = await fetch(`${base}/collections/store/${SUBDOMAIN}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? []) as Array<{
      id: string; title: string; handle: string;
      products: Array<any>;
    }>;
  } catch {
    return [];
  }
}

export default async function CollectionsIndex() {
  const collections = await load();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--pk-primary-text)] bg-[var(--pk-primary-soft)] px-2.5 py-1 rounded-full">
        <Layers className="w-3.5 h-3.5" /> Collections
      </span>
      <h1 className="mt-2 text-3xl md:text-4xl font-black text-slate-900">Shop by collection</h1>
      <p className="text-xs text-slate-500 mt-1">Curated picks from the store — each collection is hand-assembled.</p>

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center mt-8">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-600">No collections yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Collections appear here once the shop activates them.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {collections.map((c) => {
            const first = c.products[0];
            const image = first ? imgUrl(first.images?.[0]) : null;
            return (
              <Link
                key={c.id}
                href={`/collections/${c.handle}`}
                className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition"
              >
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><Layers className="w-10 h-10" /></div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-black text-slate-900 group-hover:text-[var(--pk-primary-text)] transition-colors">{c.title}</h2>
                  <p className="text-[11px] text-slate-400 mt-1">{c.products.length} {c.products.length === 1 ? 'item' : 'items'}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/products" className="text-xs font-bold text-[var(--pk-primary-text)] hover:underline inline-flex items-center gap-1">
          Browse all products <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </main>
  );
}
