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
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
