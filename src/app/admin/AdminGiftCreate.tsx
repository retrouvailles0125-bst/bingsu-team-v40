'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function AdminGiftCreate(){
 const router=useRouter();
 const [name,setName]=useState(''),[rarity,setRarity]=useState('normal'),[stock,setStock]=useState(0),[normal,setNormal]=useState(0),[gold,setGold]=useState(0),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  if(!window.confirm('Tạo loại quà mới với tồn kho và xác suất đã nhập?'))return;
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/gift-types',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,rarity,stock_total:stock,normal_weight:normal,gold_weight:gold,active})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Không tạo được quà');
   setName('');setStock(0);setNormal(0);setGold(0);setActive(false);
   setMessage('Đã tạo loại quà.');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Có lỗi');}finally{setBusy(false)}
 }
 return <section className="panel"><h2>THÊM LOẠI QUÀ VÀO GACHA</h2><p className="muted">Quà mới mặc định chưa kích hoạt để tránh quay nhầm. Loại quà sẽ được liên kết tự động với Ngôi Sao May Mắn qua Supabase. Trọng số bằng 0 nghĩa là không xuất hiện trong loại lượt quay tương ứng.</p>
 <form onSubmit={save} style={{display:'grid',gap:12,maxWidth:520}}>
  <label>Tên quà<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
  <label>Độ hiếm<select value={rarity} onChange={e=>setRarity(e.target.value)}><option value="normal">Normal</option><option value="rare">Rare</option><option value="ssr">SSR</option><option value="secret">Secret</option></select></label>
  <label>Tổng số lượng<input type="number" min="0" max="1000000" required value={stock} onChange={e=>setStock(Number(e.target.value))}/></label>
  <label>Trọng số lượt Thường<input type="number" min="0" max="1000000" required value={normal} onChange={e=>setNormal(Number(e.target.value))}/></label>
  <label>Trọng số lượt Gold<input type="number" min="0" max="1000000" required value={gold} onChange={e=>setGold(Number(e.target.value))}/></label>
  <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Kích hoạt quà</label>
  <button disabled={busy||!name.trim()} type="submit">{busy?'ĐANG LƯU...':'TẠO LOẠI QUÀ'}</button>
  {message&&<p role="status">{message}</p>}
 </form></section>;
}
