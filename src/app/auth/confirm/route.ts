
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  const homeUrl = new URL('/', url.origin);
  const errorUrl = new URL('/login', url.origin);

  errorUrl.searchParams.set(
    'error',
    'Không thể xác minh email. Link có thể đã hết hạn.'
  );

  if (!tokenHash || type !== 'signup') {
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(homeUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    console.error('Supabase email confirmation:', error.message);
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
