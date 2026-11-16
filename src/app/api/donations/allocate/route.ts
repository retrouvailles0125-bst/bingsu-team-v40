
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';

const schema = z.object({
  donation_id: z.string().uuid(),
  choice: z.enum(['normal', 'gold_max']),
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

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dữ liệu phân bổ không hợp lệ' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      'allocate_donation_tickets',
      {
        p_donation_id: parsed.data.donation_id,
        p_choice: parsed.data.choice,
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      allocation: data,
    });
  } catch {
    return NextResponse.json(
      { error: 'Không thể xử lý yêu cầu phân bổ lượt' },
      { status: 500 }
    );
  }
}
