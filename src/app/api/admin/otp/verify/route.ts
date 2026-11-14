
import { NextRequest, NextResponse } from 'next/server';

import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminDatabase,
  getAdminIdentity,
  makeAdminCookie,
  otpHash,
} from '@/lib/admin-otp';

export const runtime = 'nodejs';

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const requestHost = request.headers.get('host');

  if (!origin || !requestHost) return false;

  try {
    const parsedOrigin = new URL(origin);

    if (
      !['https:', 'http:'].includes(parsedOrigin.protocol) ||
      parsedOrigin.username ||
      parsedOrigin.password
    ) {
      return false;
    }

    const configuredOrigin = process.env.APP_ORIGIN;

    if (configuredOrigin) {
      return origin === new URL(configuredOrigin).origin;
    }

    const hosts = [requestHost];

    if (
      process.env.NODE_ENV === 'development' &&
      forwardedHost
    ) {
      hosts.push(forwardedHost);
    }

    return hosts.includes(parsedOrigin.host);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Nguồn yêu cầu không hợp lệ.' },
      { status: 403 }
    );
  }

  try {
    const identity = await getAdminIdentity();

    if (!identity) {
      return NextResponse.json(
        { error: 'Không có quyền Admin.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const code = body?.code;

    if (
      typeof code !== 'string' ||
      !/^\d{6}$/.test(code)
    ) {
      return NextResponse.json(
        { error: 'OTP phải gồm đúng 6 chữ số.' },
        { status: 400 }
      );
    }

    const { data, error } = await adminDatabase().rpc(
      'verify_admin_otp_challenge',
      {
        p_user_id: identity.userId,
        p_session_id: identity.sessionId,
        p_code_hash: otpHash(
          identity.userId,
          identity.sessionId,
          code
        ),
      }
    );

    if (error) throw error;

    if (data !== 'verified') {
      const messages: Record<string, string> = {
        not_found:
          'Chưa có mã OTP. Vui lòng yêu cầu gửi mã.',
        already_used:
          'Mã OTP đã được sử dụng.',
        expired:
          'Mã OTP đã hết hạn. Vui lòng gửi mã mới.',
        locked:
          'Đã nhập sai quá 5 lần. Vui lòng gửi mã mới.',
        invalid:
          'Mã OTP không chính xác.',
      };

      return NextResponse.json(
        {
          error:
            messages[String(data)] ||
            'Xác minh OTP thất bại.',
        },
        { status: 403 }
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        message: 'Xác thực Admin thành công.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    response.cookies.set(
      ADMIN_COOKIE,
      makeAdminCookie(
        identity.userId,
        identity.sessionId
      ),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: ADMIN_SESSION_SECONDS,
      }
    );

    return response;
  } catch (error) {
    console.error('Admin OTP verify error:', error);

    return NextResponse.json(
      {
        error:
          'Không thể xác minh OTP. Vui lòng thử lại.',
      },
      { status: 500 }
    );
  }
}
