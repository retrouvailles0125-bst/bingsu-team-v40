'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { site } from '@/config/site';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    setIsAdmin(false);

    async function checkAdmin() {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (!response.ok) return;

        const session = await response.json();

        if (active) {
          setIsAdmin(
            session.authenticated === true &&
            session.isAdmin === true
          );
        }
      } catch {
        if (active) setIsAdmin(false);
      }
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [pathname]);

  if (
    pathname === '/' ||
    pathname === '/universe' ||
    pathname.startsWith('/universe/')
  ) {
    return null;
  }

  // /donate là trang con của "Thống kê tổng quan", /login là trang con của "Tài khoản".
  const isActive = (href: string) =>
    pathname === href ||
    (href === '/home' && pathname === '/donate') ||
    (href === '/account' && pathname === '/login');

  return (
    <header>
      <h1>{site.brand}</h1>
      <small>{site.subtitle}</small>
      <nav id="nav" aria-label="Điều hướng chính">
        {site.nav
          .filter((item) => item.href !== '/admin' || isAdmin)
          .map((item) => (
            <button
              key={item.href}
              type="button"
              className={isActive(item.href) ? 'active' : undefined}
              aria-current={isActive(item.href) ? 'page' : undefined}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </button>
          ))}
      </nav>
    </header>
  );
}