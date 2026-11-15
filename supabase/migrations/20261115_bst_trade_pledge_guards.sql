-- Guard against transferring gifts that are committed to other active trades.
-- Apply after 003_trade_and_trang.sql; preserves existing trade records.
create or replace function public.trade_create(items uuid[], description text) returns uuid
language plpgsql security definer set search_path='' as $
declare uid uuid:=auth.uid(); lid uuid; n int;
begin
 if uid is null or not public.active_user() then raise exception 'Not authorized'; end if;
 if coalesce(array_length(items,1),0) not between 1 and 20 or length(coalesce(description,''))>3000 then raise exception 'Invalid listing'; end if;
 if (select count(distinct x) from unnest(items) x)<>array_length(items,1) then raise exception 'Duplicate gifts'; end if;
 perform pg_advisory_xact_lock(734813);
 select count(*) into n from public.gift_items where id=any(items) and owner_id=uid;
 if n<>array_length(items,1) then raise exception 'Gift ownership mismatch'; end if;
 if exists(select 1 from public.trade_listing_items li join public.trade_listings l on l.id=li.listing_id where li.gift_item_id=any(items) and l.status='open') then raise exception 'Gift already listed'; end if;
 if exists(select 1 from public.trade_offer_items oi join public.trade_offers o on o.id=oi.offer_id join public.trade_listings l on l.id=o.listing_id where oi.gift_item_id=any(items) and o.status='pending' and l.status='open') then raise exception 'Gift already pledged to a pending offer'; end if;
 insert into public.trade_listings(owner_id,wanted_description) values(uid,coalesce(description,'')) returning id into lid;
 insert into public.trade_listing_items(listing_id,gift_item_id) select lid,unnest(items);
 return lid;
end $;
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
 if exists(select 1 from public.trade_listing_items li join public.trade_listings tl on tl.id=li.listing_id where li.gift_item_id=any(items) and tl.status='open') then raise exception 'Offered gift already listed'; end if;
 if exists(select 1 from public.trade_offer_items oi join public.trade_offers existing_o on existing_o.id=oi.offer_id join public.trade_listings existing_l on existing_l.id=existing_o.listing_id where oi.gift_item_id=any(items) and existing_o.status='pending' and existing_l.status='open') then raise exception 'Offered gift already committed to another pending offer'; end if;
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
 if exists(select 1 from public.trade_offer_items oi join public.trade_listing_items li on li.gift_item_id=oi.gift_item_id join public.trade_listings other_l on other_l.id=li.listing_id where oi.offer_id=offer and other_l.status='open') then raise exception 'Offered gift is listed elsewhere'; end if;
 if exists(select 1 from public.trade_listing_items li join public.trade_offer_items oi on oi.gift_item_id=li.gift_item_id join public.trade_offers other_o on other_o.id=oi.offer_id where li.listing_id=l.id and other_o.status='pending' and other_o.id<>offer) then raise exception 'Listed gift is pledged to another offer'; end if;
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

revoke all on function public.trade_create(uuid[],text),public.trade_offer(uuid,uuid[]),public.trade_decide(uuid,boolean) from public,anon,authenticated;
grant execute on function public.trade_create(uuid[],text),public.trade_offer(uuid,uuid[]),public.trade_decide(uuid,boolean) to authenticated;
