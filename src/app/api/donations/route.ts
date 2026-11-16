import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type FieldType = 'text' | 'textarea' | 'number' | 'date';
type Field = {
  key: string;
  label: string;
  type: FieldType;
  visible: boolean;
  public: boolean;
  required: boolean;
  deleted: boolean;
  system: boolean;
};

const SYSTEM: Record<string, FieldType> = {
  display_id: 'text',
  phone: 'text',
  amount: 'number',
  transfer_date: 'date',
  kandee_message: 'textarea',
  bst_message: 'textarea',
};

const PRIVATE = new Set(['phone', 'bst_message']);
const ALLOWED_TYPES = new Set<FieldType>([
  'text', 'textarea', 'number', 'date',
]);

const schema = z.object({
  project_id: z.string().uuid(),
  declared_amount: z.coerce.number().int().positive().max(1000000000),
  kandee_message: z.string().max(2000),
  bst_message: z.string().max(2000),
});

function validFields(value: unknown): value is Field[] {
  if (!Array.isArray(value) || value.length < 6 || value.length > 60) {
    return false;
  }

  const keys = new Set<string>();

  for (const f of value) {
    if (!f || typeof f !== 'object') return false;
    const x = f as Record<string, unknown>;

    if (
      typeof x.key !== 'string' ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(x.key) ||
      keys.has(x.key) ||
      typeof x.label !== 'string' ||
      x.label.length < 1 ||
      x.label.length > 120 ||
      !ALLOWED_TYPES.has(x.type as FieldType) ||
      typeof x.visible !== 'boolean' ||
      typeof x.public !== 'boolean' ||
      typeof x.required !== 'boolean' ||
      typeof x.deleted !== 'boolean' ||
      typeof x.system !== 'boolean'
    ) return false;

    keys.add(x.key);

    if (x.key in SYSTEM) {
      if (!x.system || x.type !== SYSTEM[x.key]) return false;
    } else if (!x.key.startsWith('custom_') || x.system) {
      return false;
    }

    if (x.required && (!x.visible || x.deleted)) return false;
    if ((!x.visible || x.deleted) && x.public) return false;
    if (PRIVATE.has(x.key) && x.public) return false;
  }

  for (const key of Object.keys(SYSTEM)) {
    if (!keys.has(key)) return false;
  }

  for (const key of ['display_id', 'amount']) {
    const field = value.find(f => f.key === key) as Field;
    if (!field.visible || !field.required || field.deleted || !field.public) {
      return false;
    }
  }

  return true;
}

