
import { supabaseServer } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';
import AdminDonateDashboard from './AdminDonateDashboard';
import AdminOtpForm from './AdminOtpForm';
import AdminProjects from './AdminProjects';
import AdminGachaSettings from './AdminGachaSettings';
import AdminDataOverview from './AdminDataOverview';
import AdminTicketGrants from './AdminTicketGrants';
import AdminBankSettings from './AdminBankSettings';

export const dynamic = 'force-dynamic';

const overviewLinks: Record<string, string> = { 'Quản lý tài khoản': '#accounts-overview', 'Tặng lượt quay': '#grant-tickets', 'Xác suất Gacha': '#gift-types-overview', 'Quản lý quà': '#gift-items-overview', 'Kết quả quay': '#spins-overview', 'Trade & Gift': '#trade-overview', 'Giao lưu & Thư gửi Trang': '#community-overview', 'Báo cáo Excel': '#admin-reports', 'Ngân hàng & QR Donate': '#bank-settings' };

const adminModules = [
  {
    title: 'Quản lý tài khoản',
    description: 'Tài khoản Kandee, chặn đăng nhập và thông báo.',
  },
  {
    title: 'Cài đặt Gacha',
    description: 'Tỷ lệ đổi lượt và thời gian xác minh Gacha.',
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
    description: 'Danh sách quà đã phát hành và tồn kho theo loại.',
  },
  {
    title: 'Kết quả quay',
    description: 'Lịch sử Gacha và xuất dữ liệu.',
  },
  {
    title: 'Trade & Gift',
    description: 'Theo dõi bài đăng và đề nghị Trade; chức năng tặng quà riêng chưa hoàn thiện.',
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

  const [grantProfiles,grantHistory] = await Promise.all([
    db.from('profiles').select('id,username,blocked,role').order('created_at',{ascending:false}).limit(500),
    db.from('admin_ticket_grants').select('id,recipient_id,actor_id,normal_count,gold_count,reason,created_at').order('created_at',{ascending:false}).limit(100),
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

        <nav className="bst-v40-admin-menu" aria-label="Danh mục quản trị V40">
          <section><h2>✦ HỆ THỐNG</h2><a className="bst-v40-admin-primary" href="#accounts-overview">QUẢN LÝ TÀI KHOẢN USER</a></section>
          <section><h2>DONATE &amp; PROJECT</h2><div className="bst-v40-admin-menu-grid">
            <a href="#donate-management">KHAI BÁO DONATE / ĐỐI SOÁT DONATE</a>
            <a href="#community-overview">LỜI NHẮN CỦA KANDEE</a>
            <a href="#bank-settings">CẤU HÌNH QR NGÂN HÀNG NHẬN DONATE</a>
            <a href="#project-management">QUẢN LÝ PROJECT DONATE</a>
          </div></section>
          <section><h2>VÒNG XOAY &amp; QUÀ</h2><div className="bst-v40-admin-menu-grid">
            <a href="#gacha-settings">CÀI ĐẶT GACHA</a>
            <a href="#grant-tickets">THEO DÕI &amp; TẶNG LƯỢT QUAY USER</a>
            <a href="#gift-types-overview">XÁC SUẤT TRÚNG QUÀ THEO ĐỘ HIẾM</a>
            <a href="#gift-items-overview">QUẢN LÝ DANH SÁCH QUÀ TẶNG</a>
            <a href="#spins-overview">KẾT QUẢ QUAY GỬI VỀ ADMIN</a>
          </div></section>
          <section><h2>TRADE &amp; INVENTORY</h2><div className="bst-v40-admin-menu-grid">
            <a href="#trade-overview">THEO DÕI TRADE GIFT</a>
            <a href="#gift-items-overview">THEO DÕI TẶNG GIFT / INVENTORY CUỐI CÙNG THEO USER</a>
          </div></section>
          <section><h2>CỘNG ĐỒNG</h2><div className="bst-v40-admin-menu-grid">
            <a href="#community-overview">QUẢN LÝ CỘNG ĐỒNG KANDEE</a>
            <a href="#admin-reports">BÁO CÁO &amp; XUẤT DỮ LIỆU</a>
          </div></section>
        </nav>
      </section>

      <AdminBankSettings initial={(await db.from('bst_donation_bank_settings').select('bank_name,account_name,account_number,qr_image_url,instructions').eq('id',true).maybeSingle()).data ?? null} />
      <section className="panel" id="admin-reports" style={{scrollMarginTop:24}}>
        <h2>BÁO CÁO — XUẤT DỮ LIỆU</h2>
        <p className="muted">Tải CSV mở bằng Excel; tối đa 5.000 bản ghi gần nhất mỗi loại, yêu cầu Admin OTP.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {(['donations','spins','gifts','transfers','trade','trade_offers','gift_movements','ticket_grants'] as const).map(kind=><a key={kind} href={'/api/admin/reports?report='+kind} download style={{padding:12,border:'1px solid #e12589',borderRadius:10}}>Xuất {kind.toUpperCase()}</a>)}
        </div>
      </section>
      <AdminGachaSettings settings={settingsResult.data ?? null} />
      <AdminProjects projects={projectsResult.data ?? []} />
      <AdminTicketGrants profiles={grantProfiles.data ?? []} history={grantHistory.data ?? []} historyError={grantHistory.error?.message} />
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
