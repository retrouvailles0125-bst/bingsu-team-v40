-- User may update only their own public display name, never role or blocked status.
CREATE OR REPLACE FUNCTION public.bst_update_my_username(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_name text := pg_catalog.btrim(coalesce(p_username,''));
BEGIN
 IF v_uid IS NULL OR NOT public.active_user() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 IF pg_catalog.char_length(v_name) < 2 OR pg_catalog.char_length(v_name) > 40 THEN
  RAISE EXCEPTION 'ID hiển thị phải từ 2 đến 40 ký tự';
 END IF;
 IF v_name !~ '^[[:alnum:]_ .-]+$' THEN RAISE EXCEPTION 'ID hiển thị chứa ký tự không hợp lệ'; END IF;
 UPDATE public.profiles SET username=v_name WHERE id=v_uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy tài khoản'; END IF;
 RETURN v_name;
END $$;
REVOKE ALL ON FUNCTION public.bst_update_my_username(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bst_update_my_username(text) TO authenticated;
