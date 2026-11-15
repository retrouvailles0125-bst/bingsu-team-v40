import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase';
import { requireAdminAccess } from '@/lib/admin-security';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile.block'), target: z.string().uuid(), blocked: z.boolean(), message: z.string().max(500).default('') }).strict(),
  z.object({ action: z.literal('gift_type.update'), target: z.string().uuid(), normal_weight: z.number().int().min(0).max(1000000), gold_weight: z.number().int().min(0).max(1000000), stock_total: z.number().int().min(0).max(1000000), active: z.boolean() }).strict(),
  z.object({ action: z.literal('community_post.hide'), target: z.string().uuid(), hidden: z.boolean() }).strict(),
  z.object({ action: z.literal('community_reply.hide'), target: z.string().uuid(), hidden: z.boolean() }).strict(),
  z.object({ action: z.literal('love_message.hide'), target: z.string().uuid(), hidden: z.boolean() }).strict(),
]);
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({error:'Chưa đăng nhập'}, {status:401});
  const access = await requireAdminAccess();
  if (!access.ok) return NextResponse.json({error:access.error}, {status:access.status});
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:'Dữ liệu không hợp lệ'}, {status:400});
  const {action,target,...payload} = parsed.data;
  const {data,error} = await supabase.rpc('bst_admin_manage',{p_action:action,p_target:target,p_payload:payload});
  if (error) return NextResponse.json({error:error.message}, {status:403});
  return NextResponse.json({ok:true,result:data});
}
