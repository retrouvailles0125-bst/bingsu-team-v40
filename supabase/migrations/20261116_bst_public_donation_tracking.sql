-- Public tracking feed for the V40 "Theo dõi Donate" page.
-- Verified donations of open projects only. Never returns email, phone, bill or user id.
CREATE OR REPLACE FUNCTION public.bst_public_donation_tracking()
RETURNS TABLE(
  project_name text,
  display_name text,
  reference text,
  declared_at timestamptz,
  declared_amount bigint,
  received_amount bigint,
  status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT p.name,
        COALESCE(NULLIF(pr.username,''),'—'),
        'BST-'||upper(substr(replace(d.id::text,'-',''),1,8)),
        d.created_at,
        d.declared_amount,
        d.received_amount,
        'Verified'::text
 FROM public.donations d
 JOIN public.projects p ON p.id=d.project_id
 LEFT JOIN public.profiles pr ON pr.id=d.user_id
 WHERE d.status='verified' AND d.verified_at IS NOT NULL
   AND d.received_amount IS NOT NULL AND p.is_open
 ORDER BY d.verified_at DESC, d.id DESC LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.bst_public_donation_tracking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bst_public_donation_tracking() TO anon,authenticated;