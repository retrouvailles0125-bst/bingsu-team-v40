import Link from 'next/link';
import {site} from '@/config/site';
/** The markup follows V40's header/nav structure; links replace V40's data-tab buttons. */
export function SiteHeader(){return <header><h1>{site.brand}</h1><small>{site.subtitle}</small><nav id="nav" aria-label="Điều hướng chính">{site.nav.map(item=><Link className="bst-nav-link" key={item.href} href={item.href}>{item.label}</Link>)}</nav></header>}
