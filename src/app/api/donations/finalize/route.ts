
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';

const schema = z.object({
  donation_id: z.string().uuid(),
}).strict();

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Chưa đăng nhập' },
        { status: 401 }
      );
    }

    const parsed = schema.safeParse(
      await req.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donation ID không hợp lệ' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      'finalize_donation_verification',
      { p_donation_id: parsed.data.donation_id }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      donation_id: data,
      status: 'verified',
    });
  } catch {
    return NextResponse.json(
      { error: 'Không thể hoàn tất xác minh Donate' },
      { status: 500 }
    );
  }
}
