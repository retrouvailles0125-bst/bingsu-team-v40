import {readFile} from 'node:fs/promises';
import path from 'node:path';

// V40 visual/interaction fidelity: return the exact, unmodified HTML document.
// This is an isolated demo: its localStorage behavior is NOT Supabase production behavior.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const html = await readFile(path.join(process.cwd(), 'reference', 'v40-original.html'), 'utf8');
  return new Response(html, {headers: {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
}
