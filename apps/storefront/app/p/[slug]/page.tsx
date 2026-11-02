'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { getApiBase, SUBDOMAIN } from '@/lib/api';

export default function CustomStorePage() {
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug as string) || '';

  const [page, setPage] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `${getApiBase()}/store-pages/public/${SUBDOMAIN}/${encodeURIComponent(slug)}`,
        );
        if (!res.ok) {
          if (alive) setError('Page not found');
          return;
        }
        const data = await res.json();
        if (alive) setPage({ title: data.title, content: data.content });
      } catch {
        if (alive) setError('Page not found');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 text-sm w-full">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
        Loading page…
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center w-full">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-xl font-black text-slate-900">Page not found</h1>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition"
        >
          Back to store
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-3xl font-black text-slate-900">{page.title}</h1>
      <div className="mt-2 h-1 w-14 rounded-full bg-[var(--pk-primary)]" />
      <div className="mt-8 text-sm text-slate-700 leading-7 whitespace-pre-wrap bg-white rounded-2xl border border-slate-200 p-6">
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
