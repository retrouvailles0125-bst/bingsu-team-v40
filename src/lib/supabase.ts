import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items: { name: string; value: string; options?: import('@supabase/ssr').CookieOptions }[]) { try { items.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch { /* read-only Server Component */ } }
    }
  });
}
export async function requireUser() {
  const supabase = await supabaseServer();
  const {data:{user},error} = await supabase.auth.getUser();
  if(error || !user) return {supabase,user:null};
  return {supabase,user};
}
