import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ authenticated: false }, {
    headers: { 'Cache-Control': 'no-store' },
  });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: CookieToSet[]) => {
          for (const { name, value, options } of cookies) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return response;
  const { data: profile } = await supabase.from('profiles')
    .select('username,blocked').eq('id', user.id).maybeSingle();
  if (profile?.blocked) return response;
  const authenticated = NextResponse.json({
    authenticated: true,
    email: user.email,
    username: profile?.username || user.user_metadata?.username || '',
  }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.getAll().forEach(cookie => authenticated.cookies.set(cookie));
  return authenticated;
}
