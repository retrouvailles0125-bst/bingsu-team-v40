import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Method = {
  id: string;
  kind: 'qr_image' | 'bank_account';
  label: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_image_url: string;
  is_active: boolean;
};

const SELECT_METHOD =
  'id,kind,label,bank_name,account_name,account_number,qr_image_url,is_active';

const SELECT_LEGACY =
  'bank_name,account_name,account_number,qr_image_url,instructions';

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET() {
  try {
    const db = await supabaseServer();

    const [newResult, legacyResult] = await Promise.all([
      db.from('bst_donation_payment_methods')
        .select(SELECT_METHOD)
        .order('created_at', { ascending: true }),
      db.from('bst_donation_bank_settings')
        .select(SELECT_LEGACY)
        .eq('id', true)
        .maybeSingle(),
    ]);

    if (legacyResult.error) {
      return reply(
        { error: 'Không tải được thông tin chuyển khoản.' },
        503
      );
    }

    const legacy = legacyResult.data ?? null;

    // Before the new migration is applied, retain legacy behavior.
    if (newResult.error) {
      // 42P01: PostgreSQL undefined_table.
      // PGRST205: PostgREST schema cache cannot find the table.
      const missingTable = ['42P01', 'PGRST205'].includes(
        newResult.error.code ?? ''
      );

      if (missingTable) {
        return reply({ settings: legacy, methods: [] });
      }

      console.error(
        '[donations/bank-settings] Payment methods query failed:',
        newResult.error.code
      );

      return reply(
        { error: 'Không tải được danh sách phương thức nhận Donate.' },
        503
      );
    }

    const methods = (newResult.data ?? []) as Method[];
    const active = methods.find(m => m.is_active) ?? null;

    if (active) {
      return reply({
        methods,
        settings: {
          bank_name: active.kind === 'bank_account'
            ? active.bank_name : '',
          account_name: active.kind === 'bank_account'
            ? active.account_name : '',
          account_number: active.kind === 'bank_account'
            ? active.account_number : '',
          qr_image_url: active.kind === 'qr_image'
            ? active.qr_image_url : '',
          instructions: legacy?.instructions ?? '',
        },
      });
    }

    return reply({
      methods,
      settings: methods.length === 0 ? legacy : null,
    });
  } catch {
    return reply(
      { error: 'Không thể tải thông tin chuyển khoản.' },
      503
    );
  }
}
