import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

const reports = {
 donations: {table:'donations',fields:'id,user_id,project_id,declared_amount,received_amount,status,normal_tickets,gold_tickets,created_at,verified_at'},
 spins: {table:'spin_events',fields:'id,request_id,user_id,kind,gift_item_id,created_at'},
 gifts: {table:'gift_items',fields:'id,gift_type_id,owner_id,code,source,created_at'},
 transfers: {table:'gift_transfers',fields:'id,gift_item_id,sender_id,recipient_id,status,created_at'},
 trade: {table:'trade_listings',fields:'id,owner_id,wanted_description,status,created_at'},
} as const;
type ReportKey=keyof typeof reports;
function csvCell(value:unknown):string {
 const raw=value===null||value===undefined?'':String(value);
 // Neutralize spreadsheet formula injection before quoting.
 const safe=/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export async function GET(req:Request) {
 const {supabase,user}=await requireUser();
 if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401});
 const access=await requireAdminAccess();
 if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const url=new URL(req.url);
 const kind=url.searchParams.get('report') as ReportKey|null;
 if(!kind||!Object.prototype.hasOwnProperty.call(reports,kind))
  return NextResponse.json({error:'Loại báo cáo không hợp lệ'},{status:400});
 const {table,fields}=reports[kind];
 const columns=fields.split(',');
 const limit=5000, pageSize=500;
 const rows:Record<string,unknown>[]=[];
 for(let start=0;start<limit;start+=pageSize) {
  const {data,error}=await supabase.from(table).select(fields).order('created_at',{ascending:false}).range(start,start+pageSize-1);
  if(error)return NextResponse.json({error:error.message},{status:403});
  const page=(data??[]) as unknown as Record<string,unknown>[];
  rows.push(...page);
  if(page.length<pageSize)break;
 }
 const csv='\uFEFF'+columns.map(csvCell).join(',')+'\r\n'+rows.map(row=>columns.map(col=>csvCell(row[col])).join(',')).join('\r\n');
 return new NextResponse(csv,{headers:{
  'Content-Type':'text/csv; charset=utf-8',
  'Content-Disposition':`attachment; filename="bst-v40-${kind}-${new Date().toISOString().slice(0,10)}.csv"`,
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff',
 }});
}
