'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Profile={id:string;username:string|null;blocked:boolean;role:string};
type Grant={id:string;recipient_id:string;actor_id:string;normal_count:number;gold_count:number;reason:string;created_at:string};
export default function AdminTicketGrants({profiles,history,historyError}:{profiles:Profile[];history:Grant[];historyError?:string}){
 const router=useRouter();
 const [recipient,setRecipient]=useState('');
 const [normal,setNormal]=useState('0');
 const [gold,setGold]=useState('0');
 const [reason,setReason]=useState('');
 const [requestId,setRequestId]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const eligible=profiles.filter(p=>!p.blocked&&p.role!=='admin');
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy)return;
  const n=Number(normal),g=Number(gold);
  if(!recipient||![n,g].every(v=>Number.isSafeInteger(v)&&v>=0&&v<=10000)||n+g===0||reason.trim().length<3){setMessage('Kiểm tra Kandee, số lượt và lý do (ít nhất 3 ký tự).');return;}
  if(!window.confirm(`Xác nhận cấp ${n} Normal và ${g} Gold? Không thể tự động hoàn tác.`))return;
  const id=requestId||crypto.randomUUID();
  setRequestId(id);setBusy(true);setMessage('');
  try{
   const res=await fetch('/api/admin/ticket-grants',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id:id,recipient_id:recipient,normal:n,gold:g,reason:reason.trim()})});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Không thể cấp lượt');
   setMessage(data.result?.already_processed?'Yêu cầu đã được xử lý trước đó, không cộng trùng.':'Đã cấp lượt thành công vào Supabase.');
   setRequestId('');setNormal('0');setGold('0');setReason('');router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:'Có lỗi xảy ra. Có thể thử lại với cùng mã yêu cầu.');}
  finally{setBusy(false);}
 }
 return <section className="panel" id="grant-tickets" style={{scrollMarginTop:24}}>
  <h2>TẶNG LƯỢT QUAY — NORMAL / GOLD</h2>
  <p className="muted">Cấp lượt trực tiếp vào ví Kandee. Mỗi yêu cầu có mã chống cấp trùng và lưu lịch sử.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12,maxWidth:520}}>
   <label>Kandee
    <select required value={recipient} onChange={e=>{setRecipient(e.target.value);setRequestId('');}} style={{display:'block',width:'100%',padding:10}}>
     <option value="">Chọn tài khoản</option>
     {eligible.map(p=><option key={p.id} value={p.id}>{p.username||'Kandee'} — {p.id}</option>)}
    </select>
   </label>
   <label>Normal <input required type="number" min="0" max="10000" step="1" value={normal} onChange={e=>{setNormal(e.target.value);setRequestId('');}} /></label>
   <label>Gold <input required type="number" min="0" max="10000" step="1" value={gold} onChange={e=>{setGold(e.target.value);setRequestId('');}} /></label>
   <label>Lý do <textarea required minLength={3} maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);setRequestId('');}} style={{display:'block',width:'100%'}} /></label>
   <button disabled={busy||!recipient} type="submit">{busy?'Đang xử lý...':'Xác nhận cấp lượt'}</button>
   {message&&<p role="status">{message}</p>}
  </form>
 <h3 style={{marginTop:24}}>LỊCH SỬ CẤP LƯỢT</h3>
 {historyError?<p role="alert">Không thể tải lịch sử: {historyError}</p>:history.length===0?<p className="muted">Chưa có lần cấp lượt nào.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:13}}><thead><tr><th>Thời gian</th><th>Kandee</th><th>Normal</th><th>Gold</th><th>Lý do</th><th>Admin</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('vi-VN')}</td><td>{profiles.find(p=>p.id===h.recipient_id)?.username||h.recipient_id}</td><td>{h.normal_count}</td><td>{h.gold_count}</td><td>{h.reason}</td><td>{h.actor_id}</td></tr>)}</tbody></table></div>}
 </section>;
}
