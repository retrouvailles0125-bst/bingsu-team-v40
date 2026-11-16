-- Public homepage totals: only finalized donations, grouped by project.
-- This function intentionally exposes aggregates, never donor identities or individual payments.
CREATE OR REPLACE FUNCTION public.bst_public_project_donation_totals()
RETURNS TABLE(project_id uuid, total_received bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.id AS project_id,
         COALESCE(SUM(d.received_amount),0)::bigint AS total_received
  FROM public.projects p
  LEFT JOIN public.donations d
    ON d.project_id=p.id
   AND d.status='verified'
   AND d.verified_at IS NOT NULL
   AND d.received_amount IS NOT NULL
  GROUP BY p.id
$$;
REVOKE ALL ON FUNCTION public.bst_public_project_donation_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bst_public_project_donation_totals() TO anon,authenticated;
