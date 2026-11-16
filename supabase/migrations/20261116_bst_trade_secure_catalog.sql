-- BST V40: Privacy-preserving Trade Catalog
-- This migration only adds read-only RPC functions.

create or replace function public.trade_public_listing_catalog()
returns table (
  listing_id uuid,
  gift_item_id uuid,
  gift_name text,
  gift_rarity text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    li.listing_id,
    li.gift_item_id,
    gt.name,
    gt.rarity
  from public.trade_listing_items li
  join public.trade_listings l
    on l.id = li.listing_id
  join public.gift_items gi
    on gi.id = li.gift_item_id
  join public.gift_types gt
    on gt.id = gi.gift_type_id
  where (select auth.uid()) is not null
    and l.status in ('open', 'completed')
  order by l.created_at desc, li.gift_item_id
  limit 400;
$$;

create or replace function public.trade_visible_offer_catalog()
returns table (
  offer_id uuid,
  gift_item_id uuid,
  gift_name text,
  gift_rarity text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    oi.offer_id,
    oi.gift_item_id,
    gt.name,
    gt.rarity
  from public.trade_offer_items oi
  join public.trade_offers o
    on o.id = oi.offer_id
  join public.trade_listings l
    on l.id = o.listing_id
  join public.gift_items gi
    on gi.id = oi.gift_item_id
  join public.gift_types gt
    on gt.id = gi.gift_type_id
  where (select auth.uid()) is not null
    and (
      o.offered_by = (select auth.uid())
      or l.owner_id = (select auth.uid())
      or public.is_admin()
    )
  order by o.created_at desc, oi.gift_item_id
  limit 400;
$$;

revoke all on function public.trade_public_listing_catalog()
  from public, anon, authenticated;

revoke all on function public.trade_visible_offer_catalog()
  from public, anon, authenticated;

grant execute on function public.trade_public_listing_catalog()
  to authenticated;

grant execute on function public.trade_visible_offer_catalog()
  to authenticated;
