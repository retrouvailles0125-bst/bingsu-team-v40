import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

export const dynamic = 'force-dynamic';

const systemDefinitions = {
  display_id: { type: 'text', required: true },
  phone: { type: 'text', required: false },
  amount: { type: 'number', required: true },
  transfer_date: { type: 'date', required: false },
  kandee_message: { type: 'textarea', required: false },
  bst_message: { type: 'textarea', required: false },
} as const;

const systemKeys = Object.keys(systemDefinitions);

const lockedKeys = new Set(['display_id', 'amount']);

const privateKeys = new Set([
  'phone',
  'email',
  'bst_message',
]);

const reservedKeys = new Set([
  ...systemKeys,
  'email',
  'bills',
  'project_id',
  'user_id',
  'donation_id',
  'status',
]);

// Cấu hình mặc định, tự tạo khi bảng chưa có dòng nào.
const defaultFields = [
  { key: 'display_id', label: 'ID HIỂN THỊ', type: 'text', visible: true, public: true, required: true, deleted: false, system: true },
  { key: 'phone', label: 'SỐ ĐIỆN THOẠI', type: 'text', visible: true, public: false, required: false, deleted: false, system: true },
  { key: 'amount', label: 'SỐ TIỀN DONATE', type: 'number', visible: true, public: true, required: true, deleted: false, system: true },
  { key: 'transfer_date', label: 'NGÀY CHUYỂN KHOẢN', type: 'date', visible: true, public: false, required: false, deleted: false, system: true },
  { key: 'kandee_message', label: 'LỜI NHẮN CHO CÁC BẠN KANDEE', type: 'textarea', visible: true, public: false, required: false, deleted: false, system: true },
  { key: 'bst_message', label: 'LỜI NHẮN DÀNH CHO BINGSU TEAM', type: 'textarea', visible: true, public: false, required: false, deleted: false, system: true },
];

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum([
    'text',
    'textarea',
    'number',
    'date',
  ]),
  visible: z.boolean(),
  public: z.boolean(),
  required: z.boolean(),
  deleted: z.boolean(),
  system: z.boolean(),
}).strict();

const settingsSchema = z.object({
  max_bills: z.number().int().min(1).max(20),
  fields: z.array(fieldSchema).min(6).max(60),
}).strict().superRefine((settings, ctx) => {
  const keys = new Set<string>();

  function issue(
    index: number,
    property: string,
    message: string
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['fields', index, property],
      message,
    });
  }

  settings.fields.forEach((field, index) => {
    if (keys.has(field.key)) {
      issue(index, 'key', 'Mã trường bị trùng.');
    }

    keys.add(field.key);

    const isSystem = systemKeys.includes(field.key);

    if (isSystem !== field.system) {
      issue(
        index,
        'system',
        'Không được thay đổi định danh trường hệ thống.'
      );
    }

    if (isSystem) {
      const definition =
        systemDefinitions[
          field.key as keyof typeof systemDefinitions
        ];

      if (field.type !== definition.type) {
        issue(
          index,
          'type',
          'Không được thay đổi kiểu trường hệ thống.'
        );
      }
    } else {
      if (!field.key.startsWith('custom_')) {
        issue(
          index,
          'key',
          'Trường tùy chỉnh phải có tiền tố custom_.'
        );
      }

      if (reservedKeys.has(field.key)) {
        issue(
          index,
          'key',
          'Mã trường đã được hệ thống sử dụng.'
        );
      }
    }

    if (lockedKeys.has(field.key)) {
      if (
        !field.visible ||
        !field.required ||
        field.deleted
      ) {
        issue(
          index,
          'required',
          'ID hiển thị và số tiền phải luôn hoạt động.'
        );
      }

      if (!field.public) {
        issue(
          index,
          'public',
          'ID hiển thị và số tiền phải được công khai.'
        );
      }
    }

    if (privateKeys.has(field.key) && field.public) {
      issue(
        index,
        'public',
        'Không được công khai thông tin riêng tư.'
      );
    }

    if (field.required && (!field.visible || field.deleted)) {
      issue(
        index,
        'required',
        'Trường bắt buộc phải được hiển thị.'
      );
    }

    if (field.deleted) {
      if (field.visible || field.public || field.required) {
        issue(
          index,
          'deleted',
          'Trường đã xóa phải tắt hiển thị, công khai và bắt buộc.'
        );
      }
    }

    if (!field.visible && field.public) {
      issue(
        index,
        'public',
        'Trường bị ẩn không được công khai.'
      );
    }
  });

  for (const key of systemKeys) {
    if (!keys.has(key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields'],
        message: `Thiếu trường hệ thống: ${key}.`,
      });
    }
  }
});

