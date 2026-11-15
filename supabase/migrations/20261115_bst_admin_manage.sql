-- Apply in Supabase SQL Editor after reviewing on a staging database.
-- Admin-only mutation RPC. Admin OTP is enforced by the Next.js API, while DB checks is_admin().
CREATE OR REPLACE FUNCTION public.bst_admin_manage(
  p_action text, p_target uuid, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_user uuid := auth.uid(); v_row jsonb;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_target IS NULL THEN RAISE EXCEPTION 'Missing target'; END IF;
  IF p_action = 'profile.block' THEN
    IF p_target = v_user THEN RAISE EXCEPTION 'Cannot block own admin account'; END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id=p_target AND role='admin') THEN
      RAISE EXCEPTION 'Cannot block admin account through this action';
    END IF;
    UPDATE public.profiles SET blocked = (p_payload->>'blocked')::boolean,
      block_message = CASE WHEN (p_payload->>'blocked')::boolean THEN left(coalesce(p_payload->>'message',''),500) ELSE '' END
    WHERE id=p_target RETURNING jsonb_build_object('id',id,'blocked',blocked) INTO v_row;
  ELSIF p_action = 'gift_type.update' THEN
    UPDATE public.gift_types SET
      normal_weight=(p_payload->>'normal_weight')::integer,
      gold_weight=(p_payload->>'gold_weight')::integer,
      stock_total=(p_payload->>'stock_total')::integer,
      active=(p_payload->>'active')::boolean
    WHERE id=p_target AND (p_payload->>'normal_weight')::integer >= 0
      AND (p_payload->>'gold_weight')::integer >= 0
      AND (p_payload->>'stock_total')::integer >= stock_issued
      AND (p_payload->>'stock_total')::integer <= 1000000
    RETURNING jsonb_build_object('id',id,'stock_total',stock_total,'active',active) INTO v_row;
  ELSIF p_action = 'community_post.hide' THEN
    UPDATE public.community_posts SET hidden=(p_payload->>'hidden')::boolean
    WHERE id=p_target RETURNING jsonb_build_object('id',id,'hidden',hidden) INTO v_row;
  ELSIF p_action = 'love_message.hide' THEN
    UPDATE public.love_messages SET hidden=(p_payload->>'hidden')::boolean
    WHERE id=p_target RETURNING jsonb_build_object('id',id,'hidden',hidden) INTO v_row;
  ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Target not found or invalid values'; END IF;
  INSERT INTO public.audit_events(actor_id,action,target_id,details)
  VALUES(v_user,p_action,p_target,p_payload);
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.bst_admin_manage(text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bst_admin_manage(text,uuid,jsonb) TO authenticated;
