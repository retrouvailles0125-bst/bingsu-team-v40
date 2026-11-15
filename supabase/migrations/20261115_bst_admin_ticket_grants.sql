-- BINGSU TEAM V40: admin manual ticket grants, atomic and idempotent.
CREATE TABLE IF NOT EXISTS public.admin_ticket_grants (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  normal_count integer NOT NULL CHECK (normal_count BETWEEN 0 AND 10000),
  gold_count integer NOT NULL CHECK (gold_count BETWEEN 0 AND 10000),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bst_grant_nonzero CHECK (normal_count + gold_count > 0)
);
ALTER TABLE public.admin_ticket_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bst_admin_ticket_grants_read ON public.admin_ticket_grants;
CREATE POLICY bst_admin_ticket_grants_read ON public.admin_ticket_grants FOR SELECT TO authenticated USING (public.is_admin());
CREATE OR REPLACE FUNCTION public.bst_admin_grant_tickets(
  p_request_id uuid, p_recipient_id uuid, p_normal integer, p_gold integer, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_actor uuid := auth.uid(); v_old public.admin_ticket_grants%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_request_id IS NULL OR p_recipient_id IS NULL
    OR p_normal IS NULL OR p_gold IS NULL
    OR p_normal < 0 OR p_gold < 0 OR p_normal > 10000 OR p_gold > 10000
    OR p_normal + p_gold = 0
    OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500
 THEN RAISE EXCEPTION 'Invalid ticket grant'; END IF;
 -- Serialize concurrent requests using the same idempotency key.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
 SELECT * INTO v_old FROM public.admin_ticket_grants WHERE id=p_request_id;
 IF FOUND THEN
   IF v_old.recipient_id <> p_recipient_id OR v_old.normal_count <> p_normal
      OR v_old.gold_count <> p_gold OR v_old.reason <> trim(p_reason) OR v_old.actor_id <> v_actor
   THEN RAISE EXCEPTION 'Request ID already used for different grant'; END IF;
   RETURN pg_catalog.jsonb_build_object('id',p_request_id,'already_processed',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_recipient_id AND NOT blocked AND role <> 'admin') THEN
   RAISE EXCEPTION 'Recipient not eligible';
 END IF;
 INSERT INTO public.admin_ticket_grants(id,recipient_id,actor_id,normal_count,gold_count,reason)
 VALUES(p_request_id,p_recipient_id,v_actor,p_normal,p_gold,trim(p_reason));
 INSERT INTO public.spin_balances(user_id,normal_available,gold_available)
 VALUES(p_recipient_id,p_normal,p_gold)
 ON CONFLICT(user_id) DO UPDATE SET
 normal_available=public.spin_balances.normal_available+EXCLUDED.normal_available,
 gold_available=public.spin_balances.gold_available+EXCLUDED.gold_available;
 INSERT INTO public.audit_events(actor_id,action,target_id,details)
 VALUES(v_actor,'admin.ticket_grant',p_recipient_id,
 pg_catalog.jsonb_build_object('request_id',p_request_id,'normal',p_normal,'gold',p_gold,'reason',trim(p_reason)));
 RETURN pg_catalog.jsonb_build_object('id',p_request_id,'already_processed',false);
END $$;
REVOKE ALL ON FUNCTION public.bst_admin_grant_tickets(uuid,uuid,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bst_admin_grant_tickets(uuid,uuid,integer,integer,text) TO authenticated;
