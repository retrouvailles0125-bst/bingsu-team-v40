import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase';
import {requireAdminAccess} from '@/lib/admin-security';
const schema=z.object({
 bank_name:z.string().max(120),account_name:z.string().max(120),
 account_number:z.string().max(60),qr_image_url:z.union([z.literal(''),z.string().url().startsWith('https://').max(1000)]),
 instructions:z.string().max(2000)
}).strict();
export async function PATCH(req:Request){
 const {supabase,user}=await requireUser();
 if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});
 const access=await requireAdminAccess();
 if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Thông tin ngân hàng không hợp lệ'},{status:400});
 const v=parsed.data;
 const {data,error}=await supabase.rpc('bst_admin_update_bank',{
 p_bank_name:v.bank_name,p_account_name:v.account_name,p_account_number:v.account_number,
 p_qr_image_url:v.qr_image_url,p_instructions:v.instructions
 });
 if(error)return NextResponse.json({error:error.message},{status:403});
 return NextResponse.json({ok:true,settings:data});
}
