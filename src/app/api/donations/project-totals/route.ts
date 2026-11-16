import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
 const db=await supabaseServer();
 const {data,error}=await db.rpc('bst_public_project_donation_totals');
 if(error)return NextResponse.json({error:'Không thể tải thống kê Donate'},{status:503,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({totals:(data??[]).map((r:{project_id:string;total_received:number})=>({project_id:r.project_id,total_received:Number(r.total_received)}))},{headers:{'Cache-Control':'no-store'}});
}
