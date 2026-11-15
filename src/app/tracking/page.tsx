import {supabaseServer} from '@/lib/supabase';
import {formatMoney} from '@/config/site';
import VerifiedDonationTable from './VerifiedDonationTable';
export const dynamic='force-dynamic';
type Donation={donation_id:string;received_amount:number|null;verified_at:string|null;project_name:string};
export default async function Tracking(){
 const db=await supabaseServer();
 const {data,error}=await db.rpc('bst_public_verified_donations');
 const donations=(data||[]) as unknown as Donation[];
 const totals=new Map<string,{count:number;amount:number}>();
 for(const d of donations){const name=d.project_name||'Project';const current=totals.get(name)||{count:0,amount:0};current.count++;current.amount+=Number(d.received_amount||0);totals.set(name,current)}
 return <main className="bst-v40-page bst-v40-tracking"><section className="bst-v40-panel">
  <div className="bst-v40-tracking-hero"><span>✦ BINGSU TEAM TRANSPARENCY ✦</span><h1>♡ THEO DÕI DONATE ♡</h1><p>Cùng theo dõi những đóng góp đã được xác minh cho các Project.</p></div><p className="muted">Chỉ công khai giao dịch đã xác minh, không hiển thị email, bill hoặc thông tin cá nhân. Bảng dưới đây giới hạn 200 giao dịch mới nhất.</p>
  {error?<p role="alert" className="error">Chưa tải được bảng Donate: {error.message}</p>:<>
   <div className="grid" style={{margin:'16px 0'}}>
    <div className="bst-v40-metric">GIAO DỊCH VERIFIED<strong style={{display:'block'}}>{donations.length}</strong></div>
    <div className="bst-v40-metric">TỔNG TRONG BẢNG<strong style={{display:'block'}}>{formatMoney(donations.reduce((sum,d)=>sum+Number(d.received_amount||0),0))}</strong></div>
   </div>
   <h2>THỐNG KÊ THEO PROJECT (200 GIAO DỊCH MỚI NHẤT)</h2>
   <div className="grid">{[...totals].map(([name,value])=><div className="bst-v40-metric" key={name}><h3>{name}</h3><p>{value.count} giao dịch</p><strong>{formatMoney(value.amount)}</strong></div>)}</div>
   <VerifiedDonationTable donations={donations} />
  </>}
 </section></main>
}
