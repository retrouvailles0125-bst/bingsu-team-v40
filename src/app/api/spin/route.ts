import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase';
const schema=z.object({kind:z.enum(['normal','gold']),request_id:z.string().uuid()});
export async function POST(req:Request){const {supabase,user}=await requireUser();if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Dữ liệu không hợp lệ'},{status:400});const {data,error}=await supabase.rpc('perform_spin',parsed.data);return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data);}
