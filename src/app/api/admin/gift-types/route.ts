import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase';
import {requireAdminAccess} from '@/lib/admin-security';
const schema=z.object({
 name:z.string().trim().min(1).max(120),
 rarity:z.enum(['normal','rare','ssr','secret']),
 stock_total:z.number().int().min(0).max(1000000),
 normal_weight:z.number().int().min(0).max(1000000),
 gold_weight:z.number().int().min(0).max(1000000),
 active:z.boolean()
}).strict();
export async function POST(req:Request){
 const {supabase,user}=await requireUser();
 if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});
 const access=await requireAdminAccess();
 if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Thông tin quà không hợp lệ'},{status:400});
 const payload=parsed.data;
 const {data,error}=await supabase.rpc('bst_admin_create_gift_type',{
  p_name:payload.name,p_rarity:payload.rarity,p_stock_total:payload.stock_total,
  p_normal_weight:payload.normal_weight,p_gold_weight:payload.gold_weight,p_active:payload.active
 });
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({id:data},{status:201});
}
