
import { requireUser } from '@/lib/supabase';

export type AdminAccessResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

export async function requireAdminAccess(): Promise<AdminAccessResult> {
  const { supabase, user } = await requireUser();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: 'Vui lòng đăng nhập.',
    };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role,blocked')
    .eq('id', user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.blocked ||
    profile.role !== 'admin'
  ) {
    return {
      ok: false,
      status: 403,
      error: 'Tài khoản không có quyền Admin.',
    };
  }

  // Fail closed:
  // Until server-side OTP verification is implemented,
  // nobody can pass the Admin security gate.
  return {
    ok: false,
    status: 403,
    error: 'Cần xác thực OTP để truy cập Admin.',
  };
}
