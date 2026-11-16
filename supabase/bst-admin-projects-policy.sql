-- Run in Supabase SQL Editor after reviewing existing policies.
-- The API additionally requires an authenticated admin with verified OTP.
-- Database policies are the independent authorization boundary.
BEGIN;
DROP POLICY IF EXISTS bst_admin_update_projects ON public.projects;
CREATE POLICY bst_admin_update_projects
ON public.projects FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin' AND p.blocked = false)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin' AND p.blocked = false)
);
DROP POLICY IF EXISTS bst_admin_select_projects ON public.projects;
CREATE POLICY bst_admin_select_projects
ON public.projects FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin' AND p.blocked = false)
);
COMMIT;
