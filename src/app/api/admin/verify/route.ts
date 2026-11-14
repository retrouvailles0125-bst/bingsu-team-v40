import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase';
const schema=z.object({donation_id:z.string().uuid(),received_amount:z.number().int().min(0).max(1000000000),normal_tickets:z.number().int().min(0).max(100000),gold_tickets:z.number().int().min(0).max(100000)});
export async function POST(req:Request){const {supabase,user}=await requireUser();if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Dữ liệu không hợp lệ'},{status:400});const {data,error}=await supabase.rpc('verify_donation',parsed.data);return error?NextResponse.json({error:error.message},{status:403}):NextResponse.json({donation_id:data});}
