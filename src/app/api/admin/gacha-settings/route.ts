import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

const schema=z.object({
  normal_rate:z.number().int().min(1).max(1000000000),
  gold_rate:z.number().int().min(1).max(1000000000)
}).strict();
export async function PATCH(req:Request) {
  const {supabase,user}=await requireUser();
  if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});
  const access=await requireAdminAccess();
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Tỷ lệ đổi lượt không hợp lệ'},{status:400});
  const {data,error}=await supabase.from('gacha_exchange_settings')
    .update({...parsed.data,updated_at:new Date().toISOString(),updated_by:user.id})
    .eq('id',true).select('normal_rate,gold_rate,verify_wait_seconds').single();
  if(error)return NextResponse.json({error:error.message},{status:403});
  return NextResponse.json({settings:data});
}
