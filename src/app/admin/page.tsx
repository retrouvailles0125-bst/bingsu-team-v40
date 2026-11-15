
import { supabaseServer } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';
import AdminDonateDashboard from './AdminDonateDashboard';
import AdminOtpForm from './AdminOtpForm';
import AdminProjects from './AdminProjects';
import AdminGachaSettings from './AdminGachaSettings';
import AdminDataOverview from './AdminDataOverview';

export const dynamic = 'force-dynamic';

const overviewLinks: Record<string, string> = { 'Quản lý tài khoản': '#accounts-overview', 'Tặng lượt quay': '#tickets-overview', 'Xác suất Gacha': '#gift-types-overview', 'Quản lý quà': '#gift-items-overview', 'Kết quả quay': '#spins-overview', 'Trade & Gift': '#trade-overview', 'Giao lưu & Thư gửi Trang': '#community-overview' };

const adminModules = [
  {
    title: 'Quản lý tài khoản',
    description: 'Tài khoản Kandee, chặn đăng nhập và thông báo.',
  },
  {
    title: 'Cài đặt vòng xoay',
    description: 'Tỷ lệ lượt quay và thời gian Gacha.',
  },
  {
    title: 'Quản lý Project',
    description: 'Thông tin, trạng thái và danh sách Project.',
  },
  {
    title: 'Ngân hàng & QR Donate',
    description: 'Tài khoản nhận Donate và ảnh QR.',
  },
  {
    title: 'Tặng lượt quay',
    description: 'Cấp lượt quay cho tài khoản Kandee.',
  },
  {
    title: 'Xác suất Gacha',
    description: 'Xác suất Normal, Gold và các độ hiếm.',
  },
  {
    title: 'Quản lý quà',
    description: 'Danh sách quà và tồn kho.',
  },
  {
    title: 'Kết quả quay',
    description: 'Lịch sử Gacha và xuất dữ liệu.',
  },
  {
    title: 'Trade & Gift',
    description: 'Theo dõi giao dịch Trade và tặng quà.',
  },
  {
    title: 'Giao lưu & Thư gửi Trang',
    description: 'Quản lý bài viết, thư và bộ lọc.',
  },
  {
    title: 'Báo cáo Excel',
    description: 'Xuất dữ liệu đối soát và báo cáo.',
  },
];

export default async function AdminPage() {
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

  const [donationsResult, settingsResult, projectsResult] = await Promise.all([
    db
      .from('donations')
      .select(
        'id,user_id,project_id,declared_amount,received_amount,status,created_at,verified_at,verification_ready_at,normal_tickets,gold_tickets,allocation_choice,allocation_completed_at,projects(name)'
      )
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('gacha_exchange_settings')
      .select('normal_rate,gold_rate,verify_wait_seconds')
      .eq('id', true)
      .single(),
    db.from('projects').select('id,name,description,is_open').order('created_at', { ascending: false }),
  ]);

  return (
    <main className="page">
      <section className="panel">
        <h1 style={{ color: '#e12589' }}>
          BINGSU TEAM — ADMIN V40
        </h1>
        <p className="muted">
          Trung tâm quản trị BINGSU TEAM.
        </p>

        <h2>Danh mục quản trị</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <a
            href="#donate-management"
            style={{
              display: 'block',
              padding: 18,
              border: '2px solid #e12589',
              borderRadius: 14,
              background: '#fff0f8',
              color: '#a41464',
              textDecoration: 'none',
            }}
          >
            <strong>Donate Management</strong>
            <p style={{ fontSize: 13 }}>
              Xác minh Donate và quản lý phân bổ lượt.
            </p>
            <span style={{ fontSize: 12 }}>
              Đã kết nối Supabase
            </span>
          </a>

          {adminModules.map((module) => (
            <a
              href={module.title === 'Quản lý Project' ? '#project-management' : module.title === 'Cài đặt vòng xoay' ? '#gacha-settings' : overviewLinks[module.title] || '#admin-pending'}
              key={module.title}
              style={{
                padding: 18,
                border: '1px solid #f0c8df',
                borderRadius: 14,
                background: '#fff',
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <strong style={{ color: '#a41464' }}>
                {module.title}
              </strong>
              <p style={{ fontSize: 13 }}>
                {module.description}
              </p>
              {module.title === 'Quản lý Project' ? (
                <span>Mở quản lý Project · Supabase</span>
              ) : module.title === 'Cài đặt vòng xoay' ? (
                <span>Mở cài đặt vòng xoay · Supabase</span>
              ) : overviewLinks[module.title] ? (
                <span>Mở quản lý · Supabase</span>
              ) : (
                <span style={{ fontSize: 12, color: '#777' }}>Chưa kết nối Supabase</span>
              )}
            </a>
          ))}
        </div>
      </section>

      <section className="panel" id="admin-pending"><p>Ngân hàng & QR Donate và Báo cáo Excel đang được phát triển. Chưa có thao tác lưu dữ liệu cho hai module này.</p></section>
      <AdminGachaSettings settings={settingsResult.data ?? null} />
      <AdminProjects projects={projectsResult.data ?? []} />
      <AdminDataOverview />

      <section
        className="panel"
        id="donate-management"
        style={{ scrollMarginTop: 24 }}
      >
        <h2>BINGSU TEAM — DONATE MANAGEMENT</h2>
        <p className="muted">
          Quản lý xác minh Donate và phân bổ lượt Gacha V40.4.
        </p>

        <AdminDonateDashboard
          donations={donationsResult.data ?? []}
          settings={settingsResult.data ?? null}
          initialError={
            donationsResult.error?.message ??
            settingsResult.error?.message ??
            null
          }
        />
      </section>
    </main>
  );
}
