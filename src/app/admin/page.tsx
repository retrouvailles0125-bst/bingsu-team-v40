
import { supabaseServer } from '@/lib/supabase';
import AdminDonateDashboard from './AdminDonateDashboard';

export const dynamic = 'force-dynamic';

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

  const [donationsResult, settingsResult] = await Promise.all([
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
  ]);

  return (
    <main className="page">
      <section className="panel">
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
