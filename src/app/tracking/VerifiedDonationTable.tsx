'use client';
import {useMemo,useState} from 'react';
import {formatDate,formatMoney} from '@/config/site';

export type VerifiedDonation={donation_id:string;received_amount:number|null;verified_at:string|null;project_name:string};
export default function VerifiedDonationTable({donations}:{donations:VerifiedDonation[]}){
 const [search,setSearch]=useState(''),[project,setProject]=useState('all'),[sort,setSort]=useState<'newest'|'oldest'|'highest'>('newest');
 const projects=useMemo(()=>Array.from(new Set(donations.map(d=>d.project_name||'Project'))).sort((a,b)=>a.localeCompare(b,'vi')),[donations]);
 const rows=useMemo(()=>donations.filter(d=>(project==='all'||(d.project_name||'Project')===project)&&(!search.trim()||(d.project_name||'Project').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))).sort((a,b)=>sort==='highest'?Number(b.received_amount||0)-Number(a.received_amount||0):sort==='oldest'?new Date(a.verified_at||0).getTime()-new Date(b.verified_at||0).getTime():new Date(b.verified_at||0).getTime()-new Date(a.verified_at||0).getTime()),[donations,project,search,sort]);
 return <section className="bst-v40-tracking-history">
  <div className="bst-v40-tracking-heading"><h2>✦ LỊCH SỬ DONATE VERIFIED</h2><span>{rows.length} / {donations.length} giao dịch</span></div>
  <div className="bst-v40-tracking-filters">
   <label htmlFor="tracking-search">TÌM THEO PROJECT<input id="tracking-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập tên project..." /></label>
   <label htmlFor="tracking-project">PROJECT<select id="tracking-project" value={project} onChange={e=>setProject(e.target.value)}><option value="all">Tất cả project</option>{projects.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <label htmlFor="tracking-sort">SẮP XẾP<select id="tracking-sort" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="highest">Số tiền cao nhất</option></select></label>
  </div>
  <div className="scroll"><table><thead><tr><th>NGÀY XÁC MINH</th><th>PROJECT</th><th>THỰC NHẬN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{rows.map(d=><tr key={d.donation_id}><td>{d.verified_at?formatDate(d.verified_at):'—'}</td><td>{d.project_name||'—'}</td><td>{formatMoney(Number(d.received_amount||0))}</td><td><span className="tag ok">Verified</span></td></tr>)}{rows.length===0&&<tr><td colSpan={4}>Không có giao dịch phù hợp bộ lọc.</td></tr>}</tbody></table></div>
  <p className="muted">Chỉ hiển thị giao dịch đã xác minh trong phạm vi dữ liệu công khai gần nhất. Không công khai ID, email, bill hoặc mã tham chiếu của người Donate.</p>
 </section>;
}
