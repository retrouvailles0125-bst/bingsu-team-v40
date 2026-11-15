import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';
const schema=z.object({
 request_id:z.string().uuid(),recipient_id:z.string().uuid(),
 normal:z.number().int().min(0).max(10000),
 gold:z.number().int().min(0).max(10000),
 reason:z.string().trim().min(3).max(500)
}).strict().refine(v=>v.normal+v.gold>0);
export async function POST(req:Request){
 const {supabase,user}=await requireUser();
 if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});
 const access=await requireAdminAccess();
 if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Thông tin cấp lượt không hợp lệ'},{status:400});
 const v=parsed.data;
 const {data,error}=await supabase.rpc('bst_admin_grant_tickets',{
 p_request_id:v.request_id,p_recipient_id:v.recipient_id,p_normal:v.normal,p_gold:v.gold,p_reason:v.reason
 });
 if(error)return NextResponse.json({error:error.message},{status:403});
 return NextResponse.json({ok:true,result:data});
}
