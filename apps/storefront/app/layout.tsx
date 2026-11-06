import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import Shell from '@/components/Shell';
import { SITE_URL } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  // Store-level SEO (Customize Store → SEO) — falls back silently on any error
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
    const res = await fetch(`${base}/store-settings/public/khaadi`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const cfg = data?.config ?? {};
      const title = cfg?.seo?.metaTitle || `${data.store?.name ?? 'Pak Commerce'} — Online Store`;
      const description =
        cfg?.seo?.metaDescription ||
        'Buy premium Pakistani products online with Cash on Delivery (COD).';
      return { metadataBase: new URL(SITE_URL), title, description };
    }
  } catch {
    /* fall through to defaults */
  }
  return {
    metadataBase: new URL(SITE_URL),
    title: 'Pak Commerce Storefront',
    description: 'Buy premium Pakistani products online with Cash on Delivery (COD).',
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 bg-slate-50 flex flex-col justify-between">
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
