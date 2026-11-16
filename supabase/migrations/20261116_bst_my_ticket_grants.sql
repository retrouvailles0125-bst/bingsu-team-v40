-- Lets a signed-in user read only the manual ticket grants they received.
CREATE OR REPLACE FUNCTION public.bst_my_ticket_grants()
RETURNS TABLE(id uuid, normal_count integer, gold_count integer, reason text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT g.id, g.normal_count, g.gold_count, g.reason, g.created_at
 FROM public.admin_ticket_grants g
 WHERE g.recipient_id = auth.uid()
 ORDER BY g.created_at DESC, g.id DESC
 LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.bst_my_ticket_grants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bst_my_ticket_grants() TO authenticated;
NOTIFY pgrst, 'reload schema';