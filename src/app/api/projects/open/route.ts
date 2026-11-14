import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('projects')
      .select('id,name,description,is_open')
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ projects: data ?? [] }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch {
    return NextResponse.json({ error: 'Không thể tải danh sách Project' }, { status: 500 });
  }
}
