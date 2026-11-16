
-- BST V40 - Trade Pledge Guards V2
-- One gift may participate in only one active pledge.
-- Updates trade_create, trade_offer, trade_decide.
-- Does not delete existing data.
-- Does not replace trade_cancel.

begin;

-- =====================================================
-- 1. CREATE LISTING
-- =====================================================

create or replace function public.trade_create(
  items uuid[],
  description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  lid uuid;
  n integer;
  item_count integer;
begin
  if uid is null or not public.active_user() then
    raise exception 'Not authorized';
  end if;

  item_count := coalesce(array_length(items, 1), 0);

  if item_count not between 1 and 20
     or length(coalesce(description, '')) > 3000 then
    raise exception 'Invalid listing';
  end if;

  if exists (
    select 1
    from unnest(items) as x(id)
    where x.id is null
  ) then
    raise exception 'Invalid gift ID';
  end if;

  if (
    select count(distinct x.id)
    from unnest(items) as x(id)
  ) <> item_count then
    raise exception 'Duplicate gifts';
  end if;

  perform pg_advisory_xact_lock(734813);

  select count(*)
  into n
  from public.gift_items
  where id = any(items)
    and owner_id = uid;

  if n <> item_count then
    raise exception 'Gift ownership mismatch';
  end if;

  -- Gift already pledged to an open listing.
  if exists (
    select 1
    from public.trade_listing_items li
    join public.trade_listings l
      on l.id = li.listing_id
    where li.gift_item_id = any(items)
      and l.status = 'open'
  ) then
    raise exception 'Gift already listed';
  end if;

  -- Gift already pledged to a pending offer
  -- on an open listing.
  if exists (
    select 1
    from public.trade_offer_items oi
    join public.trade_offers o
      on o.id = oi.offer_id
    join public.trade_listings l
      on l.id = o.listing_id
    where oi.gift_item_id = any(items)
      and o.status = 'pending'
      and l.status = 'open'
  ) then
    raise exception 'Gift already reserved in an offer';
  end if;

  insert into public.trade_listings (
    owner_id,
    wanted_description
  )
  values (
    uid,
    coalesce(description, '')
  )
  returning id into lid;

  insert into public.trade_listing_items (
    listing_id,
    gift_item_id
  )
  select lid, x.id
  from unnest(items) as x(id);

  return lid;
end;
$$;


-- =====================================================
-- 2. CREATE OFFER
-- =====================================================

create or replace function public.trade_offer(
  listing uuid,
  items uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  l public.trade_listings%rowtype;
  oid uuid;
  n integer;
  item_count integer;
begin
  if uid is null or not public.active_user() then
    raise exception 'Not authorized';
  end if;

  item_count := coalesce(array_length(items, 1), 0);

  if item_count not between 1 and 20 then
    raise exception 'Invalid offer';
  end if;

  if exists (
    select 1
    from unnest(items) as x(id)
    where x.id is null
  ) then
    raise exception 'Invalid gift ID';
  end if;

  if (
    select count(distinct x.id)
    from unnest(items) as x(id)
  ) <> item_count then
    raise exception 'Duplicate gifts';
  end if;

  perform pg_advisory_xact_lock(734813);

  select *
  into l
  from public.trade_listings
  where id = listing
  for update;

  if not found
     or l.status <> 'open'
     or l.owner_id = uid then
    raise exception 'Listing not available';
  end if;

  select count(*)
  into n
  from public.gift_items
  where id = any(items)
    and owner_id = uid;

  if n <> item_count then
    raise exception 'Gift ownership mismatch';
  end if;

  -- Offered gifts must not be in any open listing.
  if exists (
    select 1
    from public.trade_listing_items li
    join public.trade_listings tl
      on tl.id = li.listing_id
    where li.gift_item_id = any(items)
      and tl.status = 'open'
  ) then
    raise exception 'Gift already listed';
  end if;

  -- Offered gifts must not be in another
  -- pending offer on an open listing.
  if exists (
    select 1
    from public.trade_offer_items oi
    join public.trade_offers o
      on o.id = oi.offer_id
    join public.trade_listings tl
      on tl.id = o.listing_id
    where oi.gift_item_id = any(items)
      and o.status = 'pending'
      and tl.status = 'open'
  ) then
    raise exception 'Gift already reserved in an offer';
  end if;

  insert into public.trade_offers (
    listing_id,
    offered_by
  )
  values (
    listing,
    uid
  )
  returning id into oid;

  insert into public.trade_offer_items (
    offer_id,
    gift_item_id
  )
  select oid, x.id
  from unnest(items) as x(id);

  return oid;
end;
$$;


-- =====================================================
-- 3. DECIDE OFFER
-- =====================================================

create or replace function public.trade_decide(
  offer uuid,
  accept boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o public.trade_offers%rowtype;
  l public.trade_listings%rowtype;
  n integer;
  needed integer;
begin
  if uid is null or not public.active_user() then
    raise exception 'Not authorized';
  end if;

  if accept is null then
    raise exception 'Invalid decision';
  end if;

  perform pg_advisory_xact_lock(734813);

  select *
  into o
  from public.trade_offers
  where id = offer
  for update;

  if not found or o.status <> 'pending' then
    raise exception 'Offer not pending';
  end if;

  select *
  into l
  from public.trade_listings
  where id = o.listing_id
  for update;

  if not found
     or l.owner_id <> uid
     or l.status <> 'open' then
    raise exception 'Not authorized or listing closed';
  end if;

  -- Reject: no ownership changes.
  if not accept then
    update public.trade_offers
    set status = 'rejected'
    where id = offer;

    return offer;
  end if;

  -- Verify all listed gifts still belong
  -- to the listing owner.
  select count(*)
  into needed
  from public.trade_listing_items
  where listing_id = l.id;

  if needed = 0 then
    raise exception 'Listing has no gifts';
  end if;

  select count(*)
  into n
  from public.trade_listing_items li
  join public.gift_items gi
    on gi.id = li.gift_item_id
  where li.listing_id = l.id
    and gi.owner_id = l.owner_id;

  if n <> needed then
    raise exception 'Listed gifts no longer owned';
  end if;

  -- Verify all offered gifts still belong
  -- to the offer sender.
  select count(*)
  into needed
  from public.trade_offer_items
  where offer_id = offer;

  if needed = 0 then
    raise exception 'Offer has no gifts';
  end if;

  select count(*)
  into n
  from public.trade_offer_items oi
  join public.gift_items gi
    on gi.id = oi.gift_item_id
  where oi.offer_id = offer
    and gi.owner_id = o.offered_by;

  if n <> needed then
    raise exception 'Offered gifts no longer owned';
  end if;

  -- Listed gifts must not be pledged
  -- to another open listing.
  if exists (
    select 1
    from public.trade_listing_items current_li
    join public.trade_listing_items other_li
      on other_li.gift_item_id =
         current_li.gift_item_id
    join public.trade_listings other_l
      on other_l.id = other_li.listing_id
    where current_li.listing_id = l.id
      and other_li.listing_id <> l.id
      and other_l.status = 'open'
  ) then
    raise exception 'Listed gift has another active listing';
  end if;

  -- Listed gifts must not be pledged
  -- to a pending offer on an open listing.
  if exists (
    select 1
    from public.trade_listing_items li
    join public.trade_offer_items oi
      on oi.gift_item_id = li.gift_item_id
    join public.trade_offers other_o
      on other_o.id = oi.offer_id
    join public.trade_listings other_l
      on other_l.id = other_o.listing_id
    where li.listing_id = l.id
      and other_o.status = 'pending'
      and other_l.status = 'open'
  ) then
    raise exception 'Listed gift has another active pledge';
  end if;

  -- Offered gifts must not be pledged
  -- to any open listing.
  if exists (
    select 1
    from public.trade_offer_items oi
    join public.trade_listing_items li
      on li.gift_item_id = oi.gift_item_id
    join public.trade_listings other_l
      on other_l.id = li.listing_id
    where oi.offer_id = offer
      and other_l.status = 'open'
  ) then
    raise exception 'Offered gift has an active listing';
  end if;

  -- Offered gifts must not be pledged
  -- to another pending offer on an open listing.
  if exists (
    select 1
    from public.trade_offer_items current_oi
    join public.trade_offer_items other_oi
      on other_oi.gift_item_id =
         current_oi.gift_item_id
    join public.trade_offers other_o
      on other_o.id = other_oi.offer_id
    join public.trade_listings other_l
      on other_l.id = other_o.listing_id
    where current_oi.offer_id = offer
      and other_oi.offer_id <> offer
      and other_o.status = 'pending'
      and other_l.status = 'open'
  ) then
    raise exception 'Offered gift has another active pledge';
  end if;

  -- Transfer listed gifts to offer sender.
  update public.gift_items
  set
    owner_id = o.offered_by,
    source = 'trade'
  where id in (
    select gift_item_id
    from public.trade_listing_items
    where listing_id = l.id
  );

  insert into public.gift_movements (
    gift_item_id,
    from_user,
    to_user,
    reason,
    related_id
  )
  select
    gift_item_id,
    l.owner_id,
    o.offered_by,
    'trade',
    offer
  from public.trade_listing_items
  where listing_id = l.id;

  -- Transfer offered gifts to listing owner.
  update public.gift_items
  set
    owner_id = l.owner_id,
    source = 'trade'
  where id in (
    select gift_item_id
    from public.trade_offer_items
    where offer_id = offer
  );

  insert into public.gift_movements (
    gift_item_id,
    from_user,
    to_user,
    reason,
    related_id
  )
  select
    gift_item_id,
    o.offered_by,
    l.owner_id,
    'trade',
    offer
  from public.trade_offer_items
  where offer_id = offer;

  update public.trade_offers
  set status = 'accepted'
  where id = offer;

  update public.trade_offers
  set status = 'rejected'
  where listing_id = l.id
    and id <> offer
    and status = 'pending';

  update public.trade_listings
  set status = 'completed'
  where id = l.id;

  insert into public.audit_events (
    actor_id,
    action,
    target_id,
    details
  )
  values (
    uid,
    'trade.accept',
    offer,
    jsonb_build_object(
      'listing', l.id,
      'offerer', o.offered_by
    )
  );

  return offer;
end;
$$;

-- Restore explicit execution permissions.
revoke all on function public.trade_create(uuid[], text)
  from public, anon, authenticated;

revoke all on function public.trade_offer(uuid, uuid[])
  from public, anon, authenticated;

revoke all on function public.trade_decide(uuid, boolean)
  from public, anon, authenticated;

grant execute on function public.trade_create(uuid[], text)
  to authenticated;

grant execute on function public.trade_offer(uuid, uuid[])
  to authenticated;

grant execute on function public.trade_decide(uuid, boolean)
  to authenticated;

commit;
