'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

type Settings={normal_rate:number;gold_rate:number;verify_wait_seconds:number};
export default function AdminGachaSettings({settings}:{settings:Settings|null}) {
  const router=useRouter();
  const [normal,setNormal]=useState(String(settings?.normal_rate??''));
  const [gold,setGold]=useState(String(settings?.gold_rate??''));
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  async function save() {
    const normal_rate=Number(normal),gold_rate=Number(gold);
    if(!Number.isSafeInteger(normal_rate)||normal_rate<1||!Number.isSafeInteger(gold_rate)||gold_rate<1) {
      setNotice('Tỷ lệ phải là số nguyên dương.');return;
    }
    if(!confirm('Lưu tỷ lệ đổi lượt Gacha vào Supabase?'))return;
    setBusy(true);setNotice('');
    try {
      const response=await fetch('/api/admin/gacha-settings',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({normal_rate,gold_rate})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Không thể lưu tỷ lệ');
      setNotice('Đã lưu tỷ lệ đổi lượt vào Supabase.');router.refresh();
    }catch(e){setNotice(e instanceof Error?e.message:'Không thể lưu tỷ lệ');}
    finally{setBusy(false);}
  }
  return <section className="panel" id="gacha-settings">
    <h2>CÀI ĐẶT VÒNG XOAY</h2>
    <div className="row">
      <div><label>Số VND cho 1 lượt quay</label><input type="number" min="1" step="1" value={normal} onChange={e=>setNormal(e.target.value)}/></div>
      <div><label>VND / 1 lượt Gold</label><input type="number" min="1" step="1" value={gold} onChange={e=>setGold(e.target.value)}/></div>
      <button type="button" disabled={busy||!settings} onClick={save}>{busy?'ĐANG LƯU...':'Lưu tỷ lệ'}</button>
    </div>
    <p className="muted">Chỉ lưu tỷ lệ đổi lượt. Thời gian quay 5–10 giây của V40 không bị thay đổi. Thời gian chờ xác minh Donate hiện tại: {settings?.verify_wait_seconds??'—'} giây.</p>
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
