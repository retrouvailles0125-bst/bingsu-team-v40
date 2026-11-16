-- Admin can review donations submitted by any account.
-- Only signed-in, unblocked profiles with role=admin receive this SELECT access.
-- Existing donor policies remain unchanged.
BEGIN;
DROP POLICY IF EXISTS bst_admin_read_all_donations ON public.donations;
CREATE POLICY bst_admin_read_all_donations
ON public.donations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
      AND p.blocked IS NOT TRUE
  )
);
COMMIT;
