'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Settings={bank_name:string;account_name:string;account_number:string;qr_image_url:string;instructions:string};
const empty:Settings={bank_name:'',account_name:'',account_number:'',qr_image_url:'',instructions:''};
export default function AdminBankSettings({initial}:{initial:Settings|null}){
 const router=useRouter();const [value,setValue]=useState<Settings>(initial??empty);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function save(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();if(busy||!window.confirm('Lưu thông tin tài khoản nhận Donate?'))return;
 setBusy(true);setMessage('');
 try{const res=await fetch('/api/admin/bank-settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 const body=await res.json();if(!res.ok)throw Error(body.error||'Lưu thất bại');
 setMessage('Đã lưu cấu hình Supabase.');router.refresh();
 }catch(e){setMessage(e instanceof Error?e.message:'Có lỗi xảy ra');}finally{setBusy(false);}
 }
 return <section className="panel" id="bank-settings" style={{scrollMarginTop:24}}>
 <h2>NGÂN HÀNG & QR DONATE</h2>
 <p className="muted">Cấu hình thông tin nhận Donate. Chỉ dùng đường dẫn HTTPS công khai cho ảnh QR; không nhập mật khẩu hoặc khóa ngân hàng.</p>
 <form onSubmit={save} style={{display:'grid',gap:12,maxWidth:600}}>
 {([['bank_name','Ngân hàng'],['account_name','Tên chủ tài khoản'],['account_number','Số tài khoản'],['qr_image_url','Link ảnh QR (HTTPS)'],['instructions','Hướng dẫn chuyển khoản']] as const).map(([key,label])=><label key={key} style={{display:'grid',gap:4}}>{label}
 {key==='instructions'?<textarea maxLength={2000} value={value[key]} onChange={e=>setValue(v=>({...v,[key]:e.target.value}))}/>:
 <input maxLength={key==='qr_image_url'?1000:key==='account_number'?60:120} value={value[key]} onChange={e=>setValue(v=>({...v,[key]:e.target.value}))}/>}
 </label>)}
 <button disabled={busy} type="submit">{busy?'Đang lưu...':'Lưu thông tin ngân hàng'}</button>
 {message&&<p role="status">{message}</p>}
 </form></section>;
}
