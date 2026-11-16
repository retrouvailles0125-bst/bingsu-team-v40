import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Vui lòng đăng nhập để khai báo Donate.' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from('bst_donate_field_settings')
    .select('max_bills,fields')
    .eq('id', true)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Chưa tải được cấu hình khai báo Donate.' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      settings: {
        max_bills: data.max_bills,
        fields: data.fields,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
