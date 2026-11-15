'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
type Project={id:string;name:string;is_open:boolean};
type Bank={bank_name:string;account_name:string;account_number:string;qr_image_url:string;instructions:string};
const money=(n:string)=>n.replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
export default function Donate(){
 const [projects,setProjects]=useState<Project[]>([]),[project,setProject]=useState(''),[projectError,setProjectError]=useState('');
 const [bank,setBank]=useState<Bank|null>(null),[bankError,setBankError]=useState('');
 const [mode,setMode]=useState<'not_paid'|'paid'>('not_paid'),[amount,setAmount]=useState(''),[kandee,setKandee]=useState(''),[bst,setBst]=useState('');
 const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  let live=true;
  Promise.allSettled([
   fetch('/api/projects/open',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Không tải được Project');return d.projects as Project[]}),
   fetch('/api/donations/bank-settings',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Không tải được thông tin ngân hàng');return d.settings as Bank|null})
  ]).then(([p,b])=>{
   if(!live)return;
   if(p.status==='fulfilled'){const opened=p.value.filter(x=>x.is_open===true);setProjects(opened);const requested=new URLSearchParams(window.location.search).get('project');setProject(opened.find(x=>x.id===requested)?.id||opened[0]?.id||'');if(!opened.length)setProjectError('Hiện chưa có Project đang mở Donate.')}
   else setProjectError(p.reason instanceof Error?p.reason.message:'Không tải được Project.');
   if(b.status==='fulfilled')setBank(b.value);
   else setBankError(b.reason instanceof Error?b.reason.message:'Không tải được thông tin ngân hàng.');
  });
  return()=>{live=false};
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setMessage('');
  if(mode!=='paid'){setMessage('Vui lòng hoàn tất chuyển khoản và chọn ĐÃ CHUYỂN KHOẢN trước khi gửi khai báo.');return}
  if(files.length<1||files.length>3){setMessage('Cần 1–3 bill chuyển khoản.');return}
  if(!projects.some(p=>p.id===project)){setMessage('Project không còn mở Donate.');return}
  setBusy(true);
  try{
   const body=new FormData();body.set('project_id',project);body.set('declared_amount',amount.replace(/\D/g,''));body.set('kandee_message',kandee);body.set('bst_message',bst);
   files.forEach(f=>body.append('bills',f));
   const response=await fetch('/api/donations',{method:'POST',body});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Không gửi được Donate');
   setMessage('Đã gửi khai báo '+result.id+'. Trạng thái đang chờ BST đối soát; chưa cấp lượt quay.');
   setFiles([]);
  }catch(e){setMessage(e instanceof Error?e.message:'Không gửi được Donate.')}finally{setBusy(false)}
 }
 return <main className="bst-v40-page">
  <section className="bst-v40-panel"><Link href="/">← TRANG CHỦ</Link><h1>DONATE CHO PROJECT</h1>
   <p className="muted">Chọn Project, xem thông tin chuyển khoản rồi khai báo bill để BST đối soát. Chỉ giao dịch Verified mới được cộng vào thống kê.</p>
   {projectError&&<p role="alert" className="error">{projectError}</p>}
   <label htmlFor="donate-project">PROJECT ĐANG MỞ</label><select id="donate-project" value={project} onChange={e=>setProject(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   <h2 style={{marginTop:24}}>BƯỚC 1 · TRẠNG THÁI CHUYỂN KHOẢN</h2>
   <div className="grid" role="group" aria-label="Trạng thái chuyển khoản">
    <button type="button" className={mode==='not_paid'?'':'secondary'} onClick={()=>{setMode('not_paid');setMessage('')}} aria-pressed={mode==='not_paid'}>CHƯA CHUYỂN KHOẢN</button>
    <button type="button" className={mode==='paid'?'':'secondary'} onClick={()=>{setMode('paid');setMessage('')}} aria-pressed={mode==='paid'}>ĐÃ CHUYỂN KHOẢN</button>
   </div>
   <div className="bst-v40-metric" style={{marginTop:16}}>
    <h3>THÔNG TIN CHUYỂN KHOẢN</h3>
    {bankError&&<p role="alert" className="error">{bankError}</p>}
    {bank&&(bank.bank_name||bank.account_number)?<>
      <p><strong>Ngân hàng:</strong> {bank.bank_name||'—'}</p><p><strong>Chủ tài khoản:</strong> {bank.account_name||'—'}</p>
      <p><strong>Số tài khoản:</strong> {bank.account_number||'—'} {bank.account_number&&<button type="button" className="secondary" onClick={()=>navigator.clipboard.writeText(bank.account_number)}>SAO CHÉP</button>}</p>
      {bank.qr_image_url&&<div style={{textAlign:'center',margin:'16px 0'}}><img src={bank.qr_image_url} alt="QR chuyển khoản do BINGSU TEAM cung cấp" style={{width:'min(100%,320px)',height:'auto',borderRadius:14}}/></div>}
      {bank.instructions&&<p style={{whiteSpace:'pre-wrap'}}>{bank.instructions}</p>}
     </>:<p className="muted">BST chưa công bố thông tin chuyển khoản trong hệ thống. Vui lòng kiểm tra với BST trước khi chuyển tiền.</p>}
   </div>
   {mode==='not_paid'?<div className="note" style={{marginTop:16}}>Bạn có thể xem QR và thông tin chuyển khoản tại đây. Sau khi chuyển khoản thành công, chọn <strong>ĐÃ CHUYỂN KHOẢN</strong> để khai báo. Hệ thống chưa tạo giao dịch hoặc cấp lượt quay ở bước này.</div>:<>
    <h2 style={{marginTop:24}}>BƯỚC 2 · KHAI BÁO DONATE ĐÃ CHUYỂN</h2>
    <form onSubmit={submit}>
     <label htmlFor="donate-amount">SỐ TIỀN ĐÃ CHUYỂN (VND)</label><input id="donate-amount" required inputMode="numeric" value={amount} onChange={e=>setAmount(money(e.target.value))} placeholder="100.000"/>
     <label htmlFor="donate-kandee">LỜI NHẮN CHO KANDEE (KHÔNG BẮT BUỘC)</label><textarea id="donate-kandee" rows={4} maxLength={2000} value={kandee} onChange={e=>setKandee(e.target.value)}/>
     <label htmlFor="donate-bst">LỜI NHẮN CHO BINGSU TEAM (KHÔNG BẮT BUỘC)</label><textarea id="donate-bst" rows={4} maxLength={2000} value={bst} onChange={e=>setBst(e.target.value)}/>
     <label htmlFor="donate-bills">BILL CHUYỂN KHOẢN (BẮT BUỘC)</label><input id="donate-bills" required type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
     <p className="muted">Đã chọn {files.length} bill · Tối đa 3 file, 5 MB mỗi file (JPG, PNG, WebP, PDF).</p>
     <button disabled={busy||!project||!amount||files.length<1||files.length>3}>{busy?'ĐANG GỬI...':'GỬI XÁC NHẬN DONATE'}</button>
    </form>
   </>}
   {message&&<p role="status" className="result">{message}</p>}
  </section>
 </main>
}
