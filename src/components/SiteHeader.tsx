
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { site } from '@/config/site';

export function SiteHeader() {
  const pathname = usePathname();
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

  return (
    <header>
      <h1>{site.brand}</h1>
      <small>{site.subtitle}</small>

      <nav id="nav" aria-label="Điều hướng chính">
        {site.nav
          .filter(
            (item) =>
              item.href !== '/admin' || isAdmin
          )
          .map((item) => (
            <Link
              className="bst-nav-link"
              key={item.href}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