async function authorize() {
  const access = await requireAdminAccess();

  if (!access.ok) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: access.error },
        { status: access.status }
      ),
    };
  }

  return {
    ok: true as const,
    userId: access.userId,
  };
}

export async function GET() {
  const auth = await authorize();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, user } = await requireUser();

  if (!user || user.id !== auth.userId) {
    return NextResponse.json(
      { error: 'Phiên đăng nhập Admin không hợp lệ.' },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('bst_donate_field_settings')
    .select('max_bills,fields,updated_at')
    .eq('id', true)
    .maybeSingle();

  if (error) {
    console.error('[donate-fields] GET lỗi:', error.code, error.message);
    return NextResponse.json(
      { error: 'Không đọc được cấu hình Donate.', code: error.code ?? null },
      { status: 500 }
    );
  }

  if (!data) {
    // Chưa có dòng cấu hình: tạo bản mặc định (chỉ admin ghi được nhờ RLS).
    const { data: created, error: createError } = await supabase
      .from('bst_donate_field_settings')
      .insert({
        id: true,
        max_bills: 3,
        fields: defaultFields,
        updated_by: auth.userId,
      })
      .select('max_bills,fields,updated_at')
      .single();

    if (createError || !created) {
      console.error(
        '[donate-fields] GET tạo cấu hình mặc định lỗi:',
        createError?.code,
        createError?.message
      );

      // Nếu có request khác vừa tạo xong thì đọc lại.
      if (createError?.code === '23505') {
        const { data: again } = await supabase
          .from('bst_donate_field_settings')
          .select('max_bills,fields,updated_at')
          .eq('id', true)
          .maybeSingle();

        if (again) {
          return NextResponse.json(
            { settings: again },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Chưa khởi tạo cấu hình Donate.',
          code: createError?.code ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { settings: created },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { settings: data },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function PUT(req: Request) {
  const auth = await authorize();

  if (!auth.ok) {
    return auth.response;
  }

  const { supabase, user } = await requireUser();

  if (!user || user.id !== auth.userId) {
    return NextResponse.json(
      { error: 'Phiên đăng nhập Admin không hợp lệ.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Cấu hình Donate không hợp lệ.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  // Không cho phép tự ý đổi định danh, kiểu hoặc
  // quyền công khai mặc định của trường hệ thống.
  const { data: current, error: readError } = await supabase
    .from('bst_donate_field_settings')
    .select('fields')
    .eq('id', true)
    .maybeSingle();

  if (readError || !current) {
    console.error('[donate-fields] PUT đọc cấu hình hiện tại lỗi:', readError?.code, readError?.message);
    return NextResponse.json(
      { error: 'Không đọc được cấu hình hiện tại.' },
      { status: 500 }
    );
  }

  const currentFields = fieldSchema.array().safeParse(
    current.fields
  );

  if (!currentFields.success) {
    return NextResponse.json(
      { error: 'Cấu hình hiện tại không hợp lệ.' },
      { status: 409 }
    );
  }

  for (const key of systemKeys) {
    const before = currentFields.data.find(
      field => field.key === key
    );

    const after = parsed.data.fields.find(
      field => field.key === key
    );

    if (!before || !after) {
      return NextResponse.json(
        { error: `Thiếu trường hệ thống ${key}.` },
        { status: 409 }
      );
    }

    if (
      before.label !== after.label ||
      before.type !== after.type ||
      before.system !== after.system
    ) {
      return NextResponse.json(
        {
          error:
            `Không được thay đổi định danh hoặc nhãn ` +
            `trường hệ thống ${key}.`,
        },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from('bst_donate_field_settings')
    .update({
      max_bills: parsed.data.max_bills,
      fields: parsed.data.fields,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq('id', true)
    .select('max_bills,fields,updated_at')
    .single();

  if (error || !data) {
    console.error('[donate-fields] PUT lỗi:', error?.code, error?.message);
    return NextResponse.json(
      { error: 'Không lưu được cấu hình Donate.', code: error?.code ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, settings: data },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}