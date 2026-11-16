-- BINGSU TEAM: production foundation. Run in a NEW Supabase project.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique,
 role text not null default 'user' check (role in ('user','admin')),
 blocked boolean not null default false,
 block_message text not null default '',
 created_at timestamptz not null default now()
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and not blocked)
$$;
create function public.active_user() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and not blocked)
$$;
create table public.projects (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
 is_open boolean not null default true, created_at timestamptz not null default now()
);
create table public.donations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 project_id uuid not null references public.projects(id), declared_amount bigint not null check(declared_amount>0),
 received_amount bigint check(received_amount>=0), note text not null default '',
 status text not null default 'pending' check(status in ('pending','processing','verified','rejected')),
 normal_tickets int not null default 0 check(normal_tickets>=0), gold_tickets int not null default 0 check(gold_tickets>=0),
 verified_by uuid references public.profiles(id), verified_at timestamptz, created_at timestamptz not null default now()
);
create table public.spin_balances (
 user_id uuid primary key references public.profiles(id), normal_available int not null default 0 check(normal_available>=0),
 gold_available int not null default 0 check(gold_available>=0)
);
create table public.gift_types (
 id uuid primary key default gen_random_uuid(), name text not null, rarity text not null check(rarity in ('normal','rare','ssr','secret')),
 stock_total int not null check(stock_total>=0), stock_issued int not null default 0 check(stock_issued>=0 and stock_issued<=stock_total),
 normal_weight int not null default 0 check(normal_weight>=0), gold_weight int not null default 0 check(gold_weight>=0),
 active boolean not null default true
);
create table public.gift_items (
 id uuid primary key default gen_random_uuid(), gift_type_id uuid not null references public.gift_types(id),
 owner_id uuid not null references public.profiles(id), code text not null unique,
 source text not null check(source in ('spin','trade','gift','admin')),
 created_at timestamptz not null default now()
);
create table public.spin_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 user_id uuid not null references public.profiles(id), kind text not null check(kind in ('normal','gold')),
 gift_item_id uuid not null unique references public.gift_items(id), created_at timestamptz not null default now()
);
create table public.gift_movements (
 id uuid primary key default gen_random_uuid(), gift_item_id uuid not null references public.gift_items(id),
 from_user uuid references public.profiles(id), to_user uuid not null references public.profiles(id),
 reason text not null check(reason in ('spin','trade','gift','admin')),
 related_id uuid, created_at timestamptz not null default now()
);
create table public.trade_listings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 wanted_description text not null default '', status text not null default 'open' check(status in ('open','completed','cancelled')),
 created_at timestamptz not null default now()
);
create table public.trade_listing_items (
 listing_id uuid not null references public.trade_listings(id) on delete cascade,
 gift_item_id uuid not null references public.gift_items(id), primary key(listing_id,gift_item_id)
);
create table public.trade_offers (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.trade_listings(id),
 offered_by uuid not null references public.profiles(id), status text not null default 'pending' check(status in ('pending','accepted','rejected','withdrawn')),
 created_at timestamptz not null default now()
);
create table public.trade_offer_items (
 offer_id uuid not null references public.trade_offers(id) on delete cascade,
 gift_item_id uuid not null references public.gift_items(id), primary key(offer_id,gift_item_id)
);
create table public.gift_transfers (
 id uuid primary key default gen_random_uuid(), gift_item_id uuid not null references public.gift_items(id),
 sender_id uuid not null references public.profiles(id), recipient_id uuid not null references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now()
);
create table public.community_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
 title text not null, body text not null, created_at timestamptz not null default now(), hidden boolean not null default false
);
create table public.community_replies (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id), body text not null, created_at timestamptz not null default now(), hidden boolean not null default false
);
create table public.love_messages (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
 body text not null, created_at timestamptz not null default now(), hidden boolean not null default false
);
create table public.audit_events (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
 action text not null, target_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
-- Row-level security: deny by default, add narrow explicit grants.
do $$ declare t text; begin foreach t in array array['profiles','projects','donations','spin_balances','gift_types','gift_items','spin_events','gift_movements','trade_listings','trade_listing_items','trade_offers','trade_offer_items','gift_transfers','community_posts','community_replies','love_messages','audit_events'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_self_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_admin());
create policy projects_public_read on public.projects for select to anon,authenticated using(true);
create policy donations_self_read on public.donations for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy donations_self_create on public.donations for insert to authenticated with check(user_id=(select auth.uid()) and public.active_user() and status='pending' and received_amount is null and normal_tickets=0 and gold_tickets=0 and verified_by is null);
create policy balances_self_read on public.spin_balances for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy gift_types_read on public.gift_types for select to authenticated using(true);
create policy gifts_self_read on public.gift_items for select to authenticated using(owner_id=(select auth.uid()) or public.is_admin());
create policy spin_self_read on public.spin_events for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy movements_self_read on public.gift_movements for select to authenticated using(from_user=(select auth.uid()) or to_user=(select auth.uid()) or public.is_admin());
create policy community_read on public.community_posts for select to authenticated using(not hidden or author_id=(select auth.uid()) or public.is_admin());
create policy community_reply_read on public.community_replies for select to authenticated using(not hidden or author_id=(select auth.uid()) or public.is_admin());
create policy love_read on public.love_messages for select to authenticated using(not hidden or author_id=(select auth.uid()) or public.is_admin());
create policy audit_admin_read on public.audit_events for select to authenticated using(public.is_admin());
-- Privilege restrictions: sensitive tables are read-only via API; RPC performs writes.
revoke all on public.spin_balances,public.gift_items,public.spin_events,public.gift_movements,public.gift_types,public.audit_events from anon,authenticated;
grant select on public.spin_balances,public.gift_items,public.spin_events,public.gift_movements,public.gift_types,public.audit_events to authenticated;
revoke all on public.profiles from anon,authenticated; grant select on public.profiles to authenticated;
revoke all on public.donations from anon,authenticated; grant select,insert on public.donations to authenticated;
revoke all on public.projects from anon,authenticated; grant select on public.projects to anon,authenticated;
-- Admin verification: server-side permissions, transaction, one-time operation.
create function public.verify_donation(donation_id uuid,received_amount bigint,normal_tickets int,gold_tickets int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d public.donations%rowtype; normal_rate bigint := 100000; gold_rate bigint := 400000;
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 if received_amount < 0 or normal_tickets < 0 or gold_tickets < 0 then raise exception 'Invalid amounts'; end if;
 select * into d from public.donations where id=donation_id for update;
 if not found or d.status <> 'pending' then raise exception 'Donation not pending'; end if;
 -- Policy: gold + normal cost cannot exceed verified money. Rates will become configurable in phase 2.
 if (normal_tickets::bigint*normal_rate + gold_tickets::bigint*gold_rate)>received_amount then raise exception 'Tickets exceed payment'; end if;
 update public.donations set status='verified',received_amount=verify_donation.received_amount,
 normal_tickets=verify_donation.normal_tickets,gold_tickets=verify_donation.gold_tickets,
 verified_by=auth.uid(),verified_at=now() where id=donation_id;
 insert into public.spin_balances(user_id,normal_available,gold_available) values(d.user_id,normal_tickets,gold_tickets)
 on conflict(user_id) do update set normal_available=public.spin_balances.normal_available+excluded.normal_available,
 gold_available=public.spin_balances.gold_available+excluded.gold_available;
 insert into public.audit_events(actor_id,action,target_id,details) values(auth.uid(),'donation.verify',donation_id,jsonb_build_object('received_amount',received_amount,'normal',normal_tickets,'gold',gold_tickets));
 return donation_id;
end $$;
-- Weighted draw is computed inside Postgres and stock is locked transactionally.
create function public.perform_spin(kind text,request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); b public.spin_balances%rowtype; g public.gift_types%rowtype;
 total_weight bigint; ticket bigint; gift_code text; item_id uuid; old public.spin_events%rowtype;
begin
 if uid is null or not public.active_user() then raise exception 'Not authorized'; end if;
 if kind not in ('normal','gold') then raise exception 'Invalid spin kind'; end if;
 -- Serialize all spins so stock and selection are consistent. Production optimization may use finer locks.
 perform pg_advisory_xact_lock(734812);
 select * into old from public.spin_events where spin_events.request_id=perform_spin.request_id;
 if found then
   if old.user_id<>uid or old.kind<>kind then raise exception 'Request ID already used'; end if;
   return (select jsonb_build_object('item_id',i.id,'code',i.code,'gift_type_id',i.gift_type_id) from public.gift_items i where i.id=old.gift_item_id);
 end if;
 select * into b from public.spin_balances where user_id=uid for update;
 if not found or (kind='normal' and b.normal_available<1) or (kind='gold' and b.gold_available<1) then raise exception 'Insufficient spins'; end if;
 select coalesce(sum(case when kind='normal' then normal_weight else gold_weight end),0) into total_weight
 from public.gift_types where active and stock_issued<stock_total and (case when kind='normal' then normal_weight else gold_weight end)>0;
 if total_weight<1 then raise exception 'No available gifts'; end if;
 ticket := floor(random()*total_weight)::bigint;
 select * into g from (
  select gt.*,sum(case when kind='normal' then normal_weight else gold_weight end) over(order by id) as upto
  from public.gift_types gt where active and stock_issued<stock_total and (case when kind='normal' then normal_weight else gold_weight end)>0
 ) x where x.upto>ticket order by x.upto limit 1;
 update public.gift_types set stock_issued=stock_issued+1 where id=g.id;
 update public.spin_balances set normal_available=normal_available-(case when kind='normal' then 1 else 0 end),gold_available=gold_available-(case when kind='gold' then 1 else 0 end) where user_id=uid;
 item_id:=gen_random_uuid();gift_code:='BST-'||upper(substr(replace(item_id::text,'-',''),1,12));
 insert into public.gift_items(id,gift_type_id,owner_id,code,source) values(item_id,g.id,uid,gift_code,'spin');
 insert into public.spin_events(request_id,user_id,kind,gift_item_id) values(request_id,uid,kind,item_id);
 insert into public.gift_movements(gift_item_id,to_user,reason,related_id) values(item_id,uid,'spin',request_id);
 return jsonb_build_object('item_id',item_id,'code',gift_code,'gift_type_id',g.id);
end $$;
revoke all on function public.verify_donation(uuid,bigint,int,int) from public,anon;
revoke all on function public.perform_spin(text,uuid) from public,anon;
grant execute on function public.verify_donation(uuid,bigint,int,int) to authenticated;
grant execute on function public.perform_spin(text,uuid) to authenticated;
