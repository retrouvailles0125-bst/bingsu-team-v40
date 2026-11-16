
import 'server-only';

import {
  createHmac,
  createHash,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/supabase';

export const ADMIN_COOKIE = 'bst_admin_otp';
export const OTP_LIFETIME_MS = 5 * 60 * 1000;
export const ADMIN_SESSION_SECONDS = 30 * 60;

function secret() {
  const value = process.env.ADMIN_OTP_SECRET;
  if (!value || value.length < 32) {
    throw new Error('ADMIN_OTP_SECRET chưa hợp lệ');
  }
  return value;
}

export function adminDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Thiếu cấu hình Supabase Admin');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function otpHash(
  userId: string,
  sessionId: string,
  code: string
) {
  return createHmac('sha256', secret())
    .update(`${userId}:${sessionId}:${code}`)
    .digest('hex');
}

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function signature(payload: string) {
  return createHmac('sha256', secret())
    .update(payload)
    .digest('hex');
}

export function makeAdminCookie(
  userId: string,
  sessionId: string
) {
  const expires = Date.now() + ADMIN_SESSION_SECONDS * 1000;
  const payload = `${userId}.${sessionId}.${expires}`;
  return `${payload}.${signature(payload)}`;
}

export function validateAdminCookie(
  value: string,
  userId: string,
  sessionId: string
) {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  const [cookieUser, cookieSession, expiry, mac] = parts;
  if (cookieUser !== userId || cookieSession !== sessionId) {
    return false;
  }

  const expires = Number(expiry);
  if (!Number.isSafeInteger(expires) || expires <= Date.now()) {
    return false;
  }

  const expected = Buffer.from(
    signature(`${cookieUser}.${cookieSession}.${expiry}`),
    'hex'
  );
  const actual = Buffer.from(mac, 'hex');

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

export async function getAdminIdentity() {
  const { supabase, user } = await requireUser();

  if (!user?.email) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role,blocked')
    .eq('id', user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.role !== 'admin' ||
    profile.blocked
  ) {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session?.access_token) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    sessionId: hashValue(sessionData.session.access_token),
  };
}

export async function isAdminOtpVerified(
  userId: string,
  sessionId: string
) {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!value || !validateAdminCookie(value, userId, sessionId)) {
    return false;
  }

  const { data, error } = await adminDatabase()
    .from('admin_otp_challenges')
    .select('verified_at')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data?.verified_at);
}
