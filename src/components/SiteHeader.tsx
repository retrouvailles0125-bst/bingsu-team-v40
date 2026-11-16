
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

  if (
  pathname === '/' ||
  pathname === '/universe' ||
  pathname.startsWith('/universe/')
) {
  return null;
}

  return (
    <header className="site-header" style={{padding:'18px max(18px, calc((100vw - 1120px) / 2))',background:'#fff',borderBottom:'1px solid #efdce8',fontFamily:'Montserrat, Arial, sans-serif'}}>
      <h1 style={{margin:0,fontSize:'clamp(24px, 4vw, 32px)',lineHeight:1.2,fontWeight:800,color:'#e12589'}}>{site.brand}</h1>
      <small style={{display:'block',marginTop:4,fontSize:11,letterSpacing:1,color:'#805f75'}}>{site.subtitle}</small>

      <nav id="nav" aria-label="Điều hướng chính" style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:14,alignItems:'center'}}>
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
              style={{display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'10px 13px',borderRadius:12,background:pathname===item.href?'#e12589':'#fff0f9',color:pathname===item.href?'#fff':'#98245f',fontSize:11,fontWeight:700,lineHeight:1.4,textDecoration:'none',whiteSpace:'normal'}}
            >
              {item.label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
