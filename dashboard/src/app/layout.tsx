import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'POS Alternatif - Dashboard Head Office',
  description: 'Sistem Manajemen Multi-Outlet F&B & Retail Indonesia',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
