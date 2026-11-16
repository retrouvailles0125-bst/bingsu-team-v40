import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

export const dynamic = 'force-dynamic';

const qrSchema = z.object({
  kind: z.literal('qr_image'),
  label: z.string().trim().min(1).max(120),
  qr_image_url: z.string().url().startsWith('https://').max(1000),
}).strict();

const bankSchema = z.object({
  kind: z.literal('bank_account'),
  bank_name: z.enum(['Techcombank', 'Vietcombank']),
  account_number: z.string().regex(/^[0-9]{5,25}$/),
  account_name: z.string().trim().min(1).max(120),
}).strict();

const idSchema = z.object({
  id: z.string().uuid(),
}).strict();

async function getAdmin() {
  const { supabase, user } = await requireUser();

  if (!user) {
    return {
      supabase,
      response: NextResponse.json(
        { error: 'Chưa đăng nhập' }, { status: 401 }
      ),
    };
  }

  const access = await requireAdminAccess();

  if (!access.ok) {
    return {
      supabase,
      response: NextResponse.json(
        { error: access.error }, { status: access.status }
      ),
    };
  }

  return { supabase, response: null };
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const auth = await getAdmin();
    if (auth.response) return auth.response;

    const { data, error } = await auth.supabase
      .from('bst_donation_payment_methods')
      .select(
        'id,kind,label,bank_name,account_name,account_number,qr_image_url,is_active'
      )
      .order('created_at', { ascending: true });

    if (error) return fail('Không tải được danh sách phương thức.', 503);

    return NextResponse.json(
      { methods: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return fail('Không thể tải cấu hình.', 503);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAdmin();
    if (auth.response) return auth.response;

    const raw = await req.json().catch(() => null);
    const parsed = z.discriminatedUnion('kind', [
      qrSchema, bankSchema,
    ]).safeParse(raw);

    if (!parsed.success) return fail('Thông tin không hợp lệ.');

    const v = parsed.data;

    const args = {
      p_kind: v.kind,
      p_label: v.kind === 'qr_image' ? v.label : '',
      p_bank_name: v.kind === 'bank_account' ? v.bank_name : '',
      p_account_name: v.kind === 'bank_account' ? v.account_name : '',
      p_account_number: v.kind === 'bank_account' ? v.account_number : '',
      p_qr_image_url: v.kind === 'qr_image' ? v.qr_image_url : '',
    };

    const { error } = await auth.supabase.rpc(
      'bst_admin_add_payment_method', args
    );

    if (error) return fail('Không thêm được phương thức Donate.', 400);

    return NextResponse.json({ ok: true });
  } catch {
    return fail('Không thể thêm phương thức.', 503);
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAdmin();
    if (auth.response) return auth.response;

    const parsed = idSchema.safeParse(
      await req.json().catch(() => null)
    );

    if (!parsed.success) return fail('ID không hợp lệ.');

    const { error } = await auth.supabase.rpc(
      'bst_admin_activate_payment_method',
      { p_id: parsed.data.id }
    );

    if (error) return fail('Không thể chọn phương thức mặc định.');

    return NextResponse.json({ ok: true });
  } catch {
    return fail('Không thể cập nhật phương thức.', 503);
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getAdmin();
    if (auth.response) return auth.response;

    const parsed = idSchema.safeParse(
      await req.json().catch(() => null)
    );

    if (!parsed.success) return fail('ID không hợp lệ.');

    const { error } = await auth.supabase.rpc(
      'bst_admin_delete_payment_method',
      { p_id: parsed.data.id }
    );

    if (error) return fail('Không thể xóa phương thức Donate.');

    return NextResponse.json({ ok: true });
  } catch {
    return fail('Không thể xóa phương thức.', 503);
  }
}
