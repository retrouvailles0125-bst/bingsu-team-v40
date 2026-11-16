import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

import AdminDonateDashboard from './AdminDonateDashboard';
import AdminOtpForm from './AdminOtpForm';
import AdminProjects from './AdminProjects';
import AdminGachaSettings from './AdminGachaSettings';
import AdminDataOverview from './AdminDataOverview';
import AdminTicketGrants from './AdminTicketGrants';
import AdminBankSettings from './AdminBankSettings';
import AdminDonateFields from './AdminDonateFields';
import AdminKandeeMessages from './AdminKandeeMessages';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ section?: string }>;
};

type Tab = {
  id: string;
  label: string;
};

type Group = {
  title: string;
  tabs: Tab[];
};

// Thứ tự nhóm và tên tab lấy theo Admin HTML V40 gốc.
const groups: Group[] = [
  {
    title: 'HỆ THỐNG',
    tabs: [
      { id: 'accounts-overview', label: 'QUẢN LÝ TÀI KHOẢN USER' },
    ],
  },
  {
    title: 'DONATE & PROJECT',
    tabs: [
      { id: 'donate-fields', label: 'KHAI BÁO DONATE' },
      { id: 'love-overview', label: 'LỜI NHẮN CỦA KANDEE' },
      { id: 'donate-management', label: 'ĐỐI SOÁT DONATE' },
      {
        id: 'bank-settings',
        label: 'CẤU HÌNH QR NGÂN HÀNG NHẬN DONATE',
      },
      { id: 'project-management', label: 'QUẢN LÝ PROJECT DONATE' },
    ],
  },
  {
    title: 'VÒNG XOAY & QUÀ',
    tabs: [
      { id: 'gacha-settings', label: 'CÀI ĐẶT VÒNG XOAY' },
      {
        id: 'grant-tickets',
        label: 'THEO DÕI & TẶNG LƯỢT QUAY USER',
      },
      {
        id: 'gift-types-overview',
        label: 'XÁC SUẤT TRÚNG QUÀ THEO ĐỘ HIẾM',
      },
      {
        id: 'gift-items-overview',
        label: 'QUẢN LÝ DANH SÁCH QUÀ TẶNG',
      },
      {
        id: 'spins-overview',
        label: 'KẾT QUẢ QUAY GỬI VỀ ADMIN',
      },
    ],
  },
  {
    title: 'TRADE & INVENTORY',
    tabs: [
      { id: 'trade-overview', label: 'THEO DÕI TRADE GIFT' },
      { id: 'gift-transfers', label: 'THEO DÕI TẶNG GIFT' },
      {
        id: 'inventory-overview',
        label: 'INVENTORY CUỐI CÙNG THEO USER',
      },
    ],
  },
  {
    title: 'CỘNG ĐỒNG',
    tabs: [
      {
        id: 'community-overview',
        label: 'QUẢN LÝ CỘNG ĐỒNG KANDEE',
      },
    ],
  },
];

// 'love-overview' đã tách ra component riêng AdminKandeeMessages.
const supportedDataSections = [
  'accounts-overview',
  'gift-types-overview',
  'gift-items-overview',
  'spins-overview',
  'trade-overview',
  'community-overview',
];

