'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
const db=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Prize={code:string;gift_type_id:string;item_id:string};
type Balance={normal_available:number;gold_available:number};
type SpinHistory={id:string;kind:'normal'|'gold';created_at:string;gift_items:{code:string;gift_types:{name:string;rarity:string}|null}|null};
export default function Star(){
 const [kind,setKind]=useState<'normal'|'gold'>('normal'),[count,setCount]=useState(1),[busy,setBusy]=useState(false),[results,setResults]=useState<Prize[]>([]),[message,setMessage]=useState(''),[balance,setBalance]=useState<Balance|null>(null),[signedIn,setSignedIn]=useState<boolean|null>(null),[history,setHistory]=useState<SpinHistory[]>([]),[historySize,setHistorySize]=useState(10),[historyPage,setHistoryPage]=useState(0),[historyError,setHistoryError]=useState('');
 async function refresh(){
  const {data:{user}}=await db.auth.getUser();setSignedIn(!!user);
  if(!user){setBalance(null);return}
  const {data,error}=await db.from('spin_balances').select('normal_available,gold_available').eq('user_id',user.id).maybeSingle();
  if(error){setMessage('Không đọc được số dư lượt quay: '+error.message);return}
  setBalance(data??{normal_available:0,gold_available:0});
  const spins=await db.from('spin_events').select('id,kind,created_at,gift_items(code,gift_types(name,rarity))').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200);
  setHistory((spins.data||[]) as unknown as SpinHistory[]);setHistoryError(spins.error?.message||'');
 }
 useEffect(()=>{void refresh()},[]);
 async function wish(){
  if(busy)return;
  setMessage('');setResults([]);
  if(!Number.isInteger(count)||count<1||count>10){setMessage('Chọn từ 1 đến 10 lượt mỗi lần.');return}
  const available=kind==='normal'?balance?.normal_available:balance?.gold_available;
  if(available===undefined){setMessage('Chưa xác nhận được số dư. Vui lòng tải lại.');return}
  if(count>available){setMessage('Không đủ lượt '+(kind==='normal'?'Thường':'Gold')+' để quay.');return}
  setBusy(true);const out:Prize[]=[];
  try{
   for(let i=0;i<count;i++){
    const response=await fetch('/api/spin',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({kind,request_id:crypto.randomUUID()})});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'Không quay được');
    out.push(data as Prize);setResults([...out]);
   }
   setMessage('Ước nguyện hoàn thành! '+out.length+' quà đã được lưu vào kho.');
  }catch(e){setMessage((e instanceof Error?e.message:'Có lỗi')+(out.length?' · Đã cấp '+out.length+' quà trước khi dừng.':''))}
  finally{await refresh();setBusy(false)}
 }
 const available=kind==='normal'?balance?.normal_available:balance?.gold_available;
 return <main className="bst-v40-page"><section className="bst-v40-panel" style={{textAlign:'center'}}>
  <Link href="/">← TRANG CHỦ</Link><h1>✦ NGÔI SAO MAY MẮN ✦</h1><p className="muted">Mỗi lượt quay được xác nhận và cấp quà trên Supabase. Kết quả không được tạo trong trình duyệt.</p>
  <div className="grid" style={{margin:'20px 0'}}>
   <div className="bst-v40-metric">LƯỢT THƯỜNG<strong style={{display:'block'}}>{balance?.normal_available??'—'}</strong></div>
   <div className="bst-v40-metric">LƯỢT GOLD<strong style={{display:'block'}}>{balance?.gold_available??'—'}</strong></div>
  </div>
  {signedIn===false&&<p className="note">Bạn cần <Link href="/login">đăng nhập</Link> để sử dụng lượt quay.</p>}
  <label htmlFor="spin-kind">LOẠI LƯỢT QUAY</label><select id="spin-kind" value={kind} onChange={e=>setKind(e.target.value as 'normal'|'gold')} style={{maxWidth:280}}>
   <option value="normal">Thường</option><option value="gold">Gold</option>
  </select>
  <label htmlFor="spin-count">SỐ LƯỢT</label><input id="spin-count" type="number" min={1} max={10} value={count} onChange={e=>setCount(Number(e.target.value))} style={{width:100,maxWidth:'100%'}}/>
  <div className={'bst-v40-star-stage'+(busy?' wish-anim':'')} aria-label='Ngôi Sao May Mắn'>✦ ☄ ✧</div>
  <p className="muted">Có thể sử dụng: {available??'—'} lượt {kind==='normal'?'Thường':'Gold'}</p>
  <button disabled={busy||signedIn!==true||available===undefined||count<1||count>10||count>available} onClick={wish}>{busy?'ĐANG ƯỚC NGUYỆN...':'ƯỚC NGUYỆN'}</button>
  {message&&<p role="status" className="result">{message}</p>}
  <section style={{textAlign:'left',marginTop:30}}><h2>LỊCH SỬ QUAY</h2><p className='muted'>Đã tải {history.length} lượt gần nhất từ Supabase.</p>{historyError&&<p role='alert' className='error'>{historyError}</p>}
   <label htmlFor='spin-history-size'>HIỂN THỊ </label><select id='spin-history-size' value={historySize} onChange={e=>{setHistorySize(Number(e.target.value));setHistoryPage(0)}}>{[10,20,50,100].map(n=><option key={n} value={n}>{n} LƯỢT</option>)}</select>
   <div className='scroll'><table><thead><tr><th>NGÀY QUAY</th><th>LOẠI LƯỢT</th><th>QUÀ NHẬN</th><th>ĐỘ HIẾM</th></tr></thead><tbody>{history.slice(historyPage*historySize,(historyPage+1)*historySize).map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('vi-VN')}</td><td>{h.kind==='gold'?'Gold':'Thường'}</td><td>{h.gift_items?.gift_types?.name||h.gift_items?.code||'—'}</td><td>{h.gift_items?.gift_types?.rarity||'—'}</td></tr>)}{history.length===0&&<tr><td colSpan={4}>Chưa có lượt quay.</td></tr>}</tbody></table></div>
   <div className='row' style={{justifyContent:'center',gap:12,marginTop:14}}><button type='button' className='secondary' disabled={historyPage===0} onClick={()=>setHistoryPage(p=>Math.max(0,p-1))}>← TRƯỚC</button><span>{historyPage+1} / {Math.max(1,Math.ceil(history.length/historySize))}</span><button type='button' className='secondary' disabled={(historyPage+1)*historySize>=history.length} onClick={()=>setHistoryPage(p=>p+1)}>TIẾP →</button></div>
  </section>
  {results.length>0&&<section aria-label="Kết quả quay"><h2>QUÀ ĐÃ NHẬN</h2><div className="grid">{results.map((p,i)=><div key={p.item_id||i} className="bst-v40-metric"><strong>✦</strong><p>Mã quà: {p.code}</p></div>)}</div></section>}
 </section></main>
}
