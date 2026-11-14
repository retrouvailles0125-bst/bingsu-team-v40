
import {
  getAdminIdentity,
  isAdminOtpVerified,
} from '@/lib/admin-otp';

export type AdminAccessResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

export async function requireAdminAccess(): Promise<AdminAccessResult> {
  const identity = await getAdminIdentity();

  if (!identity) {
    return {
      ok: false,
      status: 403,
      error: 'Bạn cần đăng nhập bằng tài khoản Admin hợp lệ.',
    };
  }

  const verified = await isAdminOtpVerified(
    identity.userId,
    identity.sessionId
  );

  if (!verified) {
    return {
      ok: false,
      status: 403,
      error: 'Cần xác thực OTP để truy cập Admin.',
    };
  }

  return {
    ok: true,
    userId: identity.userId,
  };
}
