-- Bank details are public donation instructions, not private bank credentials.
CREATE TABLE IF NOT EXISTS public.bst_donation_bank_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 bank_name text NOT NULL DEFAULT '',
 account_name text NOT NULL DEFAULT '',
 account_number text NOT NULL DEFAULT '',
 qr_image_url text NOT NULL DEFAULT '',
 instructions text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.bst_donation_bank_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bst_bank_settings_read ON public.bst_donation_bank_settings;
CREATE POLICY bst_bank_settings_read ON public.bst_donation_bank_settings
 FOR SELECT TO anon,authenticated USING (true);
INSERT INTO public.bst_donation_bank_settings(id) VALUES(true) ON CONFLICT(id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.bst_admin_update_bank(
 p_bank_name text,p_account_name text,p_account_number text,p_qr_image_url text,p_instructions text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_result jsonb;
BEGIN
 IF v_actor IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF length(coalesce(p_bank_name,''))>120 OR length(coalesce(p_account_name,''))>120
 OR length(coalesce(p_account_number,''))>60 OR length(coalesce(p_qr_image_url,''))>1000
 OR length(coalesce(p_instructions,''))>2000 THEN RAISE EXCEPTION 'Input too long'; END IF;
 IF coalesce(p_qr_image_url,'')<>'' AND p_qr_image_url !~ '^https://[^[:space:]]+$'
 THEN RAISE EXCEPTION 'QR must be HTTPS URL'; END IF;
 UPDATE public.bst_donation_bank_settings SET bank_name=coalesce(p_bank_name,''),
 account_name=coalesce(p_account_name,''),account_number=coalesce(p_account_number,''),
 qr_image_url=coalesce(p_qr_image_url,''),instructions=coalesce(p_instructions,''),
 updated_at=now(),updated_by=v_actor WHERE id=true
 RETURNING pg_catalog.jsonb_build_object('bank_name',bank_name,'account_name',account_name,'account_number',account_number,'qr_image_url',qr_image_url,'instructions',instructions) INTO v_result;
 IF v_result IS NULL THEN RAISE EXCEPTION 'Settings missing'; END IF;
 INSERT INTO public.audit_events(actor_id,action,details)
 VALUES(v_actor,'admin.bank_settings.update',pg_catalog.jsonb_build_object('bank_name',p_bank_name,'account_name',p_account_name,'account_number',p_account_number,'qr_image_url',p_qr_image_url));
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.bst_admin_update_bank(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bst_admin_update_bank(text,text,text,text,text) TO authenticated;
