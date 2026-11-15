-- Run only after reviewing existing policies. No configuration values are changed.
BEGIN;
DROP POLICY IF EXISTS bst_admin_read_gacha_settings ON public.gacha_exchange_settings;
CREATE POLICY bst_admin_read_gacha_settings ON public.gacha_exchange_settings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin' AND p.blocked=false));
DROP POLICY IF EXISTS bst_admin_update_gacha_settings ON public.gacha_exchange_settings;
CREATE POLICY bst_admin_update_gacha_settings ON public.gacha_exchange_settings
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin' AND p.blocked=false))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin' AND p.blocked=false));
COMMIT;
