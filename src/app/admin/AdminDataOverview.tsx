import { supabaseServer } from '@/lib/supabase';
import AdminManageActions from './AdminManageActions';

type Row = Record<string, unknown>;
function GridSection({ id, title, rows, error, fields, kind }: {
  id: string; title: string; rows: Row[]; error?: string; fields: string[]; kind?: 'profiles' | 'gift_types' | 'posts' | 'replies' | 'letters';
}) {
  return <section className="panel" id={id} style={{ scrollMarginTop: 24 }}>
    <h2>{title}</h2>
    {error ? <p role="alert">Không thể tải Supabase: {error}</p> :
      rows.length === 0 ? <p className="muted">Chưa có dữ liệu.</p> :
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr>{fields.map(f => <th key={f} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #f0c8df' }}>{f}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={String(r.id ?? r.user_id ?? i)}>
            {fields.map(f => <td key={f} style={{ padding: 8, borderBottom: '1px solid #f0c8df', overflowWrap: 'anywhere' }}>{String(r[f] ?? '—')}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}
    {kind && !error ? <AdminManageActions kind={kind} rows={rows} /> : <p className="muted">Dữ liệu Supabase — chế độ xem.</p>}
  </section>;
}

export default async function AdminDataOverview({section}:{section:string}) {
  const db = await supabaseServer();
  const [profiles, balances, spins, gifts, types, listings, offers, posts, replies, letters] = await Promise.all([
    db.from('profiles').select('id,username,role,blocked,created_at').limit(100),
    db.from('spin_balances').select('user_id,normal_available,gold_available').limit(100),
    db.from('spin_events').select('id,user_id,kind,gift_item_id,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('gift_items').select('id,gift_type_id,owner_id,code,source,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('gift_types').select('id,name,rarity,stock_total,stock_issued,normal_weight,gold_weight,active').limit(100),
    db.from('trade_listings').select('id,owner_id,wanted_description,status,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('trade_offers').select('id,listing_id,offered_by,status,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('community_posts').select('id,author_id,title,body,hidden,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('community_replies').select('id,post_id,author_id,body,hidden,created_at').order('created_at', { ascending: false }).limit(100),
    db.from('love_messages').select('id,author_id,body,hidden,is_private,created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  return <>
    {section==='accounts-overview' && <GridSection id="accounts-overview" kind="profiles" title="QUẢN LÝ TÀI KHOẢN — DANH SÁCH" rows={profiles.data ?? []} error={profiles.error?.message} fields={['id','username','role','blocked','created_at']} />}
    {section==='tickets-overview' && <GridSection id="tickets-overview" title="SỐ DƯ LƯỢT GACHA" rows={balances.data ?? []} error={balances.error?.message} fields={['user_id','normal_available','gold_available']} />}
    {section==='spins-overview' && <GridSection id="spins-overview" title="KẾT QUẢ QUAY" rows={spins.data ?? []} error={spins.error?.message} fields={['id','user_id','kind','gift_item_id','created_at']} />}
    {section==='gift-types-overview' && <GridSection id="gift-types-overview" kind="gift_types" title="QUẢN LÝ QUÀ VÀ XÁC SUẤT" rows={types.data ?? []} error={types.error?.message} fields={['name','rarity','stock_total','stock_issued','normal_weight','gold_weight','active']} />}
    {section==='gift-items-overview' && <GridSection id="gift-items-overview" title="QUÀ ĐÃ PHÁT HÀNH" rows={gifts.data ?? []} error={gifts.error?.message} fields={['code','gift_type_id','owner_id','source','created_at']} />}
    {section==='trade-overview' && <GridSection id="trade-overview" title="TRADE — DANH SÁCH" rows={listings.data ?? []} error={listings.error?.message} fields={['id','owner_id','wanted_description','status','created_at']} />}
    {section==='offers-overview' && <GridSection id="offers-overview" title="TRADE — ĐỀ NGHỊ" rows={offers.data ?? []} error={offers.error?.message} fields={['id','listing_id','offered_by','status','created_at']} />}
    {section==='community-overview' && <GridSection id="community-overview" kind="posts" title="GIAO LƯU — BÀI VIẾT" rows={posts.data ?? []} error={posts.error?.message} fields={['id','author_id','title','hidden','created_at']} />}
    {section==='replies-overview' && <GridSection id="replies-overview" kind="replies" title="GIAO LƯU — BÌNH LUẬN" rows={replies.data ?? []} error={replies.error?.message} fields={['id','post_id','author_id','body','hidden','created_at']} />}
    {section==='love-overview' && <GridSection id="love-overview" kind="letters" title="THƯ GỬI TRANG" rows={letters.data ?? []} error={letters.error?.message} fields={['id','author_id','body','hidden','is_private','created_at']} />}
  </>;
}
