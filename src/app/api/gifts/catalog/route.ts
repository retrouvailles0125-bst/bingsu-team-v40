import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await supabaseServer();
    const { data, error } = await db.rpc('bst_public_gift_catalog');
    if (error) return NextResponse.json({error: 'Danh mục quà chưa được đồng bộ'}, {status: 503});
    return NextResponse.json({gifts: data ?? []}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return NextResponse.json({error: 'Không thể tải danh mục quà'}, {status: 500});
  }
}
