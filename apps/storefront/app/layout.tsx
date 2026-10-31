import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Khaadi Unstitched — Pak Commerce Storefront',
  description: 'Buy premium Pakistani unstitched lawn, cotton and festive wear with Cash on Delivery (COD).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 bg-slate-50 flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}
