import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  description: z.string().max(3000),
  is_open: z.boolean(),
}).strict();

export async function PATCH(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  const access = await requireAdminAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Thông tin Project không hợp lệ' }, { status: 400 });
  const { id, ...updates } = parsed.data;
  const { data, error } = await supabase.rpc('bst_admin_update_project', {
    p_id: id,
    p_name: updates.name,
    p_description: updates.description,
    p_is_open: updates.is_open,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ project: data });
}