function parseFieldValue(field: Field, value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!trimmed) return field.required ? null : '';

  if (field.type === 'number') {
    if (!/^\d{1,15}$/.test(trimmed)) return null;
    const number = Number(trimmed);
    if (!Number.isSafeInteger(number) || number < 0) return null;
    return String(number);
  }

  if (field.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    const date = new Date(`${trimmed}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== trimmed
    ) return null;
    return trimmed;
  }

  const limit = field.type === 'textarea' ? 2000 : 255;
  if (trimmed.length > limit) return null;

  return trimmed;
}

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Vui lòng đăng nhập' },
      { status: 401 }
    );
  }

  const form = await req.formData().catch(() => null);

  if (!form) {
    return NextResponse.json(
      { error: 'Form không hợp lệ' },
      { status: 400 }
    );
  }

  const { data: settings, error: settingsError } = await supabase
    .from('bst_donate_field_settings')
    .select('max_bills,fields')
    .eq('id', true)
    .maybeSingle();

  if (
    settingsError ||
    !settings ||
    !Number.isInteger(settings.max_bills) ||
    settings.max_bills < 1 ||
    settings.max_bills > 20 ||
    !validFields(settings.fields)
  ) {
    return NextResponse.json(
      { error: 'Cấu hình Donate chưa sẵn sàng. Chưa tạo giao dịch.' },
      { status: 503 }
    );
  }

  const fields = settings.fields;
  const active = fields.filter(f => f.visible && !f.deleted);

  let rawValues: unknown;

  try {
    const raw = form.get('declaration_fields');
    if (typeof raw !== 'string' || raw.length > 50000) {
      throw new Error('Invalid declaration');
    }
    rawValues = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Thông tin khai báo không hợp lệ.' },
      { status: 400 }
    );
  }

  if (
    !rawValues ||
    typeof rawValues !== 'object' ||
    Array.isArray(rawValues)
  ) {
    return NextResponse.json(
      { error: 'Dữ liệu khai báo phải là object.' },
      { status: 400 }
    );
  }

  const submitted = rawValues as Record<string, unknown>;
  const allowedKeys = new Set(active.map(f => f.key));

  if (Object.keys(submitted).some(key => !allowedKeys.has(key))) {
    return NextResponse.json(
      { error: 'Có trường khai báo không được phép gửi.' },
      { status: 400 }
    );
  }

  const values: Record<string, string> = {};

  for (const field of active) {
    if (field.key === 'amount') continue;

    const parsed = parseFieldValue(field, submitted[field.key] ?? '');

    if (parsed === null) {
      return NextResponse.json(
        { error: `Thông tin "${field.label}" không hợp lệ.` },
        { status: 400 }
      );
    }

    values[field.key] = parsed;
  }

  const input = schema.safeParse({
    project_id: form.get('project_id'),
    declared_amount: form.get('declared_amount'),
    kandee_message: values.kandee_message ?? '',
    bst_message: values.bst_message ?? '',
  });

  if (!input.success) {
    return NextResponse.json(
      { error: 'Thông tin Donate không hợp lệ' },
      { status: 400 }
    );
  }

  const rawBills = form.getAll('bills');

  if (rawBills.some(f => !(f instanceof File))) {
    return NextResponse.json(
      { error: 'Danh sách bill không hợp lệ.' },
      { status: 400 }
    );
  }

  const bills = rawBills as File[];

  if (bills.length < 1 || bills.length > settings.max_bills) {
    return NextResponse.json(
      { error: `Bắt buộc 1–${settings.max_bills} bill.` },
      { status: 400 }
    );
  }

  const mimeTypes = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  ]);

  if (bills.some(f =>
    f.size === 0 ||
    f.size > 5 * 1024 * 1024 ||
    !mimeTypes.has(f.type)
  )) {
    return NextResponse.json(
      { error: 'Bill không hợp lệ hoặc quá 5 MB.' },
      { status: 400 }
    );
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', input.data.project_id)
    .eq('is_open', true)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Project đã đóng hoặc không tồn tại.' },
      { status: 400 }
    );
  }

  // Snapshot các giá trị đã nhập, không lưu cờ public do client gửi.
  // Giá trị riêng tư không được đưa nguyên object này ra Tracking.
  const declarationFields = Object.fromEntries(
    Object.entries(values).filter(([key]) =>
      key !== 'kandee_message' && key !== 'bst_message'
    )
  );

  const { data: donation, error } = await supabase
    .from('donations')
    .insert({
      user_id: user.id,
      project_id: input.data.project_id,
      declared_amount: input.data.declared_amount,
      kandee_message: input.data.kandee_message,
      bst_message: input.data.bst_message,
      declaration_fields: declarationFields,
    })
    .select('id,status')
    .single();

  if (error || !donation) {
    return NextResponse.json(
      {
        error:
          'Không tạo được khai báo. Kiểm tra migration ' +
          'declaration_fields và quyền truy cập Supabase.',
      },
      { status: 503 }
    );
  }

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };

  for (const file of bills) {
    const path =
      `${user.id}/${donation.id}/${crypto.randomUUID()}.` +
      extensions[file.type];

    const { error: uploadError } = await supabase.storage
      .from('donation-bills')
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error:
            'Tải bill chưa hoàn tất. KHÔNG gửi lại giao dịch mới; ' +
            'liên hệ BST kèm mã khai báo.',
          donation_id: donation.id,
          status: 'incomplete_upload',
        },
        { status: 500 }
      );
    }

    const { error: linkError } = await supabase
      .from('donation_bills')
      .insert({
        donation_id: donation.id,
        storage_path: path,
        uploaded_by: user.id,
      });

    if (linkError) {
      return NextResponse.json(
        {
          error:
            'Bill đã tải lên nhưng chưa liên kết được. ' +
            'KHÔNG gửi lại giao dịch mới; liên hệ BST kèm mã khai báo.',
          donation_id: donation.id,
          status: 'incomplete_upload',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { id: donation.id, status: donation.status },
    { status: 201 }
  );
}
