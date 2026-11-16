-- V40: private bills and private letters. Apply AFTER 001_core.sql.
alter table public.donations add column if not exists kandee_message text not null default '';
alter table public.donations add column if not exists bst_message text not null default '';
alter table public.love_messages add column if not exists is_private boolean not null default false;
-- Do not permit ordinary users to read private letters from other users.
drop policy if exists love_read on public.love_messages;
create policy love_read on public.love_messages for select to authenticated
 using ((not hidden and not is_private) or author_id=(select auth.uid()) or public.is_admin());
create policy love_public_read on public.love_messages for select to anon using(not hidden and not is_private);
create policy love_insert on public.love_messages for insert to authenticated
 with check(author_id=(select auth.uid()) and public.active_user() and not hidden);
grant select,insert on public.love_messages to authenticated;
grant select on public.love_messages to anon;
create table if not exists public.donation_bills (
 id uuid primary key default gen_random_uuid(),
 donation_id uuid not null references public.donations(id) on delete cascade,
 storage_path text not null unique,
 uploaded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
alter table public.donation_bills enable row level security;
create policy donation_bill_owner_read on public.donation_bills for select to authenticated
 using(uploaded_by=(select auth.uid()) or public.is_admin());
create policy donation_bill_owner_insert on public.donation_bills for insert to authenticated
 with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.donations d where d.id=donation_id and d.user_id=(select auth.uid()) and d.status='pending'));
grant select,insert on public.donation_bills to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('donation-bills','donation-bills',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
 on conflict(id) do nothing;
create policy bill_owner_upload on storage.objects for insert to authenticated
 with check(bucket_id='donation-bills' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy bill_owner_read on storage.objects for select to authenticated
 using(bucket_id='donation-bills' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.is_admin()));
-- IMPORTANT: private letters for Trang Phap require a separate, verified role in a later migration.
-- The old HTML password is NOT a security boundary and is not used here.
-- Count all visible and private letters without exposing private contents.
create or replace function public.love_message_total() returns bigint
language sql stable security definer set search_path = '' as $$
 select count(*) from public.love_messages where not hidden;
$$;
revoke all on function public.love_message_total() from public;
grant execute on function public.love_message_total() to anon,authenticated;
