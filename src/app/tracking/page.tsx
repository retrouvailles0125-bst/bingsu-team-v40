import {supabaseServer} from '@/lib/supabase';
import TrackingPanel, {type TrackingRow} from './TrackingPanel';

export const dynamic = 'force-dynamic';

export default async function Tracking() {
  const db = await supabaseServer();
  const {data, error} = await db.rpc('bst_public_donation_tracking');
  const rows = (data || []) as unknown as TrackingRow[];
  return (
    <main className="bst-v40-page">
      <TrackingPanel rows={rows} error={error?.message || null} />
    </main>
  );
}