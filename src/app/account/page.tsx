import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase';
import {formatMoney,formatDate} from '@/config/site';
import AccountSettings from '@/features/account/AccountSettings';
export const dynamic='force-dynamic';
export default async function Account(){
 const db=await supabaseServer();
 const {data:{user}}=await db.auth.getUser();
 if(!user)redirect('/login');
 const [profile,balances,donations,gifts]=await Promise.all([
  db.from('profiles').select('username,role,blocked').eq('id',user.id).maybeSingle(),
  db.from('spin_balances').select('normal_available,gold_available').eq('user_id',user.id).maybeSingle(),
  db.from('donations').select('id,created_at,status,declared_amount,received_amount,projects(name)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
  db.from('gift_items').select('id,code,created_at,gift_types(name,rarity)').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(100)
 ]);
 const ds=(donations.data||[]) as unknown as Array<{id:string;created_at:string;status:string;declared_amount:number;received_amount:number|null;projects:{name:string}|null}>;
 const items=(gifts.data||[]) as unknown as Array<{id:string;code:string;created_at:string;gift_types:{name:string;rarity:string}|null}>;
 return <main className="bst-v40-page">
  <section className="bst-v40-panel"><Link href="/">← TRANG CHỦ</Link><h1>TÀI KHOẢN CỦA TÔI</h1>
   <div className="grid">
    <div className="bst-v40-metric"><h3>ID HIỂN THỊ</h3><strong>{profile.data?.username||'—'}</strong><p>{user.email}</p></div>
    <div className="bst-v40-metric"><h3>LƯỢT THƯỜNG</h3><strong>{balances.data?.normal_available??0}</strong></div>
    <div className="bst-v40-metric"><h3>LƯỢT GOLD</h3><strong>{balances.data?.gold_available??0}</strong></div>
    <div className="bst-v40-metric"><h3>QUÀ ĐANG SỞ HỮU</h3><strong>{items.length}</strong></div>
   </div>
   <p style={{marginTop:18}}><Link href="/star">NGÔI SAO MAY MẮN</Link> · <Link href="/trade">SÀN TRADE GIFT</Link> · <Link href="/logout">ĐĂNG XUẤT</Link></p>
  </section>
  <AccountSettings username={profile.data?.username||''}/>
  <section className="bst-v40-panel"><h2>THỐNG KÊ DONATE CỦA TÔI</h2><div className="bst-v40-metric"><h3>TỔNG DONATE ĐÃ XÁC MINH</h3><strong>{formatMoney(ds.filter(d=>d.status==='verified').reduce((sum,d)=>sum+Number(d.received_amount||0),0))}</strong><p className="muted">Tổng trong {ds.length} giao dịch gần nhất.</p></div></section>
  <section className="bst-v40-panel"><h2>LỊCH SỬ DONATE CỦA TÔI</h2>
   {donations.error?<p role="alert" className="error">{donations.error.message}</p>:<div className="scroll"><table><thead><tr><th>NGÀY</th><th>PROJECT</th><th>KHAI BÁO</th><th>THỰC NHẬN</th><th>TRẠNG THÁI</th></tr></thead>
   <tbody>{ds.map(d=><tr key={d.id}><td>{formatDate(d.created_at)}</td><td>{d.projects?.name||'—'}</td><td>{formatMoney(Number(d.declared_amount||0))}</td><td>{d.status==='verified'?formatMoney(Number(d.received_amount||0)):'—'}</td><td><span className="tag">{d.status}</span></td></tr>)}
   {ds.length===0&&<tr><td colSpan={5}>Chưa có Donate.</td></tr>}</tbody></table></div>}
  </section>
  <section className="bst-v40-panel"><h2>KHO QUÀ CỦA TÔI</h2>
   {gifts.error?<p role="alert" className="error">{gifts.error.message}</p>:<div className="grid">{items.map(g=><div className="bst-v40-metric" key={g.id}><h3>{g.gift_types?.name||'Quà'}</h3><p>Độ hiếm: {g.gift_types?.rarity||'—'}</p><strong style={{fontSize:15}}>{g.code}</strong></div>)}
   {items.length===0&&<p className="muted">Chưa có quà trong kho.</p>}</div>}
  </section>
 </main>
}
