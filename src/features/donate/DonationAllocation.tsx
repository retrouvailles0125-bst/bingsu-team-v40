'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Donation = {
  id: string;
  status: string;
  declared_amount: number;
  received_amount: number | null;
  normal_tickets: number | null;
  gold_tickets: number | null;
  allocation_completed_at: string | null;
};
type Settings = { normal_rate: number; gold_rate: number };
const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' VND';

export default function DonationAllocation() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const db = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) {
      setError('Vui lòng đăng nhập để xem và phân bổ lượt Donate.');
      setLoading(false);
      return;
    }
    const [donationResult, settingsResult] = await Promise.all([
      db.from('donations')
        .select('id,status,declared_amount,received_amount,normal_tickets,gold_tickets,allocation_completed_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      db.from('gacha_exchange_settings')
        .select('normal_rate,gold_rate')
        .eq('id', true)
        .maybeSingle()
    ]);
    if (donationResult.error) setError('Không tải được Donate: ' + donationResult.error.message);
    else {
      setError('');
      setDonations(donationResult.data ?? []);
    }
    if (!settingsResult.error) setSettings(settingsResult.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function allocate(id: string, choice: 'normal' | 'gold_max') {
    if (busy) return;
    if (!window.confirm(choice === 'normal'
      ? 'Xác nhận đổi toàn bộ số tiền đủ điều kiện thành lượt Normal?'
      : 'Xác nhận ưu tiên đổi tối đa lượt Gold, phần còn lại thành Normal?')) return;
    setBusy(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/donations/allocate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donation_id: id, choice })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Không phân bổ được lượt.');
      setNotice('Đã phân bổ lượt Gacha. Vui lòng kiểm tra kết quả bên dưới.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi phân bổ lượt.');
    } finally {
      setBusy('');
    }
  }

  const verified = donations.filter(d => d.status === 'verified');
  const panel: React.CSSProperties = {
    border: '1px solid #efc2dc', borderRadius: 14, padding: 16,
    background: '#fff', marginTop: 12
  };
  const button: React.CSSProperties = {
    border: 0, borderRadius: 10, padding: '12px 14px',
    background: '#e12589', color: 'white', fontWeight: 700,
    cursor: 'pointer', marginRight: 8, marginTop: 8
  };
  return <section style={{ marginTop: 30 }}>
    <h2 style={{ color: '#b31a70' }}>DONATE ĐÃ XÁC MINH · PHÂN BỔ LƯỢT GACHA</h2>
    <p>Sau khi BST xác minh, Kandee chọn cách đổi lượt. Trạng thái VERIFIED không tự động cộng lượt trước khi phân bổ.</p>
    {settings && <p>Normal: {money(settings.normal_rate)}/lượt · Gold: {money(settings.gold_rate)}/lượt</p>}
    <button type="button" onClick={() => void load()} style={{ ...button, background: '#fff', color: '#b31a70', border: '1px solid #e12589' }}>Làm mới Donate</button>
    {loading && <p>Đang tải Donate...</p>}
    {error && <p role="alert" style={{ color: '#b42346' }}>{error}</p>}
    {notice && <p role="status" style={{ color: '#17663d' }}>{notice}</p>}
    {!loading && !verified.length && <p>Chưa có Donate VERIFIED trong tài khoản này.</p>}
    {verified.map(d => <article key={d.id} style={panel}>
      <strong>Donate {money(d.received_amount ?? d.declared_amount)}</strong>
      <p style={{ fontSize: 12, overflowWrap: 'anywhere' }}>Mã: {d.id}</p>
      <p>Normal: {d.normal_tickets ?? 0} · Gold: {d.gold_tickets ?? 0}</p>
      {d.allocation_completed_at ? <p style={{ color: '#17663d' }}>Đã phân bổ lượt thành công.</p> : <>
        <p>Đang chờ chọn phân bổ lượt.</p>
        <button type="button" style={button} disabled={Boolean(busy)} onClick={() => void allocate(d.id, 'normal')}>Đổi Normal</button>
        <button type="button" style={button} disabled={Boolean(busy)} onClick={() => void allocate(d.id, 'gold_max')}>Ưu tiên Gold tối đa</button>
      </>}
    </article>)}
  </section>;
}
