'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Donation = {
  id: string;
  user_id: string;
  project_id: string;
  declared_amount: number;
  received_amount: number | null;
  status: string;
  created_at: string;
  verified_at: string | null;
  verification_ready_at: string | null;
  normal_tickets: number;
  gold_tickets: number;
  allocation_choice: string | null;
  allocation_completed_at: string | null;
  projects: { name: string } | { name: string }[] | null;
  note?: string | null;
  kandee_message?: string | null;
  bst_message?: string | null;
  declaration_fields?: Record<string, unknown> | null;
};

type Settings = {
  normal_rate: number;
  gold_rate: number;
  verify_wait_seconds: number;
};

type UserRow = { id: string; username: string | null };

type Bill = {
  donation_id: string;
  name: string;
  url: string | null;
};

type Props = {
  donations: Donation[];
  settings: Settings | null;
  users: UserRow[];
  bills: Bill[];
  initialError: string | null;
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const dateTime = (value: string | null | undefined) => {
  if (!value) return '—';

  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const text = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

// Chặn công thức Excel (=, +, -, @) khi xuất CSV.
const csvCell = (value: unknown) => {
  let s =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;

  return `"${s.replace(/"/g, '""')}"`;
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  verified: 'Verified',
  rejected: 'Rejected',
};

const reference = (donation: Donation) =>
  donation.id.slice(0, 8).toUpperCase();

// Hai trường có dòng riêng trong cột "Thông tin khai báo".
const SPECIAL_KEYS = new Set(['phone', 'transfer_date']);

const declared = (donation: Donation, key: string) =>
  donation.declaration_fields?.[key];

function getProjectName(donation: Donation) {
  const project = donation.projects;

  if (Array.isArray(project)) {
    return project[0]?.name ?? '—';
  }

  return project?.name ?? '—';
}

function getSecondsLeft(readyAt: string | null, now: number): number {
  if (!readyAt) return 0;

  const timestamp = new Date(readyAt).getTime();

  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}

function formatCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const mmss = [
    String(minutes).padStart(2, '0'),
    String(remainingSeconds).padStart(2, '0'),
  ].join(':');

  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${mmss}`
    : mmss;
}

async function postJSON(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  const result: {
    error?: string;
    ok?: boolean;
    status?: string;
  } = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error ?? `Yêu cầu thất bại (${response.status})`
    );
  }

  return result;
}

export default function AdminDonateDashboard({
  donations,
  settings,
  users,
  bills,
  initialError,
}: Props) {
  const router = useRouter();

  const [project, setProject] = useState('all');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [now, setNow] = useState(() => Date.now());
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Lấy tên hiển thị của các trường khai báo từ cấu hình ở mục Khai báo Donate.
  useEffect(() => {
    let alive = true;

    fetch('/api/admin/donate-fields', { cache: 'no-store' })
      .then(response => response.json())
      .then(json => {
        if (!alive || !Array.isArray(json?.settings?.fields)) return;

        const map: Record<string, string> = {};

        (json.settings.fields as { key: string; label: string }[]).forEach(
          field => {
            map[field.key] = field.label;
          }
        );

        setLabels(map);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const names = useMemo(
    () => new Map(users.map(user => [user.id, user.username || '—'])),
    [users]
  );

  const billsByDonation = useMemo(() => {
    const map = new Map<string, Bill[]>();

    bills.forEach(bill => {
      map.set(bill.donation_id, [
        ...(map.get(bill.donation_id) ?? []),
        bill,
      ]);
    });

    return map;
  }, [bills]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();

    donations.forEach(donation => {
      if (!map.has(donation.project_id)) {
        map.set(donation.project_id, getProjectName(donation));
      }
    });

    return [...map.entries()];
  }, [donations]);

  const rows = useMemo(
    () =>
      donations.filter(
        donation => project === 'all' || donation.project_id === project
      ),
    [donations, project]
  );

  function preview(amountText: string) {
    if (!settings || settings.normal_rate <= 0 || settings.gold_rate <= 0) {
      return null;
    }

    if (!/^\d+$/.test(amountText)) return null;

    const amount = Number(amountText);

    if (!Number.isSafeInteger(amount) || amount > 1_000_000_000) {
      return null;
    }

    const gold = Math.floor(amount / settings.gold_rate);
    const normal = Math.floor(
      (amount - gold * settings.gold_rate) / settings.normal_rate
    );

    return { gold, normal };
  }

  async function runAction(
    donationId: string,
    action: 'verify' | 'cancel' | 'finalize'
  ) {
    if (busyId) return;

    setBusyId(donationId);
    setNotice('');
    setError('');

    try {
      if (action === 'verify') {
        const rawAmount = amounts[donationId]?.trim();

        if (!rawAmount || !/^\d+$/.test(rawAmount)) {
          throw new Error(
            'Vui lòng nhập số tiền thực nhận bằng số nguyên VND.'
          );
        }

        const receivedAmount = Number(rawAmount);

        if (
          !Number.isSafeInteger(receivedAmount) ||
          receivedAmount < 0 ||
          receivedAmount > 1_000_000_000
        ) {
          throw new Error(
            'Số tiền phải nằm trong khoảng 0 đến 1.000.000.000 VND.'
          );
        }

        const estimate = preview(rawAmount);

        if (!estimate) {
          throw new Error('Chưa có tỷ lệ Gacha hợp lệ để tính lượt.');
        }

        const confirmed = window.confirm(
          `Bắt đầu xác minh ${money(receivedAmount)}?\n` +
            `Dự kiến: ${estimate.gold} Gold + ${estimate.normal} Normal.\n` +
            `Lượt sẽ tự cộng khi Admin Finalize sau thời gian chờ.`
        );

        if (!confirmed) return;

        await postJSON('/api/admin/verify', {
          donation_id: donationId,
          received_amount: receivedAmount,
        });

        setNotice('Đã bắt đầu xác minh. Có thể hủy trong thời gian chờ.');
      }

      if (action === 'cancel') {
        const confirmed = window.confirm(
          'Hủy xác minh và đưa Donate về trạng thái Pending?'
        );

        if (!confirmed) return;

        await postJSON('/api/admin/verify/cancel', {
          donation_id: donationId,
        });

        setNotice('Đã hủy xác minh thành công.');
      }

      if (action === 'finalize') {
        const confirmed = window.confirm(
          'Hoàn tất xác minh Donate và tự động cấp lượt Gold tối đa, phần dư đổi Normal?'
        );

        if (!confirmed) return;

        await postJSON('/api/donations/finalize', {
          donation_id: donationId,
        });

        setNotice(
          'Donate đã Verified. Hệ thống đã tự động phân bổ và cộng lượt Gacha.'
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể hoàn tất thao tác.'
      );
    } finally {
      setBusyId(null);
    }
  }

  // Xuất file CSV (mở được bằng Excel), lọc theo Project đang chọn.
  function exportCsv() {
    const header = [
      'Reference',
      'Project',
      'User',
      'User ID',
      'SĐT',
      'Ngày khai báo',
      'Ngày chuyển khoản',
      'Ghi chú',
      'Lời nhắn Kandee',
      'Lời nhắn BST',
      'Trường khai báo khác',
      'Số bill',
      'Khai báo (VND)',
      'Thực nhận (VND)',
      'Trạng thái',
      'Lượt Normal',
      'Lượt Gold',
    ];

    const lines = [
      header,
      ...rows.map(donation => [
        reference(donation),
        getProjectName(donation),
        names.get(donation.user_id) ?? '',
        donation.user_id,
        declared(donation, 'phone') ?? '',
        donation.created_at,
        declared(donation, 'transfer_date') ?? '',
        donation.note ?? '',
        donation.kandee_message ?? '',
        donation.bst_message ?? '',
        Object.fromEntries(
          Object.entries(donation.declaration_fields ?? {}).filter(
            ([key]) => !SPECIAL_KEYS.has(key)
          )
        ),
        (billsByDonation.get(donation.id) ?? []).length,
        donation.declared_amount,
        donation.received_amount ?? '',
        donation.status,
        donation.status === 'verified' ? donation.normal_tickets ?? 0 : 0,
        donation.status === 'verified' ? donation.gold_tickets ?? 0 : 0,
      ]),
    ].map(line => line.map(csvCell).join(','));

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BST_DoiSoat_${project === 'all' ? 'ALL' : project.slice(0, 8)}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const waitMinutes = settings
    ? Math.round((settings.verify_wait_seconds / 60) * 100) / 100
    : null;

  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="result">
          {notice}
        </p>
      )}

      <p className="muted">
        {settings
          ? `Thời gian chờ trước khi công bố xác minh: ${waitMinutes} phút (${settings.verify_wait_seconds} giây). Tỷ lệ: ${money(settings.normal_rate)} / lượt thường, ${money(settings.gold_rate)} / lượt Gold.`
          : 'Chưa đọc được cấu hình Gacha.'}
      </p>

      <div className="row export-toolbar">
        <div>
          <label htmlFor="reconcileProject">Xuất dữ liệu Project</label>

          <select
            id="reconcileProject"
            value={project}
            onChange={event => setProject(event.target.value)}
          >
            <option value="all">Tất cả Project</option>
            {projectOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <button type="button" onClick={exportCsv}>
          📥 Xuất Excel · Đối soát
        </button>

        <button
          type="button"
          className="secondary"
          onClick={() => router.refresh()}
        >
          Làm mới dữ liệu
        </button>
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>REFERENCE / PROJECT / EMAIL / ID</th>
              <th>THÔNG TIN KHAI BÁO</th>
              <th>KHAI BÁO</th>
              <th>Thực nhận (VND)</th>
              <th>Trạng thái</th>
              <th>LƯỢT</th>
              <th>THAO TÁC</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>Chưa có donate</td>
              </tr>
            ) : (
              rows.map(donation => {
                const remaining = getSecondsLeft(
                  donation.verification_ready_at,
                  now
                );

                const isBusy = busyId === donation.id;
                const estimate = preview(
                  amounts[donation.id]?.trim() ?? ''
                );
                const donationBills = billsByDonation.get(donation.id) ?? [];

                return (
                  <tr key={donation.id}>
                    <td>
                      <b>{reference(donation)}</b>
                      <br />
                      <small>Project: {getProjectName(donation)}</small>
                      <br />
                      {names.get(donation.user_id) ?? '—'}
                      <br />
                      <small>SĐT: {text(declared(donation, 'phone'))}</small>
                    </td>

                    <td>
                      <div className="reconcile-details">
                        <div>
                          <b>NGÀY KHAI BÁO:</b> {dateTime(donation.created_at)}
                        </div>
                        <div>
                          <b>NGÀY CHUYỂN:</b>{' '}
                          {text(declared(donation, 'transfer_date'))}
                        </div>
                        <div>
                          <b>GHI CHÚ:</b> {text(donation.note)}
                        </div>
                        <div>
                          <b>LỜI NHẮN KANDEE:</b>{' '}
                          {text(donation.kandee_message)}
                        </div>
                        <div>
                          <b>LỜI NHẮN BST:</b> {text(donation.bst_message)}
                        </div>
                        <div>
                          <b>BILL:</b>{' '}
                          {donationBills.length === 0
                            ? 'CHƯA CÓ'
                            : donationBills.map((bill, index) =>
                                bill.url ? (
                                  <a
                                    key={`${bill.name}-${index}`}
                                    href={bill.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-block',
                                      margin: '3px 8px 3px 0',
                                    }}
                                  >
                                    XEM BILL {index + 1} ↗
                                  </a>
                                ) : (
                                  <span
                                    key={`${bill.name}-${index}`}
                                    className="muted"
                                    style={{ marginRight: 8 }}
                                  >
                                    BILL {index + 1} (lỗi liên kết)
                                  </span>
                                )
                              )}
                        </div>
                        {Object.entries(donation.declaration_fields ?? {})
                          .filter(([key]) => !SPECIAL_KEYS.has(key))
                          .map(([key, value]) => (
                            <div key={key}>
                              <b>{(labels[key] ?? key).toUpperCase()}:</b>{' '}
                              {text(value)}
                            </div>
                          ))}
                      </div>
                    </td>

                    <td>{money(donation.declared_amount)}</td>

                    <td>
                      {donation.status === 'pending' ? (
                        <>
                          <input
                            style={{ minWidth: 145 }}
                            type="number"
                            min="0"
                            max="1000000000"
                            step="1"
                            value={amounts[donation.id] ?? ''}
                            placeholder="Nhập thực nhận"
                            disabled={Boolean(busyId)}
                            onChange={event =>
                              setAmounts(previous => ({
                                ...previous,
                                [donation.id]: event.target.value,
                              }))
                            }
                          />

                          {estimate && (
                            <small className="muted">
                              Dự kiến: {estimate.gold} Gold + {estimate.normal}{' '}
                              Thường
                            </small>
                          )}
                        </>
                      ) : (
                        money(donation.received_amount)
                      )}
                    </td>

                    <td>
                      {statusLabel[donation.status] ?? donation.status}

                      {donation.status === 'processing' && (
                        <>
                          <br />
                          <small>
                            {remaining > 0
                              ? `Còn ${formatCountdown(remaining)}`
                              : 'Đã hết thời gian chờ'}
                          </small>
                        </>
                      )}
                    </td>

                    <td>
                      {donation.status === 'verified'
                        ? `${donation.gold_tickets ?? 0} Gold · ${donation.normal_tickets ?? 0} Thường`
                        : 0}
                    </td>

                    <td>
                      {donation.status === 'pending' && (
                        <button
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={() => runAction(donation.id, 'verify')}
                        >
                          {isBusy ? 'Đang xử lý...' : 'Verify'}
                        </button>
                      )}

                      {donation.status === 'processing' &&
                        (remaining > 0 ? (
                          <button
                            type="button"
                            className="secondary"
                            disabled={Boolean(busyId)}
                            onClick={() => runAction(donation.id, 'cancel')}
                          >
                            {isBusy ? 'Đang xử lý...' : 'Hủy'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() =>
                              runAction(donation.id, 'finalize')
                            }
                          >
                            {isBusy ? 'Đang xử lý...' : 'Finalize'}
                          </button>
                        ))}

                      {donation.status === 'verified' && (
                        <span className="ok">✓ Đã xác minh</span>
                      )}

                      {donation.status === 'rejected' && (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Hiển thị tối đa 100 Donate mới nhất. Link xem bill chỉ có hiệu lực 1
        giờ, bấm &quot;Làm mới dữ liệu&quot; để tạo link mới. Xác minh và phân bổ
        lượt được xử lý tại Supabase, giao diện không trực tiếp cộng lượt vào
        ví.
      </p>
    </>
  );
}