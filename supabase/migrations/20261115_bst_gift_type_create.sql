-- Apply only after review. Adds admin-only gift catalogue creation; no seed gifts.
CREATE OR REPLACE FUNCTION public.bst_admin_create_gift_type(
 p_name text, p_rarity text, p_stock_total integer,
 p_normal_weight integer, p_gold_weight integer, p_active boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 120
    OR p_rarity NOT IN ('normal','rare','ssr','secret')
    OR p_stock_total IS NULL OR p_stock_total NOT BETWEEN 0 AND 1000000
    OR p_normal_weight IS NULL OR p_normal_weight NOT BETWEEN 0 AND 1000000
    OR p_gold_weight IS NULL OR p_gold_weight NOT BETWEEN 0 AND 1000000
    OR p_active IS NULL THEN RAISE EXCEPTION 'Invalid gift configuration'; END IF;
 INSERT INTO public.gift_types(name,rarity,stock_total,normal_weight,gold_weight,active)
 VALUES(btrim(p_name),p_rarity,p_stock_total,p_normal_weight,p_gold_weight,p_active)
 RETURNING id INTO v_id;
 INSERT INTO public.audit_events(actor_id,action,target_id,details)
 VALUES(auth.uid(),'gift_type.create',v_id,jsonb_build_object('name',p_name,'rarity',p_rarity,'stock_total',p_stock_total,'normal_weight',p_normal_weight,'gold_weight',p_gold_weight,'active',p_active));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.bst_admin_create_gift_type(text,text,integer,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bst_admin_create_gift_type(text,text,integer,integer,integer,boolean) TO authenticated;

-- V40 original homepage catalog. Import only if the catalog is empty;
-- leave all gifts INACTIVE until admin validates real stock and probabilities.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.gift_types) THEN
  INSERT INTO public.gift_types(name,rarity,stock_total,normal_weight,gold_weight,active)
  VALUES
  ('Chibi 01','rare',5,1,12,false),
  ('Chibi 02','rare',5,1,12,false),
  ('Sticker Set','normal',10,10,5,false),
  ('Photocard','normal',10,10,5,false),
  ('Móc khóa','normal',5,10,5,false),
  ('Postcard','normal',10,10,5,false),
  ('Huy hiệu','normal',10,10,5,false),
  ('Bookmark','normal',10,10,5,false),
  ('Mini Poster','normal',5,10,5,false),
  ('Chúc may mắn lần sau','normal',9999,10,5,false);
 END IF;
END $$;

-- Safe public catalog projection: never expose gift codes or user inventory.
CREATE OR REPLACE FUNCTION public.bst_public_gift_catalog()
RETURNS TABLE(name text, rarity text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT g.name,g.rarity FROM public.gift_types g ORDER BY g.name
$$;
REVOKE ALL ON FUNCTION public.bst_public_gift_catalog() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bst_public_gift_catalog() TO anon,authenticated;
