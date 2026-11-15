import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const db=await supabaseServer();
  const {data,error}=await db.from('bst_donation_bank_settings').select('bank_name,account_name,account_number,qr_image_url,instructions').eq('id',true).maybeSingle();
  if(error)return NextResponse.json({error:'Chưa tải được thông tin chuyển khoản.'},{status:503,headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({settings:data??null},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Không thể tải thông tin chuyển khoản.'},{status:503})}
}
