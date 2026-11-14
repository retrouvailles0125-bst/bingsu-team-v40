-- V40 trade transactions and Trang Phap role. Apply after 002.
-- This migration never drops existing data.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user','admin','trang'));
drop policy if exists love_read on public.love_messages;
create policy love_read on public.love_messages for select to authenticated using (
 (not hidden and not is_private) or author_id=(select auth.uid()) or public.is_admin() or
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='trang' and not p.blocked)
);
-- Restrict direct writes; only transactional RPCs may modify trade state.
revoke all on public.trade_listings, public.trade_listing_items, public.trade_offers, public.trade_offer_items from anon,authenticated;
grant select on public.trade_listings, public.trade_listing_items, public.trade_offers, public.trade_offer_items to authenticated;
create policy trade_listings_read on public.trade_listings for select to authenticated using(true);
create policy trade_listing_items_read on public.trade_listing_items for select to authenticated using(true);
create policy trade_offers_read on public.trade_offers for select to authenticated using(
 offered_by=(select auth.uid()) or exists(select 1 from public.trade_listings l where l.id=listing_id and l.owner_id=(select auth.uid())) or public.is_admin());
create policy trade_offer_items_read on public.trade_offer_items for select to authenticated using(
 exists(select 1 from public.trade_offers o join public.trade_listings l on l.id=o.listing_id
 where o.id=offer_id and (o.offered_by=(select auth.uid()) or l.owner_id=(select auth.uid()) or public.is_admin())));
create table if not exists public.trade_comments (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.trade_listings(id) on delete cascade,
 author_id uuid not null references public.profiles(id), body text not null check(length(body) between 1 and 2000),
 created_at timestamptz not null default now());
alter table public.trade_comments enable row level security;
create policy trade_comments_read on public.trade_comments for select to authenticated using(true);
create policy trade_comments_insert on public.trade_comments for insert to authenticated
 with check(author_id=(select auth.uid()) and public.active_user());
grant select,insert on public.trade_comments to authenticated;
create or replace function public.trade_create(items uuid[], description text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); lid uuid; n int;
begin
 if uid is null or not public.active_user() then raise exception 'Not authorized'; end if;
 if coalesce(array_length(items,1),0) not between 1 and 20 or length(coalesce(description,''))>3000 then raise exception 'Invalid listing'; end if;
 if (select count(distinct x) from unnest(items) x)<>array_length(items,1) then raise exception 'Duplicate gifts'; end if;
 perform pg_advisory_xact_lock(734813);
 select count(*) into n from public.gift_items where id=any(items) and owner_id=uid;
 if n<>array_length(items,1) then raise exception 'Gift ownership mismatch'; end if;
 if exists(select 1 from public.trade_listing_items li join public.trade_listings l on l.id=li.listing_id where li.gift_item_id=any(items) and l.status='open') then raise exception 'Gift already listed'; end if;
 insert into public.trade_listings(owner_id,wanted_description) values(uid,coalesce(description,'')) returning id into lid;
 insert into public.trade_listing_items(listing_id,gift_item_id) select lid,unnest(items);
 return lid;
end $$;
create or replace function public.trade_offer(listing uuid, items uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); l public.trade_listings%rowtype; oid uuid; n int;
begin
 if uid is null or not public.active_user() then raise exception 'Not authorized'; end if;
 if coalesce(array_length(items,1),0) not between 1 and 20 then raise exception 'Invalid offer'; end if;
 if (select count(distinct x) from unnest(items) x)<>array_length(items,1) then raise exception 'Duplicate gifts'; end if;
 perform pg_advisory_xact_lock(734813);
 select * into l from public.trade_listings where id=listing for update;
 if not found or l.status<>'open' or l.owner_id=uid then raise exception 'Listing not available'; end if;
 select count(*) into n from public.gift_items where id=any(items) and owner_id=uid;
 if n<>array_length(items,1) then raise exception 'Gift ownership mismatch'; end if;
 insert into public.trade_offers(listing_id,offered_by) values(listing,uid) returning id into oid;
 insert into public.trade_offer_items(offer_id,gift_item_id) select oid,unnest(items);
 return oid;
end $$;
create or replace function public.trade_decide(offer uuid, accept boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.trade_offers%rowtype; l public.trade_listings%rowtype; n int; needed int;
begin
 if uid is null or not public.active_user() then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(734813);
 select * into o from public.trade_offers where id=offer for update;
 if not found or o.status<>'pending' then raise exception 'Offer not pending'; end if;
 select * into l from public.trade_listings where id=o.listing_id for update;
 if l.owner_id<>uid or l.status<>'open' then raise exception 'Not authorized or listing closed'; end if;
 if not accept then update public.trade_offers set status='rejected' where id=offer;return offer;end if;
 select count(*) into needed from public.trade_listing_items where listing_id=l.id;
 select count(*) into n from public.trade_listing_items li join public.gift_items i on i.id=li.gift_item_id where li.listing_id=l.id and i.owner_id=l.owner_id;
 if n<>needed or needed=0 then raise exception 'Listed gifts no longer owned'; end if;
 select count(*) into needed from public.trade_offer_items where offer_id=offer;
 select count(*) into n from public.trade_offer_items oi join public.gift_items i on i.id=oi.gift_item_id where oi.offer_id=offer and i.owner_id=o.offered_by;
 if n<>needed or needed=0 then raise exception 'Offered gifts no longer owned'; end if;
 update public.gift_items set owner_id=o.offered_by,source='trade' where id in(select gift_item_id from public.trade_listing_items where listing_id=l.id);
 insert into public.gift_movements(gift_item_id,from_user,to_user,reason,related_id)
 select gift_item_id,l.owner_id,o.offered_by,'trade',offer from public.trade_listing_items where listing_id=l.id;
 update public.gift_items set owner_id=l.owner_id,source='trade' where id in(select gift_item_id from public.trade_offer_items where offer_id=offer);
 insert into public.gift_movements(gift_item_id,from_user,to_user,reason,related_id)
 select gift_item_id,o.offered_by,l.owner_id,'trade',offer from public.trade_offer_items where offer_id=offer;
 update public.trade_offers set status='accepted' where id=offer;
 update public.trade_offers set status='rejected' where listing_id=l.id and id<>offer and status='pending';
 update public.trade_listings set status='completed' where id=l.id;
 insert into public.audit_events(actor_id,action,target_id,details) values(uid,'trade.accept',offer,jsonb_build_object('listing',l.id,'offerer',o.offered_by));
 return offer;
end $$;
create or replace function public.trade_cancel(listing uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.active_user() then raise exception 'Not authorized';end if;
 perform pg_advisory_xact_lock(734813);
 update public.trade_listings set status='cancelled' where id=listing and owner_id=auth.uid() and status='open';
 if not found then raise exception 'Cannot cancel listing';end if;
 update public.trade_offers set status='rejected' where listing_id=listing and status='pending';
 return listing;
end $$;
revoke all on function public.trade_create(uuid[],text),public.trade_offer(uuid,uuid[]),public.trade_decide(uuid,boolean),public.trade_cancel(uuid) from public,anon;
grant execute on function public.trade_create(uuid[],text),public.trade_offer(uuid,uuid[]),public.trade_decide(uuid,boolean),public.trade_cancel(uuid) to authenticated;
