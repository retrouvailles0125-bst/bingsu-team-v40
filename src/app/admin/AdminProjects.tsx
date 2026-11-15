'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Project = { id:string; name:string; description:string; is_open:boolean };
export default function AdminProjects({projects}:{projects:Project[]}) {
  const router=useRouter();
  const [items,setItems]=useState(projects);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const field:React.CSSProperties={width:'100%',padding:10,border:'1px solid #efc8dc',borderRadius:9,marginTop:5};
  async function save(project:Project) {
    if(busy)return;
    if(!window.confirm('Lưu thay đổi Project '+project.name+'?'))return;
    setBusy(project.id);setMessage('');
    try {
      const response=await fetch('/api/admin/projects',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(project)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Không thể lưu Project');
      setMessage('Đã lưu '+result.project.name+' vào Supabase.');
      router.refresh();
    } catch(e) {setMessage(e instanceof Error?e.message:'Không thể lưu');}
    finally {setBusy('');}
  }
  return <section className="panel" id="project-management">
    <h2>QUẢN LÝ PROJECT DONATE</h2>
    <p className="muted">Chỉnh sửa Project trên Supabase. Thay đổi trạng thái mở/đóng ảnh hưởng đến form Donate.</p>
    {message&&<p role="status">{message}</p>}
    {items.length===0&&<p>Không có Project hoặc tài khoản chưa có quyền đọc dữ liệu.</p>}
    {items.map(p=><div key={p.id} style={{padding:'15px 0',borderBottom:'1px solid #f0c8df'}}>
      <label>TÊN PROJECT<input style={field} value={p.name} onChange={e=>setItems(a=>a.map(x=>x.id===p.id?{...x,name:e.target.value}:x))}/></label>
      <label>MÔ TẢ<textarea style={field} rows={3} value={p.description} onChange={e=>setItems(a=>a.map(x=>x.id===p.id?{...x,description:e.target.value}:x))}/></label>
      <label><input type="checkbox" checked={p.is_open} onChange={e=>setItems(a=>a.map(x=>x.id===p.id?{...x,is_open:e.target.checked}:x))}/> Đang mở Donate</label>
      <p><button type="button" disabled={!!busy} onClick={()=>save(p)}>{busy===p.id?'ĐANG LƯU...':'LƯU PROJECT'}</button></p>
    </div>)}
  </section>;
}
