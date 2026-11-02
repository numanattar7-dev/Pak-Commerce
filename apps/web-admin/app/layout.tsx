import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pak Commerce - Merchant Operating System',
  description: 'Manage your Pakistani e-commerce storefront, COD ledger, inventory, and orders.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#f1f1f1] text-slate-900">{children}</body>
    </html>
  );
}
