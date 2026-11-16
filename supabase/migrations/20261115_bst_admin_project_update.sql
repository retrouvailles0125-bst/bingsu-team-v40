-- Admin-only project updates. No broad UPDATE policy is needed.
CREATE OR REPLACE FUNCTION public.bst_admin_update_project(
 p_id uuid,p_name text,p_description text,p_is_open boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_actor uuid:=auth.uid(); v_result jsonb;
BEGIN
 IF v_actor IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_id IS NULL OR p_is_open IS NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150
 OR length(coalesce(p_description,''))>3000 THEN RAISE EXCEPTION 'Invalid project'; END IF;
 UPDATE public.projects SET name=trim(p_name),description=coalesce(p_description,''),is_open=p_is_open
 WHERE id=p_id RETURNING pg_catalog.jsonb_build_object('id',id,'name',name,'description',description,'is_open',is_open) INTO v_result;
 IF v_result IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
 INSERT INTO public.audit_events(actor_id,action,target_id,details)
 VALUES(v_actor,'admin.project.update',p_id,v_result);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.bst_admin_update_project(uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bst_admin_update_project(uuid,text,text,boolean) TO authenticated;
