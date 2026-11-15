-- Apply only after review. Adds admin-only gift catalogue creation; no seed gifts.
CREATE OR REPLACE FUNCTION public.bst_admin_create_gift_type(
 p_name text, p_rarity text, p_stock_total integer,
 p_normal_weight integer, p_gold_weight integer, p_active boolean DEFAULT true
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
