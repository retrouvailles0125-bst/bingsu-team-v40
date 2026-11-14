
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

import {
  adminDatabase,
  generateOtp,
  getAdminIdentity,
  otpHash,
  OTP_LIFETIME_MS,
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

    // Only trust forwarded host on the Codespaces preview proxy.
    // Production must use an explicitly configured public origin.
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

    const db = adminDatabase();

    const oneHourAgo = new Date(
      Date.now() - 60 * 60 * 1000
    ).toISOString();

    const { data: recent, error: recentError } = await db
      .from('admin_otp_challenges')
      .select('created_at')
      .eq('user_id', identity.userId)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(6);

    if (recentError) throw recentError;

    if ((recent?.length ?? 0) >= 5) {
      return NextResponse.json(
        {
          error:
            'Đã đạt giới hạn 5 mã OTP trong một giờ.',
        },
        { status: 429 }
      );
    }

    if (recent?.[0]) {
      const lastSentAt = new Date(
        recent[0].created_at
      ).getTime();

      if (Date.now() - lastSentAt < 60_000) {
        return NextResponse.json(
          {
            error:
              'Vui lòng chờ 60 giây trước khi gửi lại OTP.',
          },
          { status: 429 }
        );
      }
    }

    const code = generateOtp();

    const { data: challenge, error: insertError } =
      await db
        .from('admin_otp_challenges')
        .insert({
          user_id: identity.userId,
          session_id: identity.sessionId,
          code_hash: otpHash(
            identity.userId,
            identity.sessionId,
            code
          ),
          expires_at: new Date(
            Date.now() + OTP_LIFETIME_MS
          ).toISOString(),
          attempts: 0,
        })
        .select('id')
        .single();

    if (insertError) throw insertError;

    // Accept both the current V40 names and the older SMTP names.
    // This avoids breaking Production when the Vercel project still uses
    // SMTP_PASS / SMTP_FROM from the earlier mail configuration.
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_APP_PASSWORD || process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM_EMAIL?.trim()
      || process.env.SMTP_FROM?.trim()
      || user;

    if (!user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
      console.error('Admin OTP SMTP configuration incomplete:', {
        hasUser: Boolean(user),
        hasPassword: Boolean(pass),
        hasFrom: Boolean(from),
        validPort: Number.isInteger(port) && port >= 1 && port <= 65535,
      });
      throw new Error('Thiếu hoặc sai cấu hình Gmail SMTP.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    try {
      await transporter.sendMail({
        from,
        to: identity.email,
        subject: 'BINGSU TEAM — Mã xác thực Admin',
        text: [
          'BINGSU TEAM — XÁC THỰC QUẢN TRỊ',
          '',
          `Mã OTP của bạn: ${code}`,
          '',
          'Mã có hiệu lực trong 5 phút.',
          'Không chia sẻ mã OTP với bất kỳ ai.',
          '',
          'Nếu bạn không yêu cầu mã này,',
          'hãy bỏ qua email.',
        ].join('\n'),
      });
    } catch (mailError) {
      await db
        .from('admin_otp_challenges')
        .delete()
        .eq('id', challenge.id);

      throw mailError;
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          'Đã gửi OTP tới email Admin. Vui lòng kiểm tra hộp thư.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Admin OTP send error:', error);

    return NextResponse.json(
      {
        error:
          'Không thể gửi OTP. Vui lòng kiểm tra cấu hình SMTP và terminal.',
      },
      { status: 500 }
    );
  }
}
