'use client';
import {useState} from 'react';
import {createBrowserClient} from '@supabase/ssr';
type Donation={id:string;received_amount:number|null;normal_rate_snapshot:number|null;gold_rate_snapshot:number|null};
const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export default function TicketAllocation({donations}:{donations:Donation[]}){
 const [busy,setBusy]=useState(''),[done,setDone]=useState<string[]>([]),[notice,setNotice]=useState('');
 async function allocate(id:string,choice:'normal'|'gold_max'){
  if(busy||done.includes(id))return;
  setBusy(id);setNotice('');
  try{
   const {data,error}=await db.rpc('allocate_donation_tickets',{p_donation_id:id,p_choice:choice});
   if(error)throw error;
   setDone(prev=>[...prev,id]);setNotice('Đã phân bổ '+Number(data?.normal_tickets||0)+' lượt Thường và '+Number(data?.gold_tickets||0)+' lượt Gold. Tải lại trang để cập nhật số dư.');
  }catch(e){setNotice(e instanceof Error?e.message:'Không phân bổ được lượt quay.')}finally{setBusy('')}
 }
 if(!donations.length)return null;
 return <section className='bst-v40-panel'><h2>CHỌN LOẠI LƯỢT QUAY SAU VERIFIED</h2><p className='muted'>Mỗi giao dịch Verified chỉ được phân bổ một lần. Lượt quay chỉ được cộng sau khi xác nhận lựa chọn.</p>
 {donations.map(d=>{const normalRate=Number(d.normal_rate_snapshot||0),goldRate=Number(d.gold_rate_snapshot||0),amount=Number(d.received_amount||0);
 const normal=normalRate>0?Math.floor(amount/normalRate):0,gold=goldRate>0?Math.floor(amount/goldRate):0,remaining=amount-gold*goldRate,mixedNormal=normalRate>0?Math.floor(remaining/normalRate):0;
 return <div className='bst-v40-metric' key={d.id} style={{marginBottom:12}}><strong style={{fontSize:15}}>DONATE {d.id.slice(0,8).toUpperCase()}</strong><p>Thực nhận: {amount.toLocaleString('vi-VN')} VND</p>{normalRate>0&&goldRate>0?<><p>Chọn <b>{normal} Thường</b> hoặc <b>{gold} Gold + {mixedNormal} Thường</b>.</p><div className='row' style={{gap:10,flexWrap:'wrap'}}><button type='button' disabled={!!busy||done.includes(d.id)} onClick={()=>void allocate(d.id,'normal')}>NHẬN {normal} THƯỜNG</button><button type='button' disabled={!!busy||done.includes(d.id)} onClick={()=>void allocate(d.id,'gold_max')}>NHẬN {gold} GOLD + {mixedNormal} THƯỜNG</button></div></>:<p role='alert'>Giao dịch thiếu tỷ lệ quy đổi; liên hệ BST trước khi phân bổ.</p>}</div>})}
 {notice&&<p role='status'>{notice}</p>}
 </section>
}
