
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';

import '@/styles/v40-original.css';
import '@/styles/globals.css';
import '@/styles/v40-pages.css';

export const metadata = {
  title: 'BST - All For Trang Phap',
  description:
    'BINGSU TEAM — Retrouvailles0125 x nlessliberty',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