export default async function AdminPage({
  searchParams,
}: PageProps) {
  const { section: requestedSection } = await searchParams;

  const allTabs: Tab[] = groups.flatMap(
    (group) => group.tabs
  );

  const section =
    requestedSection &&
    allTabs.some((tab) => tab.id === requestedSection)
      ? requestedSection
      : 'accounts-overview';

  const currentGroup = groups.find((group) =>
    group.tabs.some((tab) => tab.id === section)
  );

  const currentTab = allTabs.find(
    (tab) => tab.id === section
  );

  const db = await supabaseServer();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return (
      <main className="page">
        <section className="panel">
          Vui lòng đăng nhập để truy cập BINGSU TEAM.
        </section>
      </main>
    );
  }

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role,blocked')
    .eq('id', user.id)
    .single();

  if (
    profileError ||
    profile?.role !== 'admin' ||
    profile.blocked
  ) {
    return (
      <main className="page">
        <section className="panel">
          Bạn không có quyền truy cập khu vực BST.
        </section>
      </main>
    );
  }

  const access = await requireAdminAccess();

  if (!access.ok) {
    return (
      <main className="page">
        <section className="panel">
          <h2>BINGSU TEAM — XÁC THỰC QUẢN TRỊ</h2>
          <p>{access.error}</p>
          <AdminOtpForm />
        </section>
      </main>
    );
  }

  const needsUsers = ['love-overview', 'donate-management'].includes(
    section
  );

  const [
    donationsResult,
    settingsResult,
    projectsResult,
    grantProfiles,
    grantHistory,
    bankResult,
    messageResult,
    messageProjects,
    userNames,
  ] = await Promise.all([
    // Đối soát: lấy toàn bộ cột để hiển thị đủ thông tin khai báo.
    section === 'donate-management'
      ? db
          .from('donations')
          .select('*,projects(name)')
          .order('created_at', { ascending: false })
          .limit(100)
      : null,

    ['donate-management', 'gacha-settings'].includes(section)
      ? db
          .from('gacha_exchange_settings')
          .select(
            'normal_rate,gold_rate,verify_wait_seconds'
          )
          .eq('id', true)
          .single()
      : null,

    section === 'project-management'
      ? db
          .from('projects')
          .select('id,name,description,is_open')
          .order('created_at', { ascending: false })
      : null,

    section === 'grant-tickets'
      ? db
          .from('profiles')
          .select('id,username,blocked,role')
          .order('created_at', { ascending: false })
          .limit(500)
      : null,

    section === 'grant-tickets'
      ? db
          .from('admin_ticket_grants')
          .select(
            'id,recipient_id,actor_id,normal_count,gold_count,reason,created_at'
          )
          .order('created_at', { ascending: false })
          .limit(100)
      : null,

    section === 'bank-settings'
      ? db
          .from('bst_donation_bank_settings')
          .select(
            'bank_name,account_name,account_number,qr_image_url,instructions'
          )
          .eq('id', true)
          .maybeSingle()
      : null,

    // Lời nhắn của Kandee: lấy từ khai báo donate.
    section === 'love-overview'
      ? db
          .from('donations')
          .select(
            'id,user_id,project_id,declared_amount,received_amount,status,created_at,kandee_message,bst_message,projects(name)'
          )
          .order('created_at', { ascending: false })
          .limit(500)
      : null,

    section === 'love-overview'
      ? db
          .from('projects')
          .select('id,name')
          .order('created_at', { ascending: false })
      : null,

    needsUsers
      ? db.from('profiles').select('id,username').limit(1000)
      : null,
  ]);

  // Bill chuyển khoản là dữ liệu riêng tư: chỉ tạo link ký sẵn
  // (hết hạn sau 5 phút), không đưa đường dẫn lưu trữ thật ra trình duyệt.
  type BillRow = { donation_id: string; storage_path: string };
  let bills: { donation_id: string; name: string; url: string | null }[] = [];

  if (section === 'donate-management') {
    const donationIds = (donationsResult?.data ?? []).map(
      (donation: { id: string }) => donation.id
    );

    if (donationIds.length > 0) {
      const { data: billRows } = await db
        .from('donation_bills')
        .select('donation_id,storage_path')
        .in('donation_id', donationIds);

      bills = await Promise.all(
        ((billRows ?? []) as BillRow[]).map(async (row) => {
          const { data: signed } = await db.storage
            .from('donation-bills')
            .createSignedUrl(row.storage_path, 300);

          return {
            donation_id: row.donation_id,
            name: row.storage_path.split('/').pop() || 'bill',
            url: signed?.signedUrl ?? null,
          };
        })
      );
    }
  }

  const unavailableSections = [
    'gift-transfers',
    'inventory-overview',
  ];

  return (
    <main className="page">
      {/* Thanh công cụ HTML V40 */}
      <div className="bst-admin-toolbar" />

      {/* Thanh tab ngang HTML V40 */}
      <nav
        className="subtabs admin-tabs"
        aria-label="BINGSU TEAM Admin"
      >
        {groups.map((group) => (
          <div
            key={group.title}
            style={{ display: 'contents' }}
          >
            <span
              className={
                'admin-group-label' +
                (currentGroup?.title === group.title
                  ? ' group-current'
                  : '')
              }
            >
              {group.title}
            </span>

            {group.tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/admin?section=${tab.id}`}
                className={
                  section === tab.id ? 'selected' : ''
                }
                aria-current={
                  section === tab.id ? 'page' : undefined
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Thanh vị trí HTML V40 */}
      <div className="bst-admin-location">
        <span className="bst-location-label">
          BẠN ĐANG Ở
        </span>

        <span>
          {currentGroup?.title ?? 'HỆ THỐNG'}
        </span>

        <span className="bst-location-chevron">
          ›
        </span>

        <strong>
          {currentTab?.label ?? 'QUẢN LÝ TÀI KHOẢN USER'}
        </strong>
      </div>

      {supportedDataSections.includes(section) && (
        <section className="panel">
          <h2>{currentTab?.label}</h2>
          <AdminDataOverview section={section} />
        </section>
      )}

      {section === 'donate-fields' && (
        <AdminDonateFields />
      )}

      {section === 'love-overview' && (
        <section className="panel">
          <h2>LỜI NHẮN CỦA KANDEE</h2>
          <AdminKandeeMessages
            rows={messageResult?.data ?? []}
            projects={messageProjects?.data ?? []}
            users={userNames?.data ?? []}
            error={messageResult?.error?.message ?? null}
          />
        </section>
      )}

      {section === 'gacha-settings' && (
        <section className="panel">
          <h2>CÀI ĐẶT VÒNG XOAY</h2>
          <AdminGachaSettings
            settings={settingsResult?.data ?? null}
          />
        </section>
      )}

      {section === 'donate-management' && (
        <section className="panel">
          <h2>Đối soát Donate</h2>
          <AdminDonateDashboard
            donations={donationsResult?.data ?? []}
            settings={settingsResult?.data ?? null}
            users={userNames?.data ?? []}
            bills={bills}
            initialError={
              donationsResult?.error?.message ??
              settingsResult?.error?.message ??
              null
            }
          />
        </section>
      )}

      {section === 'grant-tickets' && (
        <section className="panel">
          <h2>THEO DÕI & TẶNG LƯỢT QUAY USER</h2>
          <AdminTicketGrants
            profiles={grantProfiles?.data ?? []}
            history={grantHistory?.data ?? []}
            historyError={grantHistory?.error?.message}
          />
        </section>
      )}

      {section === 'bank-settings' && (
        <section className="panel">
          <h2>CẤU HÌNH QR NGÂN HÀNG NHẬN DONATE</h2>
          <AdminBankSettings
            initial={bankResult?.data ?? null}
          />
        </section>
      )}

      {section === 'project-management' && (
        <section className="panel">
          <h2>Quản lý Project Donate</h2>
          <AdminProjects
            projects={projectsResult?.data ?? []}
          />
        </section>
      )}

      {unavailableSections.includes(section) && (
        <section className="panel">
          <h2>{currentTab?.label}</h2>
          <p className="muted">
            Phần này có trong HTML V40 gốc nhưng chưa
            có component kết nối backend tương ứng.
            Chưa thực hiện thao tác quản trị tại đây.
          </p>
        </section>
      )}
    </main>
  );
}