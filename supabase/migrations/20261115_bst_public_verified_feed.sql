-- Public verified donation feed: return only aggregate-safe, non-identifying fields.
-- Direct donations SELECT remains restricted to owner/admin by RLS.
CREATE OR REPLACE FUNCTION public.bst_public_verified_donations()
RETURNS TABLE(donation_id uuid,project_name text,received_amount bigint,verified_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT d.id,p.name,d.received_amount,d.verified_at
 FROM public.donations d JOIN public.projects p ON p.id=d.project_id
 WHERE d.status='verified' AND d.verified_at IS NOT NULL AND d.received_amount IS NOT NULL
 ORDER BY d.verified_at DESC,d.id DESC LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.bst_public_verified_donations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bst_public_verified_donations() TO anon,authenticated;
