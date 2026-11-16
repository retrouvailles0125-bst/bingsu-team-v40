
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

const schema = z.object({
  donation_id: z.string().uuid(),
  received_amount: z.number().int().min(0).max(1_000_000_000),
}).strict();

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Chưa đăng nhập' },
      { status: 401 }
    );
  }

  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dữ liệu không hợp lệ' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc(
    'start_donation_verification',
    {
      p_donation_id: parsed.data.donation_id,
      p_received_amount: parsed.data.received_amount,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 403 }
    );
  }

  return NextResponse.json({
    donation_id: data,
    status: 'processing',
  });
}
