import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-24 text-center w-full">
      <FileQuestion className="w-10 h-10 text-slate-300 mx-auto mb-4" />
      <h1 className="text-2xl font-black text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500 mt-2">This post or page doesn’t exist — or hasn’t been published yet.</p>
      <Link href="/" className="inline-flex items-center gap-2 mt-6 bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition">
        Back to store
      </Link>
    </main>
  );
}
