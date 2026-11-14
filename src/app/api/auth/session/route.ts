
import { NextRequest, NextResponse } from 'next/server';
import {
  createServerClient,
  type CookieOptions,
} from '@supabase/ssr';

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function GET(request: NextRequest) {
  const response = NextResponse.json(
    { authenticated: false, isAdmin: false },
    { headers: { 'Cache-Control': 'no-store' } }
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items: CookieToSet[]) => {
          for (const { name, value, options } of items) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return response;
  }

  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('username,role,blocked')
      .eq('id', user.id)
      .maybeSingle();

  if (profileError || !profile || profile.blocked) {
    return response;
  }

  const authenticated = NextResponse.json(
    {
      authenticated: true,
      email: user.email,
      username:
        profile.username ||
        user.user_metadata?.username ||
        '',
      isAdmin: profile.role === 'admin',
      adminOtpVerified: false,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );

  response.cookies.getAll().forEach((cookie) => {
    authenticated.cookies.set(cookie);
  });

  return authenticated;
}
