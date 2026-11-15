import {supabaseServer} from '@/lib/supabase';
import {formatMoney,formatDate} from '@/config/site';
export const dynamic='force-dynamic';
type Donation={id:string;received_amount:number|null;created_at:string;verified_at:string|null;projects:{name:string}|null};
export default async function Tracking(){
 const db=await supabaseServer();
 const {data,error}=await db.from('donations')
  .select('id,received_amount,created_at,verified_at,projects(name)')
  .eq('status','verified').not('verified_at','is',null)
  .order('verified_at',{ascending:false}).limit(200);
 const donations=(data||[]) as unknown as Donation[];
 const totals=new Map<string,{count:number;amount:number}>();
 for(const d of donations){const name=d.projects?.name||'Project';const current=totals.get(name)||{count:0,amount:0};current.count++;current.amount+=Number(d.received_amount||0);totals.set(name,current)}
 return <main className="bst-v40-page"><section className="bst-v40-panel">
  <h1>THEO DÕI DONATE</h1><p className="muted">Chỉ công khai giao dịch đã xác minh, không hiển thị email, bill hoặc thông tin cá nhân. Bảng dưới đây giới hạn 200 giao dịch mới nhất.</p>
  {error?<p role="alert" className="error">Chưa tải được bảng Donate: {error.message}</p>:<>
   <div className="grid" style={{margin:'16px 0'}}>
    <div className="bst-v40-metric">GIAO DỊCH VERIFIED<strong style={{display:'block'}}>{donations.length}</strong></div>
    <div className="bst-v40-metric">TỔNG TRONG BẢNG<strong style={{display:'block'}}>{formatMoney(donations.reduce((sum,d)=>sum+Number(d.received_amount||0),0))}</strong></div>
   </div>
   <h2>THỐNG KÊ THEO PROJECT (200 GIAO DỊCH MỚI NHẤT)</h2>
   <div className="grid">{[...totals].map(([name,value])=><div className="bst-v40-metric" key={name}><h3>{name}</h3><p>{value.count} giao dịch</p><strong>{formatMoney(value.amount)}</strong></div>)}</div>
   <h2 style={{marginTop:24}}>LỊCH SỬ DONATE VERIFIED</h2>
   <div className="scroll"><table><thead><tr><th>NGÀY XÁC MINH</th><th>PROJECT</th><th>THỰC NHẬN</th><th>TRẠNG THÁI</th></tr></thead>
   <tbody>{donations.map(d=><tr key={d.id}><td>{formatDate(d.verified_at||d.created_at)}</td><td>{d.projects?.name||'—'}</td><td>{formatMoney(Number(d.received_amount||0))}</td><td><span className="tag ok">Verified</span></td></tr>)}
   {donations.length===0&&<tr><td colSpan={4}>Chưa có Donate Verified công khai.</td></tr>}</tbody></table></div>
  </>}
 </section></main>
}
