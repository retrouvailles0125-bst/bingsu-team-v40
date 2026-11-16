
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase';
import {formatMoney, formatDate} from '@/config/site';
import AccountSettings from '@/features/account/AccountSettings';
import TicketAllocation from '@/features/account/TicketAllocation';

export const dynamic = 'force-dynamic';

type Donation = {
  id: string;
  created_at: string;
  status: string;
  declared_amount: number;
  received_amount: number | null;
  normal_tickets: number | null;
  gold_tickets: number | null;
  allocation_completed_at: string | null;
  normal_rate_snapshot: number | null;
  gold_rate_snapshot: number | null;
};

type EligibleDonation = {
  id: string;
  received_amount: number | null;
  normal_rate_snapshot: number | null;
  gold_rate_snapshot: number | null;
};

const toNumber = (value: unknown): number =>
  Number(value ?? 0) || 0;

const formatCount = (value: number): string =>
  new Intl.NumberFormat('vi-VN').format(value);

export default async function Account() {
  const db = await supabaseServer();

  const {
    data: {user},
  } = await db.auth.getUser();

  if (!user) redirect('/login');

  const [
    profile,
    balances,
    spinCount,
    postCount,
    letterCount,
    giftCount,
    eligible,
  ] = await Promise.all([
    db.from('profiles')
      .select('username,role,blocked')
      .eq('id', user.id)
      .maybeSingle(),

    db.from('spin_balances')
      .select('normal_available,gold_available')
      .eq('user_id', user.id)
      .maybeSingle(),

    db.from('spin_events')
      .select('id', {count: 'exact', head: true})
      .eq('user_id', user.id),

    db.from('community_posts')
      .select('id', {count: 'exact', head: true})
      .eq('author_id', user.id),

    db.from('love_messages')
      .select('id', {count: 'exact', head: true})
      .eq('author_id', user.id),

    db.from('gift_items')
      .select('id', {count: 'exact', head: true})
      .eq('owner_id', user.id),

    db.from('donations')
      .select(
        'id,received_amount,normal_rate_snapshot,gold_rate_snapshot'
      )
      .eq('user_id', user.id)
      .eq('status', 'verified')
      .is('allocation_completed_at', null)
      .order('created_at', {ascending: true})
      .limit(1000),
  ]);

  const donations: Donation[] = [];
  let donationError = '';
  const pageSize = 500;

  // Đọc lịch sử Donate theo từng trang để không
  // giới hạn tổng tiền vào 100 giao dịch gần nhất.
  for (let start = 0; ; start += pageSize) {
    const result = await db.from('donations')
      .select('id,created_at,status,declared_amount,received_amount,normal_tickets,gold_tickets,allocation_completed_at,normal_rate_snapshot,gold_rate_snapshot')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false})
      .range(start, start + pageSize - 1);

    if (result.error) {
      donationError = result.error.message;
      break;
    }

    const rows: Donation[] = result.data ?? [];
    donations.push(...rows);

    if (rows.length < pageSize) break;
  }

  const normalAvailable = toNumber(
    balances.data?.normal_available
  );

  const goldAvailable = toNumber(
    balances.data?.gold_available
  );

  const remainingSpins = normalAvailable + goldAvailable;
  const completedSpins = spinCount.count ?? 0;

  // Theo nghiệp vụ hiện tại, chưa có chức năng
  // admin thu hồi hoặc điều chỉnh lượt quay.
  const receivedSpins = completedSpins + remainingSpins;

  const verifiedDonations = donations.filter(
    (donation) => donation.status === 'verified'
  );

  const verifiedAmount = verifiedDonations.reduce(
    (total, donation) =>
      total + toNumber(donation.received_amount),
    0
  );

  const allocatable: EligibleDonation[] =
    eligible.data ?? [];

  const stats = [
    {
      label: 'LƯỢT THƯỜNG CÒN',
      value: normalAvailable,
      error: balances.error,
    },
    {
      label: 'LƯỢT GOLD CÒN',
      value: goldAvailable,
      error: balances.error,
    },
    {
      label: 'ĐÃ QUAY',
      value: completedSpins,
      error: spinCount.error,
    },
    {
      label: 'BÀI GIAO LƯU KANDEE',
      value: postCount.count ?? 0,
      error: postCount.error,
    },
    {
      label: 'THƯ GỬI ĐẾN TRANG',
      value: letterCount.count ?? 0,
      error: letterCount.error,
    },
  ];

  return (
    <main className="bst-v40-page bst-account-page">
      <section className="bst-v40-panel bst-account-panel">
        <div className="bst-account-heading">
          <div>
            <h1>
              TÀI KHOẢN: {profile.data?.username || '—'}
            </h1>

            <p className="bst-account-email">
              {user.email}
            </p>
          </div>

          <Link
            href="/logout"
            className="bst-account-logout"
          >
            ĐĂNG XUẤT
          </Link>
        </div>

        <details className="bst-account-settings">
          <summary>✎ CHỈNH SỬA TÀI KHOẢN</summary>

          <div className="bst-account-settings-body">
            <AccountSettings
              username={profile.data?.username || ''}
            />
          </div>
        </details>

        <div className="bst-account-stats">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bst-account-stat"
            >
              <span>{stat.label}</span>

              <strong>
                {stat.error
                  ? '—'
                  : formatCount(stat.value)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="bst-v40-panel bst-account-panel">
        <h2>THỐNG KÊ DONATE CỦA TÔI</h2>

        <div className="bst-account-donate">
          <span>
            TỔNG DONATE ĐÃ XÁC MINH · TẤT CẢ PROJECT
          </span>

          <strong>
            {donationError
              ? '—'
              : formatMoney(verifiedAmount)}
          </strong>

          {donationError ? (
            <p className="bst-account-error" role="alert">
              Không tải được Donate: {donationError}
            </p>
          ) : verifiedDonations.length === 0 ? (
            <p>Bạn chưa có Donate.</p>
          ) : (
            <p>
              {formatCount(verifiedDonations.length)}
              {' '}giao dịch đã xác minh
            </p>
          )}
        </div>
      </section>

      <section className="bst-v40-panel bst-account-panel">
        <h2>QUÀ VÀ LƯỢT QUAY CỦA TÔI</h2>

        <div className="bst-account-rewards">
          <div className="bst-account-reward">
            <span>TỔNG QUÀ HIỆN SỞ HỮU</span>

            <strong>
              {giftCount.error
                ? '—'
                : formatCount(giftCount.count ?? 0)}
            </strong>

            <Link href="/trade">
              SÀN TRADE GIFT →
            </Link>
          </div>

          <div className="bst-account-reward">
            <span>TỔNG LƯỢT QUAY ĐÃ NHẬN</span>

            <strong>
              {spinCount.error || balances.error
                ? '—'
                : formatCount(receivedSpins)}
            </strong>

            <p>
              ĐÃ QUAY:{' '}
              {spinCount.error
                ? '—'
                : formatCount(completedSpins)}
              {' · '}
              CÒN LẠI:{' '}
              {balances.error
                ? '—'
                : formatCount(remainingSpins)}
            </p>

            <Link href="/star">
              VÒNG XOAY MAY MẮN →
            </Link>
          </div>
        </div>
      </section>

      <section className="bst-v40-panel bst-account-panel">
        <h2>CHỌN LOẠI LƯỢT QUAY SAU KHI VERIFIED</h2>

        {eligible.error ? (
          <p className="bst-account-error" role="alert">
            Không tải được Donate chờ phân bổ:
            {' '}{eligible.error.message}
          </p>
        ) : (
          <TicketAllocation donations={allocatable} />
        )}

        {allocatable.length === 1000 && (
          <p className="bst-account-note">
            Danh sách chờ phân bổ đang giới hạn
            1.000 giao dịch. Liên hệ BST nếu chưa
            thấy giao dịch của bạn.
          </p>
        )}
      </section>

      <section className="bst-v40-panel bst-account-panel">
        <h2>LỊCH SỬ DONATE</h2>

        <div className="bst-account-table-scroll">
          <table className="bst-account-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Ngày gửi</th>
                <th>Khai báo</th>
                <th>Thực nhận</th>
                <th>Đã xác minh?</th>
                <th>Số lượt quay</th>
              </tr>
            </thead>

            <tbody>
              {donations.map((donation) => {
                const verified =
                  donation.status === 'verified';

                const allocated =
                  donation.allocation_completed_at !== null;

                const ticketCount =
                  toNumber(donation.normal_tickets) +
                  toNumber(donation.gold_tickets);

                return (
                  <tr key={donation.id}>
                    <td
                      title={donation.id}
                      className="bst-account-reference"
                    >
                      {donation.id.slice(0, 8)}
                    </td>

                    <td>
                      {formatDate(donation.created_at)}
                    </td>

                    <td>
                      {formatMoney(
                        toNumber(donation.declared_amount)
                      )}
                    </td>

                    <td>
                      {verified
                        ? formatMoney(
                            toNumber(donation.received_amount)
                          )
                        : '—'}
                    </td>

                    <td>
                      <span
                        className={
                          verified
                            ? 'bst-account-status verified'
                            : 'bst-account-status'
                        }
                      >
                        {verified ? 'Có' : 'Chưa'}
                      </span>
                    </td>

                    <td>
                      {verified && allocated
                        ? formatCount(ticketCount)
                        : '—'}
                    </td>
                  </tr>
                );
              })}

              {donations.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="bst-account-empty"
                  >
                    {donationError
                      ? 'Không tải được lịch sử Donate.'
                      : 'Chưa có giao dịch'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style>{`
        .bst-account-page {
          --account-pink: #e12589;
          --account-dark: #743051;
          --account-border: #f3cbdc;
          --account-soft: #fff5fa;
          --account-cream: #fffaf4;
          color: var(--account-dark);
        }

        .bst-account-panel {
          margin-bottom: 20px;
          padding: clamp(18px, 4vw, 30px);
          border: 1px solid var(--account-border);
          border-radius: 24px;
          background: rgba(255, 250, 252, 0.96);
          box-shadow: 0 8px 28px rgba(177, 49, 112, 0.06);
        }

        .bst-account-panel h1,
        .bst-account-panel h2 {
          color: var(--account-pink);
          line-height: 1.3;
          letter-spacing: 0.01em;
        }

        .bst-account-panel h1 {
          font-size: clamp(19px, 3vw, 27px);
          margin: 0 0 7px;
        }

        .bst-account-panel h2 {
          font-size: clamp(18px, 2.5vw, 23px);
          margin: 0 0 20px;
        }

        .bst-account-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .bst-account-email {
          font-size: 13px;
          overflow-wrap: anywhere;
          margin: 0;
          opacity: 0.8;
        }

        .bst-account-logout {
          flex-shrink: 0;
          padding: 9px 13px;
          border-radius: 999px;
          border: 1px solid var(--account-border);
          color: var(--account-pink);
          background: white;
          text-decoration: none;
          font-size: 11px;
          font-weight: 800;
        }

        .bst-account-settings {
          margin: 20px 0;
          border: 1px solid var(--account-border);
          border-radius: 15px;
          background: var(--account-cream);
          overflow: hidden;
        }

        .bst-account-settings summary {
          cursor: pointer;
          padding: 14px 17px;
          color: var(--account-pink);
          font-size: 12px;
          font-weight: 800;
          list-style-position: inside;
        }

        .bst-account-settings-body {
          padding: 0 14px 16px;
        }

        .bst-account-stats {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .bst-account-stat {
          grid-column: span 2;
          min-width: 0;
          min-height: 105px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          gap: 10px;
          padding: 14px 8px;
          background: var(--account-soft);
          border: 1px solid var(--account-border);
          border-radius: 17px;
        }

        .bst-account-stat:nth-child(4),
        .bst-account-stat:nth-child(5) {
          grid-column: span 3;
        }

        .bst-account-stat span,
        .bst-account-donate span,
        .bst-account-reward > span {
          color: var(--account-dark);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .bst-account-stat strong {
          color: var(--account-pink);
          font-size: clamp(25px, 4vw, 35px);
          line-height: 1;
        }

        .bst-account-donate {
          padding: 23px 15px;
          border-radius: 18px;
          border: 1px solid var(--account-border);
          background: var(--account-soft);
          text-align: center;
        }

        .bst-account-donate strong {
          display: block;
          margin: 13px 0;
          color: var(--account-pink);
          font-size: clamp(24px, 4vw, 36px);
          overflow-wrap: anywhere;
        }

        .bst-account-donate p {
          margin: 0;
          font-size: 13px;
        }

        .bst-account-rewards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .bst-account-reward {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 23px 12px;
          border: 1px solid var(--account-border);
          border-radius: 18px;
          background: var(--account-soft);
        }

        .bst-account-reward strong {
          margin: 15px 0;
          font-size: clamp(28px, 4vw, 38px);
          color: var(--account-pink);
        }

        .bst-account-reward p {
          margin: 0 0 16px;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.5;
        }

        .bst-account-reward a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          margin-top: auto;
          padding: 9px 13px;
          border-radius: 999px;
          background: var(--account-pink);
          color: white;
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          text-align: center;
        }

        .bst-account-reward a:hover {
          filter: brightness(1.07);
        }

        .bst-account-table-scroll {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--account-border);
          border-radius: 16px;
        }

        .bst-account-table {
          width: 100%;
          min-width: 680px;
          border-collapse: collapse;
          background: white;
          font-size: 12px;
        }

        .bst-account-table th {
          padding: 14px 12px;
          background: #ffedf5;
          color: var(--account-dark);
          text-align: left;
          white-space: nowrap;
          font-weight: 800;
        }

        .bst-account-table td {
          padding: 14px 12px;
          border-top: 1px solid #f8e0ea;
          vertical-align: middle;
        }

        .bst-account-table tbody tr:nth-child(even) {
          background: #fffafd;
        }

        .bst-account-reference {
          font-family: monospace;
        }

        .bst-account-status {
          display: inline-block;
          border-radius: 999px;
          padding: 5px 10px;
          background: #f3edf0;
          color: #8b6576;
          font-size: 11px;
          font-weight: 800;
        }

        .bst-account-status.verified {
          background: #e7f7ec;
          color: #28794a;
        }

        .bst-account-empty {
          text-align: center;
          padding: 25px !important;
          color: #98788a;
        }

        .bst-account-error {
          margin-top: 12px;
          color: #b42348;
          font-size: 12px;
        }

        .bst-account-note {
          font-size: 12px;
          margin-top: 12px;
          opacity: 0.75;
        }

        @media (max-width: 600px) {
          .bst-account-panel {
            padding: 17px 13px;
            border-radius: 19px;
            margin-bottom: 14px;
          }

          .bst-account-heading {
            gap: 8px;
          }

          .bst-account-logout {
            padding: 8px 10px;
            font-size: 10px;
          }

          .bst-account-stats {
            gap: 8px;
          }

          .bst-account-stat {
            min-height: 95px;
            padding: 12px 5px;
            border-radius: 13px;
          }

          .bst-account-stat span {
            font-size: 9px;
          }

          .bst-account-stat strong {
            font-size: 27px;
          }

          .bst-account-rewards {
            gap: 9px;
          }

          .bst-account-reward {
            padding: 18px 8px;
            border-radius: 14px;
          }

          .bst-account-reward > span {
            font-size: 10px;
          }

          .bst-account-reward strong {
            font-size: 29px;
          }

          .bst-account-reward a {
            font-size: 9px;
            padding: 9px 8px;
          }
        }
      `}</style>
    </main>
  );
}
