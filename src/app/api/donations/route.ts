import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase';
const schema=z.object({project_id:z.string().uuid(),declared_amount:z.coerce.number().int().positive().max(1000000000),kandee_message:z.string().max(2000),bst_message:z.string().max(2000)});
export async function POST(req:Request){
 const {supabase,user}=await requireUser();if(!user)return NextResponse.json({error:'Vui lòng đăng nhập'},{status:401});
 const form=await req.formData().catch(()=>null);if(!form)return NextResponse.json({error:'Form không hợp lệ'},{status:400});
 const input=schema.safeParse({project_id:form.get('project_id'),declared_amount:form.get('declared_amount'),kandee_message:form.get('kandee_message')||'',bst_message:form.get('bst_message')||''});
 if(!input.success)return NextResponse.json({error:'Thông tin Donate không hợp lệ'},{status:400});
 const bills=form.getAll('bills').filter((f):f is File=>f instanceof File);
 if(bills.length<1||bills.length>3)return NextResponse.json({error:'Bắt buộc 1–3 bill'},{status:400});
 if(bills.some(f=>f.size>5*1024*1024||f.size===0||!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)))return NextResponse.json({error:'Bill không hợp lệ hoặc quá 5 MB'},{status:400});
 const {data:project}=await supabase.from('projects').select('id').eq('id',input.data.project_id).eq('is_open',true).maybeSingle();if(!project)return NextResponse.json({error:'Project đã đóng hoặc không tồn tại'},{status:400});
 const {data:donation,error}=await supabase.from('donations').insert({user_id:user.id,project_id:input.data.project_id,declared_amount:input.data.declared_amount,kandee_message:input.data.kandee_message,bst_message:input.data.bst_message}).select('id,status').single();
 if(error||!donation)return NextResponse.json({error:error?.message||'Không tạo được khai báo'},{status:400});
 const paths:string[]=[];
 for(let i=0;i<bills.length;i++){
  const file=bills[i];const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'} as Record<string,string>)[file.type];
  const path=`${user.id}/${donation.id}/${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await supabase.storage.from('donation-bills').upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError){await supabase.from('donations').delete().eq('id',donation.id);if(paths.length)await supabase.storage.from('donation-bills').remove(paths);return NextResponse.json({error:'Không tải được bill: '+uploadError.message},{status:500});}
  paths.push(path);
  const {error:linkError}=await supabase.from('donation_bills').insert({donation_id:donation.id,storage_path:path,uploaded_by:user.id});
  if(linkError)return NextResponse.json({error:'Bill đã tải lên nhưng lưu liên kết thất bại; liên hệ BST và cung cấp mã '+donation.id},{status:500});
 }
 return NextResponse.json({id:donation.id,status:donation.status},{status:201});
}
