
-- ============================================================
-- BINGSU TEAM V40.4
-- Donate Verification & Gacha Ticket Allocation
-- Apply AFTER 001_core.sql, 002_v40_private_bills.sql,
-- and 003_trade_and_trang.sql.
--
-- Workflow:
-- 1. Admin starts verification -> processing
-- 2. Admin may cancel before verification_ready_at
-- 3. Admin finalizes after waiting -> verified
-- 4. Kandee allocates tickets once -> wallet credited
--
-- Existing verified donations are treated as allocated.
-- ============================================================

-- 1. Configurable exchange rates and verification delay

create table if not exists public.gacha_exchange_settings (
  id boolean primary key default true check (id),
  normal_rate bigint not null default 100000
    check (normal_rate > 0),
  gold_rate bigint not null default 400000
    check (gold_rate > 0),
  verify_wait_seconds integer not null default 60
    check (verify_wait_seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.gacha_exchange_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.gacha_exchange_settings
  enable row level security;

revoke all on public.gacha_exchange_settings
from public, anon, authenticated;

grant select on public.gacha_exchange_settings
to authenticated;

drop policy if exists gacha_settings_read
on public.gacha_exchange_settings;

create policy gacha_settings_read
on public.gacha_exchange_settings
for select to authenticated
using (public.active_user());


-- 2. Additional donation verification/allocation columns

alter table public.donations
  add column if not exists verification_ready_at timestamptz,
  add column if not exists normal_rate_snapshot bigint,
  add column if not exists gold_rate_snapshot bigint,
  add column if not exists allocation_completed_at timestamptz,
  add column if not exists allocation_choice text;

-- Protect existing verified donations from being allocated twice.

update public.donations
set
  allocation_completed_at = coalesce(
    allocation_completed_at,
    verified_at,
    created_at
  ),
  allocation_choice = coalesce(
    allocation_choice,
    'legacy'
  )
where status = 'verified'
  and allocation_completed_at is null;

-- Enforce supported allocation choices.

alter table public.donations
  drop constraint if exists donations_allocation_choice_check;

alter table public.donations
  add constraint donations_allocation_choice_check
  check (
    allocation_choice is null
    or allocation_choice in ('normal', 'gold_max', 'legacy')
  );


-- 3. Admin updates exchange settings

create or replace function public.admin_set_gacha_exchange_settings(
  p_normal_rate bigint,
  p_gold_rate bigint,
  p_verify_wait_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_normal_rate is null
    or p_normal_rate <= 0
    or p_gold_rate is null
    or p_gold_rate <= 0
    or p_verify_wait_seconds is null
    or p_verify_wait_seconds not between 0 and 86400
  then
    raise exception 'Invalid settings';
  end if;

  update public.gacha_exchange_settings
  set
    normal_rate = p_normal_rate,
    gold_rate = p_gold_rate,
    verify_wait_seconds = p_verify_wait_seconds,
    updated_at = now(),
    updated_by = auth.uid()
  where id = true;

  if not found then
    raise exception 'Gacha settings missing';
  end if;

  insert into public.audit_events (
    actor_id,
    action,
    details
  )
  values (
    auth.uid(),
    'gacha.settings.update',
    jsonb_build_object(
      'normal_rate', p_normal_rate,
      'gold_rate', p_gold_rate,
      'wait_seconds', p_verify_wait_seconds
    )
  );
end;
$$;


-- 4. Admin starts donation verification
-- No tickets are credited at this stage.

create or replace function public.start_donation_verification(
  p_donation_id uuid,
  p_received_amount bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.donations%rowtype;
  cfg public.gacha_exchange_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_received_amount is null
    or p_received_amount < 0
    or p_received_amount > 1000000000
  then
    raise exception 'Invalid amount';
  end if;

  select *
  into d
  from public.donations
  where id = p_donation_id
  for update;

  if not found or d.status <> 'pending' then
    raise exception 'Donation not pending';
  end if;

  select *
  into cfg
  from public.gacha_exchange_settings
  where id = true;

  if not found then
    raise exception 'Gacha settings missing';
  end if;

  update public.donations
  set
    status = 'processing',
    received_amount = p_received_amount,
    verified_by = auth.uid(),
    verified_at = null,
    verification_ready_at =
      now() + make_interval(secs => cfg.verify_wait_seconds),
    normal_rate_snapshot = cfg.normal_rate,
    gold_rate_snapshot = cfg.gold_rate
  where id = p_donation_id;

  insert into public.audit_events (
    actor_id,
    action,
    target_id,
    details
  )
  values (
    auth.uid(),
    'donation.verification.started',
    p_donation_id,
    jsonb_build_object(
      'received_amount', p_received_amount,
      'normal_rate', cfg.normal_rate,
      'gold_rate', cfg.gold_rate,
      'wait_seconds', cfg.verify_wait_seconds
    )
  );

  return p_donation_id;
end;
$$;


-- 5. Admin cancels verification during waiting period

create or replace function public.admin_cancel_donation_verification(
  p_donation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.donations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select *
  into d
  from public.donations
  where id = p_donation_id
  for update;

  if not found
    or d.status <> 'processing'
    or d.verification_ready_at is null
    or d.verification_ready_at <= now()
  then
    raise exception 'Verification cannot be cancelled';
  end if;

  update public.donations
  set
    status = 'pending',
    received_amount = null,
    verified_by = null,
    verified_at = null,
    verification_ready_at = null,
    normal_rate_snapshot = null,
    gold_rate_snapshot = null
  where id = p_donation_id;

  insert into public.audit_events (
    actor_id,
    action,
    target_id
  )
  values (
    auth.uid(),
    'donation.verification.cancelled',
    p_donation_id
  );

  return p_donation_id;
end;
$$;


-- 6. Admin finalizes verification after waiting period
-- Kandee cannot call this function successfully.
-- No tickets are credited here.

create or replace function public.finalize_donation_verification(
  p_donation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.donations%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select *
  into d
  from public.donations
  where id = p_donation_id
  for update;

  if not found then
    raise exception 'Donation not found';
  end if;

  if d.status = 'verified' then
    return d.id;
  end if;

  if d.status <> 'processing'
    or d.verification_ready_at is null
    or now() < d.verification_ready_at
  then
    raise exception 'Verification is not ready';
  end if;

  update public.donations
  set
    status = 'verified',
    verified_at = now()
  where id = p_donation_id;

  insert into public.audit_events (
    actor_id,
    action,
    target_id
  )
  values (
    auth.uid(),
    'donation.verified',
    p_donation_id
  );

  return p_donation_id;
end;
$$;


-- 7. Kandee allocates verified donation into tickets
-- 'normal': all possible normal tickets
-- 'gold_max': maximum gold tickets plus normal from remainder
-- Ticket calculation and wallet credit occur atomically.

create or replace function public.allocate_donation_tickets(
  p_donation_id uuid,
  p_choice text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.donations%rowtype;
  n bigint;
  g bigint;
  remainder bigint;
begin
  if not public.active_user() then
    raise exception 'Not authorized';
  end if;

  if p_choice is null
    or p_choice not in ('normal', 'gold_max')
  then
    raise exception 'Invalid choice';
  end if;

  select *
  into d
  from public.donations
  where id = p_donation_id
  for update;

  if not found or d.user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  if d.status <> 'verified'
    or d.allocation_completed_at is not null
  then
    raise exception 'Donation not eligible for allocation';
  end if;

  if d.received_amount is null
    or d.normal_rate_snapshot is null
    or d.gold_rate_snapshot is null
    or d.normal_rate_snapshot <= 0
    or d.gold_rate_snapshot <= 0
  then
    raise exception 'Missing exchange snapshot';
  end if;

  if p_choice = 'normal' then
    n := d.received_amount / d.normal_rate_snapshot;
    g := 0;
  else
    g := d.received_amount / d.gold_rate_snapshot;
    remainder :=
      d.received_amount - g * d.gold_rate_snapshot;
    n := remainder / d.normal_rate_snapshot;
  end if;

  if n > 100000 or g > 100000 then
    raise exception 'Too many tickets';
  end if;

  update public.donations
  set
    normal_tickets = n::integer,
    gold_tickets = g::integer,
    allocation_choice = p_choice,
    allocation_completed_at = now()
  where id = p_donation_id;

  insert into public.spin_balances (
    user_id,
    normal_available,
    gold_available
  )
  values (
    d.user_id,
    n::integer,
    g::integer
  )
  on conflict (user_id)
  do update
  set
    normal_available =
      public.spin_balances.normal_available
      + excluded.normal_available,
    gold_available =
      public.spin_balances.gold_available
      + excluded.gold_available;

  insert into public.audit_events (
    actor_id,
    action,
    target_id,
    details
  )
  values (
    auth.uid(),
    'donation.tickets.allocated',
    p_donation_id,
    jsonb_build_object(
      'choice', p_choice,
      'normal', n,
      'gold', g,
      'received_amount', d.received_amount
    )
  );

  return jsonb_build_object(
    'donation_id', p_donation_id,
    'normal_tickets', n,
    'gold_tickets', g
  );
end;
$$;


-- 8. Disable legacy RPC that accepts ticket counts

revoke execute
on function public.verify_donation(
  uuid,
  bigint,
  integer,
  integer
)
from public, anon, authenticated;


-- 9. Secure permissions for new RPCs

revoke all
on function public.admin_set_gacha_exchange_settings(
  bigint, bigint, integer
)
from public, anon, authenticated;

revoke all
on function public.start_donation_verification(
  uuid, bigint
)
from public, anon, authenticated;

revoke all
on function public.admin_cancel_donation_verification(
  uuid
)
from public, anon, authenticated;

revoke all
on function public.finalize_donation_verification(
  uuid
)
from public, anon, authenticated;

revoke all
on function public.allocate_donation_tickets(
  uuid, text
)
from public, anon, authenticated;

grant execute
on function public.admin_set_gacha_exchange_settings(
  bigint, bigint, integer
)
to authenticated;

grant execute
on function public.start_donation_verification(
  uuid, bigint
)
to authenticated;

grant execute
on function public.admin_cancel_donation_verification(
  uuid
)
to authenticated;

grant execute
on function public.finalize_donation_verification(
  uuid
)
to authenticated;

grant execute
on function public.allocate_donation_tickets(
  uuid, text
)
to authenticated;
