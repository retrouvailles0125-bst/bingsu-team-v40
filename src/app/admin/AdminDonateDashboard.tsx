
'use client';

import { useEffect, useState } from 'react';
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
};

type Settings = {
  normal_rate: number;
  gold_rate: number;
  verify_wait_seconds: number;
};

type Props = {
  donations: Donation[];
  settings: Settings | null;
  initialError: string | null;
};

type Filter = 'all' | 'pending' | 'processing' | 'verified' | 'rejected';

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

function getProjectName(donation: Donation) {
  const project = donation.projects;

  if (Array.isArray(project)) {
    return project[0]?.name ?? '—';
  }

  return project?.name ?? '—';
}

function getSecondsLeft(
  readyAt: string | null,
  now: number
): number {
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

async function postJSON(
  url: string,
  payload: Record<string, unknown>
) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  initialError,
}: Props) {
  const router = useRouter();

  const [filter, setFilter] = useState<Filter>('all');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const filtered = donations.filter(
    (donation) =>
      filter === 'all' || donation.status === filter
  );

  const pending = donations.filter(
    (donation) => donation.status === 'pending'
  ).length;

  const processing = donations.filter(
    (donation) => donation.status === 'processing'
  ).length;

  const verified = donations.filter(
    (donation) => donation.status === 'verified'
  ).length;

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

        const confirmed = window.confirm(
          `Bắt đầu xác minh Donate với số tiền thực nhận ${money(
            receivedAmount
          )}?\n\nSau thời gian chờ, Admin cần bấm Finalize.`
        );

        if (!confirmed) return;

        await postJSON('/api/admin/verify', {
          donation_id: donationId,
          received_amount: receivedAmount,
        });

        setNotice(
          'Đã bắt đầu xác minh. Có thể hủy trong thời gian chờ.'
        );
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
          'Hoàn tất xác minh Donate?\n\nSau bước này, Kandee có thể chọn cách phân bổ lượt Gacha.'
        );

        if (!confirmed) return;

        await postJSON('/api/donations/finalize', {
          donation_id: donationId,
        });

        setNotice(
          'Donate đã Verified. Đang chờ Kandee phân bổ lượt.'
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

  const buttonStyle: React.CSSProperties = {
    padding: '9px 15px',
    borderRadius: 10,
    border: '1px solid #e8a7c9',
    background: '#e12589',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#fff',
    color: '#a41464',
  };

  const cardStyle: React.CSSProperties = {
    border: '1px solid #f0c8df',
    borderRadius: 14,
    padding: 16,
    background: '#fff',
  };

  return (
    <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Tổng Donate', value: donations.length },
          { label: 'Pending', value: pending },
          { label: 'Processing', value: processing },
          { label: 'Verified', value: verified },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ fontSize: 13, color: '#76596b' }}>
              {item.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: '#e12589',
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Cấu hình Gacha hiện tại</h3>

        {settings ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <strong>Normal Ticket</strong>
              <p>{money(settings.normal_rate)} / lượt</p>
            </div>

            <div>
              <strong>Gold Ticket</strong>
              <p>{money(settings.gold_rate)} / lượt</p>
            </div>

            <div>
              <strong>Thời gian chờ Verify</strong>
              <p>{settings.verify_wait_seconds} giây</p>
            </div>
          </div>
        ) : (
          <p>Chưa đọc được cấu hình Gacha.</p>
        )}

        <p
          style={{
            marginBottom: 0,
            fontSize: 13,
            color: '#76596b',
          }}
        >
          Tỷ lệ được lưu tại thời điểm bắt đầu Verify.
          Bảng này hiện chỉ hiển thị cấu hình, chưa cho chỉnh sửa.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 10,
            border: '1px solid #dc7272',
            background: '#fff0f0',
            color: '#a51d36',
            overflowWrap: 'anywhere',
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            padding: 14,
            borderRadius: 10,
            border: '1px solid #e8a7c9',
            background: '#fff0f7',
            color: '#9b185d',
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Danh sách Donate</h3>

        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() => router.refresh()}
        >
          Làm mới dữ liệu
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            ['all', 'Tất cả'],
            ['pending', 'Pending'],
            ['processing', 'Processing'],
            ['verified', 'Verified'],
            ['rejected', 'Rejected'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            style={
              filter === value
                ? buttonStyle
                : secondaryButtonStyle
            }
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: '#76596b' }}>
            Chưa có Donate nào trong danh sách này.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.map((donation) => {
            const remaining = getSecondsLeft(
              donation.verification_ready_at,
              now
            );

            const isBusy = busyId === donation.id;

            return (
              <article key={donation.id} style={cardStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <strong
                      style={{
                        color: '#b31a70',
                        fontSize: 17,
                      }}
                    >
                      {getProjectName(donation)}
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#76596b',
                        marginTop: 4,
                      }}
                    >
                      {dateTime(donation.created_at)}
                    </div>
                  </div>

                  <strong
                    style={{
                      color:
                        donation.status === 'verified'
                          ? '#16844b'
                          : donation.status === 'processing'
                            ? '#b46a00'
                            : '#a41464',
                    }}
                  >
                    {donation.status.toUpperCase()}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    fontSize: 14,
                  }}
                >
                  <div>
                    <span style={{ color: '#76596b' }}>
                      Số tiền khai báo
                    </span>
                    <div>
                      <strong>
                        {money(donation.declared_amount)}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#76596b' }}>
                      Số tiền thực nhận
                    </span>
                    <div>
                      <strong>
                        {donation.received_amount === null
                          ? 'Chưa xác nhận'
                          : money(donation.received_amount)}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#76596b' }}>
                      Lượt đã phân bổ
                    </span>
                    <div>
                      Normal: {donation.normal_tickets ?? 0}
                      {' · '}
                      Gold: {donation.gold_tickets ?? 0}
                    </div>
                  </div>
                </div>

                {donation.status === 'pending' && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      alignItems: 'end',
                      marginTop: 16,
                    }}
                  >
                    <label
                      style={{
                        display: 'grid',
                        gap: 6,
                        flex: '1 1 220px',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>
                        Số tiền thực nhận (VND)
                      </span>

                      <input
                        type="number"
                        min="0"
                        max="1000000000"
                        step="1"
                        value={amounts[donation.id] ?? ''}
                        onChange={(event) =>
                          setAmounts((previous) => ({
                            ...previous,
                            [donation.id]: event.target.value,
                          }))
                        }
                        placeholder="Nhập số tiền thực nhận"
                        disabled={Boolean(busyId)}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid #e8a7c9',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      style={buttonStyle}
                      disabled={Boolean(busyId)}
                      onClick={() =>
                        runAction(donation.id, 'verify')
                      }
                    >
                      {isBusy
                        ? 'Đang xử lý...'
                        : 'Bắt đầu Verify'}
                    </button>
                  </div>
                )}

                {donation.status === 'processing' && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 12,
                      background: '#fff0f7',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: '#a41464',
                      }}
                    >
                      {remaining > 0
                        ? `Đang chờ: ${formatCountdown(remaining)}`
                        : 'Đã hết thời gian chờ'}
                    </div>

                    <p
                      style={{
                        margin: '8px 0',
                        fontSize: 13,
                      }}
                    >
                      Thời điểm sẵn sàng:{' '}
                      {dateTime(
                        donation.verification_ready_at
                      )}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {remaining > 0 ? (
                        <button
                          type="button"
                          style={secondaryButtonStyle}
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            runAction(donation.id, 'cancel')
                          }
                        >
                          {isBusy
                            ? 'Đang xử lý...'
                            : 'Cancel Verify'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            runAction(donation.id, 'finalize')
                          }
                        >
                          {isBusy
                            ? 'Đang xử lý...'
                            : 'Finalize — Verified'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {donation.status === 'verified' && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      background: '#f2fff7',
                      color: '#17663d',
                      fontSize: 13,
                    }}
                  >
                    <strong>Đã xác minh</strong>
                    {' · '}
                    {dateTime(donation.verified_at)}

                    <div style={{ marginTop: 6 }}>
                      {donation.allocation_completed_at
                        ? `Đã phân bổ: ${
                            donation.allocation_choice ?? '—'
                          }`
                        : 'Đang chờ Kandee chọn phân bổ lượt Gacha'}
                    </div>
                  </div>
                )}

                <details style={{ marginTop: 14 }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#76596b',
                    }}
                  >
                    Thông tin kỹ thuật
                  </summary>

                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 8,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    <div>Donation ID: {donation.id}</div>
                    <div>User ID: {donation.user_id}</div>
                    <div>Project ID: {donation.project_id}</div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      <p
        style={{
          fontSize: 12,
          color: '#76596b',
          marginBottom: 0,
        }}
      >
        Hiển thị tối đa 100 Donate mới nhất. Việc xác minh
        và phân bổ lượt được xử lý tại Supabase; giao diện
        không trực tiếp cộng lượt vào ví.
      </p>
    </div>
  );
}
