'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = Record<string, unknown>;
type Props = { kind: 'profiles' | 'gift_types' | 'posts' | 'letters'; rows: Row[] };
export default function AdminManageActions({kind,rows}:Props) {
 const router=useRouter(); const [busy,setBusy]=useState(''); const [message,setMessage]=useState('');
 const [drafts,setDrafts]=useState<Record<string,Record<string,string>>>({});
 const get=(id:string,key:string,fallback:unknown)=>drafts[id]?.[key]??String(fallback??'');
 const change=(id:string,key:string,value:string)=>setDrafts(prev=>({...prev,[id]:{...prev[id],[key]:value}}));
 async function send(payload:Record<string,unknown>) {
  const id=String(payload.target);
  if(busy || !window.confirm('Xác nhận thao tác quản trị?'))return;
  setBusy(id);setMessage('');
  try {
   const res=await fetch('/api/admin/manage',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const body=await res.json();if(!res.ok)throw Error(body.error||'Thao tác thất bại');
   setMessage('Đã cập nhật Supabase.');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Có lỗi xảy ra');}
  finally{setBusy('');}
 }
 return <div style={{display:'grid',gap:12,marginTop:12}}>
 {message&&<p role="status">{message}</p>}
 {rows.map(row=>{
  const id=String(row.id);
  if(kind==='profiles')return <div key={id} style={{padding:12,border:'1px solid #f0c8df',borderRadius:10}}>
   <strong>{String(row.username||id)}</strong> · {String(row.role)}
   <p>Trạng thái: {row.blocked?'Đã chặn':'Hoạt động'}</p>
   {row.role!=='admin'&&<button disabled={!!busy} onClick={()=>send({action:'profile.block',target:id,blocked:!row.blocked,message:''})}>{row.blocked?'Mở chặn':'Chặn tài khoản'}</button>}
  </div>;
  if(kind==='gift_types')return <div key={id} style={{padding:12,border:'1px solid #f0c8df',borderRadius:10}}>
   <strong>{String(row.name)}</strong> · {String(row.rarity)} · Đã phát hành: {String(row.stock_issued)}
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
   {(['stock_total','normal_weight','gold_weight'] as const).map(k=><label key={k} style={{display:'grid',fontSize:12}}>{k}<input type="number" min="0" step="1" value={get(id,k,row[k])} onChange={e=>change(id,k,e.target.value)} style={{maxWidth:130}}/></label>)}
   <label><input type="checkbox" checked={get(id,'active',row.active)==='true'} onChange={e=>change(id,'active',String(e.target.checked))}/> Đang sử dụng</label>
   </div>
   <button disabled={!!busy} onClick={()=>{
    const normal_weight=Number(get(id,'normal_weight',row.normal_weight)),gold_weight=Number(get(id,'gold_weight',row.gold_weight)),stock_total=Number(get(id,'stock_total',row.stock_total));
    if(![normal_weight,gold_weight,stock_total].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000)){setMessage('Giá trị phải là số nguyên từ 0 đến 1.000.000');return;}
    void send({action:'gift_type.update',target:id,normal_weight,gold_weight,stock_total,active:get(id,'active',row.active)==='true'});
   }}>Lưu tồn kho & xác suất</button>
  </div>;
  return <div key={id} style={{padding:12,border:'1px solid #f0c8df',borderRadius:10}}>
   <strong>{String(row.title||'Thư gửi Trang')}</strong> · {row.hidden?'Đang ẩn':'Đang hiện'}
   <p style={{overflowWrap:'anywhere'}}>{String(row.body??'').slice(0,180)}</p>
   <button disabled={!!busy} onClick={()=>send({action:kind==='posts'?'community_post.hide':'love_message.hide',target:id,hidden:!row.hidden})}>{row.hidden?'Hiện nội dung':'Ẩn nội dung'}</button>
  </div>;
 })}
 </div>;
}
