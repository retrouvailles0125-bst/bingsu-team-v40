'use client';
import {useMemo, useState} from 'react';
import {formatDate, formatMoney} from '@/config/site';

export type TrackingRow = {
  project_name: string;
  display_name: string;
  reference: string;
  declared_at: string;
  declared_amount: number;
  received_amount: number | null;
  status: string;
};

export default function TrackingPanel({rows, error}: {rows: TrackingRow[]; error: string | null}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!q || r.display_name.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q))
    );
  }, [rows, search, status]);

  const total = rows
    .filter((r) => r.status === 'Verified')
    .reduce((sum, r) => sum + Number(r.received_amount || 0), 0);

  return (
    <section className="panel">
      <h2>Theo dõi Donate · Project đang mở</h2>
      <p className="muted">
        Chỉ hiển thị thông tin được cho phép công khai. Email, số điện thoại và bill luôn riêng tư.
      </p>
      {error && <p role="alert" className="error">Chưa tải được bảng Donate: {error}</p>}
      <div className="metric" style={{marginBottom: 15}}>
        TỔNG DONATE ĐÃ XÁC MINH<b>{formatMoney(total)}</b>
      </div>
      <div className="grid">
        <div>
          <label htmlFor="trackSearch">TÌM ID HOẶC REFERENCE</label>
          <input
            id="trackSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập ID hoặc mã Reference..."
          />
        </div>
        <div>
          <label htmlFor="trackStatus">TRẠNG THÁI</label>
          <select id="trackStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">TẤT CẢ</option>
            <option value="Verified">Verified</option>
          </select>
        </div>
      </div>
      <p className="muted">HIỂN THỊ {list.length} / {rows.length} GIAO DỊCH</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>PROJECT</th>
              <th>ID HIỂN THỊ</th>
              <th>REFERENCE</th>
              <th>NGÀY KHAI BÁO</th>
              <th>DONATE KHAI BÁO</th>
              <th>THỰC NHẬN</th>
              <th>TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={`${r.reference}-${i}`}>
                <td>{r.project_name}</td>
                <td>{r.display_name}</td>
                <td>{r.reference}</td>
                <td>{formatDate(r.declared_at)}</td>
                <td>{formatMoney(Number(r.declared_amount || 0))}</td>
                <td>{formatMoney(Number(r.received_amount || 0))}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7}>KHÔNG CÓ GIAO DỊCH PHÙ HỢP</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}