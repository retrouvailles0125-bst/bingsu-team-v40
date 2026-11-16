'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
import {formatDate} from '@/config/site';

const db = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Prize = {code: string; gift_type_id: string; item_id: string};
type Balance = {normal_available: number; gold_available: number};
type GiftInfo = {name: string; rarity: string} | null;
type SpinHistory = {
  id: string;
  kind: 'normal' | 'gold';
  created_at: string;
  gift_items: {code: string; gift_types: GiftInfo} | null;
};
type InventoryItem = {id: string; code: string; gift_types: GiftInfo};
type Grant = {id: string; normal_count: number; gold_count: number; reason: string; created_at: string};

const RARITY: Record<string, string> = {normal: 'Thường', rare: 'Rare', ssr: 'SSR', secret: 'Secret'};
const rarityLabel = (r?: string | null) => (r && RARITY[r]) || 'Thường';

export default function Star() {
  const [kind, setKind] = useState<'normal' | 'gold'>('normal');
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Prize[]>([]);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [history, setHistory] = useState<SpinHistory[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [spinTotal, setSpinTotal] = useState(0);
  const [historySize, setHistorySize] = useState(10);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyError, setHistoryError] = useState('');

  async function refresh() {
    const {data: {user}} = await db.auth.getUser();
    setSignedIn(!!user);
    if (!user) {
      setBalance(null);
      setHistory([]);
      setInventory([]);
      setGrants([]);
      setSpinTotal(0);
      setHistoryError('');
      return;
    }

    const {data, error} = await db
      .from('spin_balances')
      .select('normal_available,gold_available')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      setBalance(null);
      setHistory([]);
      setHistoryError('Không đọc được số dư lượt quay: ' + error.message);
      return;
    }
    setBalance(data ?? {normal_available: 0, gold_available: 0});

    const spins = await db
      .from('spin_events')
      .select('id,kind,created_at,gift_items(code,gift_types(name,rarity))')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false})
      .limit(200);
    setHistory((spins.data || []) as unknown as SpinHistory[]);
    setHistoryPage(0);
    setHistoryError(spins.error?.message || '');

    const total = await db
      .from('spin_events')
      .select('id', {count: 'exact', head: true})
      .eq('user_id', user.id);
    setSpinTotal(total.count ?? 0);

    const items = await db
      .from('gift_items')
      .select('id,code,gift_types(name,rarity)')
      .eq('owner_id', user.id)
      .order('created_at', {ascending: false})
      .limit(200);
    setInventory((items.data || []) as unknown as InventoryItem[]);

    const granted = await db.rpc('bst_my_ticket_grants');
    setGrants((granted.data || []) as unknown as Grant[]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function wish() {
    if (busy) return;
    setMessage('');
    setResults([]);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      setMessage('Chọn từ 1 đến 10 lượt mỗi lần.');
      return;
    }
    const left = kind === 'normal' ? balance?.normal_available : balance?.gold_available;
    if (left === undefined) {
      setMessage('Chưa xác nhận được số dư. Vui lòng tải lại.');
      return;
    }
    if (count > left) {
      setMessage('Không đủ lượt ' + (kind === 'normal' ? 'Thường' : 'Gold') + ' để quay.');
      return;
    }
    setBusy(true);
    const out: Prize[] = [];
    try {
      for (let i = 0; i < count; i++) {
        const response = await fetch('/api/spin', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'same-origin',
          body: JSON.stringify({kind, request_id: crypto.randomUUID()}),
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || 'Không quay được');
        out.push(data as Prize);
        setResults([...out]);
      }
      setMessage('Ước nguyện hoàn thành! ' + out.length + ' quà đã được lưu vào kho.');
    } catch (e) {
      setMessage(
        (e instanceof Error ? e.message : 'Có lỗi') +
          (out.length ? ' · Đã cấp ' + out.length + ' quà trước khi dừng.' : '')
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  const available = kind === 'normal' ? balance?.normal_available : balance?.gold_available;
  const pages = Math.max(1, Math.ceil(history.length / historySize));
  const pageRows = history.slice(historyPage * historySize, (historyPage + 1) * historySize);

  return (
    <main id="app">
      <section className="panel">
        <h2>NGÔI SAO MAY MẮN</h2>
        <div className="grid">
          <div className="metric">Thường còn<b>{balance?.normal_available ?? 0}</b></div>
          <div className="metric">Gold còn<b>{balance?.gold_available ?? 0}</b></div>
          <div className="metric">Đã quay<b>{spinTotal}</b></div>
        </div>
        <p className="muted">
          Gold có trọng số trúng quà hiếm cao hơn. Mỗi lần quay tiêu hao 1 lượt của loại đã chọn.
        </p>
        {signedIn === false && (
          <p className="note">
            Bạn cần <Link href="/login">đăng nhập</Link> để sử dụng lượt quay.
          </p>
        )}
        <label htmlFor="spinType">CHỌN LOẠI LƯỢT QUAY</label>
        <select
          id="spinType"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'normal' | 'gold')}
        >
          <option value="normal">Lượt thường</option>
          <option value="gold">Lượt Gold</option>
        </select>
        <label htmlFor="spinCount">SỐ LƯỢT MUỐN QUAY</label>
        <input
          id="spinCount"
          type="number"
          min={1}
          max={10}
          step={1}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        <div className="wheel-stage star-wish-stage">
          <div className="star-wish-ambient" aria-hidden="true">
            <span>✧</span>
            <span>✦</span>
            <span>✧</span>
            <span>✶</span>
            <span>✦</span>
          </div>
          <div className="star-wish-core" aria-hidden="true">
            <span className="star-wish-ring"></span>
            <span className="star-wish-symbol">✦</span>
            <span className="star-wish-caption">ALL FOR TRANG PHÁP</span>
          </div>
          <p className="wheel-caption">✧ GỬI MỘT ĐIỀU ƯỚC, NHẬN MỘT MÓN QUÀ ✧</p>
        </div>
        <div style={{textAlign: 'center'}}>
          <button
            disabled={
              busy ||
              signedIn !== true ||
              available === undefined ||
              count < 1 ||
              count > 10 ||
              count > (available ?? 0)
            }
            onClick={wish}
          >
            {busy ? '✦ ĐANG ƯỚC NGUYỆN... ✦' : '✦ ƯỚC NGUYỆN ✦'}
          </button>
        </div>
        {message && (
          <p role="status" className="result">
            {message}
          </p>
        )}
        {results.length > 0 && (
          <div className="grid" aria-label="Kết quả quay">
            {results.map((p, i) => (
              <div key={p.item_id || i} className="metric">
                <strong>✦</strong>
                <p>Mã quà: {p.code}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>THÔNG BÁO TẶNG LƯỢT QUAY</h2>
        {grants.map((g) => (
          <div className="bonus-notice" key={g.id}>
            🎁 BST đã tặng bạn{' '}
            {g.normal_count > 0 && <b>{g.normal_count} lượt THƯỜNG</b>}
            {g.normal_count > 0 && g.gold_count > 0 && ' và '}
            {g.gold_count > 0 && <b>{g.gold_count} lượt GOLD</b>} · {formatDate(g.created_at)}
            <br />
            <small>{g.reason || 'Quà tặng từ BST'}</small>
          </div>
        ))}
        {grants.length === 0 && <p className="muted">Chưa có lượt quay được tặng.</p>}
      </section>

      <section className="panel">
        <h2>Inventory quà của tôi</h2>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Mã quà</th>
                <th>Tên quà</th>
                <th>Độ hiếm</th>
                <th>Chủ sở hữu</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((x) => (
                <tr key={x.id}>
                  <td>{x.code}</td>
                  <td>{x.gift_types?.name || '—'}</td>
                  <td>{rarityLabel(x.gift_types?.rarity)}</td>
                  <td>Bạn</td>
                </tr>
              ))}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={4}>Chưa có quà</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>Lịch sử quay</h2>
        {historyError && (
          <p role="alert" className="error">
            {historyError}
          </p>
        )}
        <div className="spin-history-controls">
          <label htmlFor="spinHistorySize">
            HIỂN THỊ{' '}
            <select
              id="spinHistorySize"
              value={historySize}
              onChange={(e) => {
                setHistorySize(Number(e.target.value));
                setHistoryPage(0);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>{' '}
            LƯỢT
          </label>
          <span className="muted">{spinTotal} lượt</span>
        </div>
        <div>
          {pageRows.map((h) => (
            <div className="gift" key={h.id}>
              <span>
                {formatDate(h.created_at)} · {h.gift_items?.gift_types?.name || h.gift_items?.code || '—'}
              </span>
              <span className="tag">{h.kind === 'gold' ? 'Gold' : 'Thường'}</span>
            </div>
          ))}
          {history.length === 0 && <p className="muted">Chưa có lượt quay</p>}
        </div>
        <div className="spin-history-pager">
          <button
            type="button"
            className="secondary"
            disabled={historyPage === 0}
            onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
          >
            ← TRƯỚC
          </button>
          <span>
            {historyPage + 1} / {pages}
          </span>
          <button
            type="button"
            className="secondary"
            disabled={historyPage >= pages - 1}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            TIẾP →
          </button>
        </div>
      </section>
    </main>
  );
}