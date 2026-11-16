
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminDatabase,
  getAdminIdentity,
  makeAdminCookie,
  otpHash,
  ADMIN_SESSION_SECONDS,
} from '@/lib/admin-otp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  if (request.headers.get('origin') !== origin) {
    return NextResponse.json(
      { error: 'Nguồn yêu cầu không hợp lệ.' },
      { status: 403 }
    );
  }

  const identity = await getAdminIdentity();

  if (!identity) {
    return NextResponse.json(
      { error: 'Không có quyền Admin.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = body?.code;

  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'OTP phải gồm đúng 6 chữ số.' },
      { status: 400 }
    );
  }

  try {
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
        not_found: 'Chưa có mã OTP. Vui lòng yêu cầu gửi mã.',
        already_used: 'Mã đã được sử dụng.',
        expired: 'Mã đã hết hạn.',
        locked: 'Đã nhập sai quá số lần cho phép.',
        invalid: 'Mã OTP không chính xác.',
      };

      return NextResponse.json(
        { error: messages[data] || 'Xác minh thất bại.' },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Xác thực Admin thành công.',
    });

    response.cookies.set(
      ADMIN_COOKIE,
      makeAdminCookie(identity.userId, identity.sessionId),
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
      { error: 'Không thể xác minh OTP.' },
      { status: 500 }
    );
  }
}
