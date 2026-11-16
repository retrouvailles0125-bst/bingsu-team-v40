-- V40: Multiple donation payment methods.
-- Preserve the legacy bst_donation_bank_settings table.

CREATE TABLE IF NOT EXISTS public.bst_donation_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('qr_image', 'bank_account')),
  label text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  qr_image_url text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  CONSTRAINT bst_payment_label_length CHECK (length(label) <= 120),
  CONSTRAINT bst_payment_bank_length CHECK (length(bank_name) <= 120),
  CONSTRAINT bst_payment_holder_length CHECK (length(account_name) <= 120),
  CONSTRAINT bst_payment_number_length CHECK (length(account_number) <= 60),
  CONSTRAINT bst_payment_qr_length CHECK (length(qr_image_url) <= 1000),
  CONSTRAINT bst_payment_kind_data CHECK (
    (
      kind = 'qr_image'
      AND length(btrim(label)) > 0
      AND qr_image_url ~ '^https://[^[:space:]]+$'
      AND bank_name = ''
      AND account_name = ''
      AND account_number = ''
    )
    OR
    (
      kind = 'bank_account'
      AND length(btrim(bank_name)) > 0
      AND account_number ~ '^[0-9]{5,25}$'
      AND length(btrim(account_name)) > 0
      AND qr_image_url = ''
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS bst_payment_one_default
ON public.bst_donation_payment_methods (is_active)
WHERE is_active = true;

ALTER TABLE public.bst_donation_payment_methods
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bst_payment_public_read
ON public.bst_donation_payment_methods;

CREATE POLICY bst_payment_public_read
ON public.bst_donation_payment_methods
FOR SELECT TO anon, authenticated
USING (true);

-- No direct client INSERT, UPDATE or DELETE.
REVOKE ALL ON public.bst_donation_payment_methods
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.bst_donation_payment_methods
TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bst_admin_add_payment_method(
  p_kind text,
  p_label text DEFAULT '',
  p_bank_name text DEFAULT '',
  p_account_name text DEFAULT '',
  p_account_number text DEFAULT '',
  p_qr_image_url text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_kind text := coalesce(p_kind, '');
  v_label text := btrim(coalesce(p_label, ''));
  v_bank text := btrim(coalesce(p_bank_name, ''));
  v_holder text := btrim(coalesce(p_account_name, ''));
  v_number text := btrim(coalesce(p_account_number, ''));
  v_qr text := btrim(coalesce(p_qr_image_url, ''));
  v_first boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Serialize all payment-method mutations.
  PERFORM pg_catalog.pg_advisory_xact_lock(40261116, 1);

  IF v_kind NOT IN ('qr_image', 'bank_account') THEN
    RAISE EXCEPTION 'Invalid payment method kind';
  END IF;

  IF v_kind = 'qr_image' THEN
    IF v_label = '' OR length(v_label) > 120
       OR length(v_qr) > 1000
       OR v_qr !~ '^https://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Invalid QR information';
    END IF;
    v_bank := '';
    v_holder := '';
    v_number := '';
  ELSE
    IF v_bank = '' OR length(v_bank) > 120
       OR v_holder = '' OR length(v_holder) > 120
       OR v_number !~ '^[0-9]{5,25}$' THEN
      RAISE EXCEPTION 'Invalid bank account';
    END IF;
    v_label := '';
    v_qr := '';
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.bst_donation_payment_methods
  ) INTO v_first;

  INSERT INTO public.bst_donation_payment_methods (
    kind, label, bank_name, account_name,
    account_number, qr_image_url, is_active, created_by
  )
  VALUES (
    v_kind, v_label, v_bank, v_holder,
    v_number, v_qr, v_first, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.bst_admin_activate_payment_method(
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(40261116, 1);

  IF NOT EXISTS (
    SELECT 1 FROM public.bst_donation_payment_methods WHERE id = p_id
  ) THEN
    RAISE EXCEPTION 'Payment method not found';
  END IF;

  UPDATE public.bst_donation_payment_methods
  SET is_active = false, updated_at = now()
  WHERE is_active = true;

  UPDATE public.bst_donation_payment_methods
  SET is_active = true, updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.bst_admin_delete_payment_method(
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_was_active boolean;
  v_next uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(40261116, 1);

  DELETE FROM public.bst_donation_payment_methods
  WHERE id = p_id
  RETURNING is_active INTO v_was_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment method not found';
  END IF;

  IF v_was_active THEN
    SELECT id INTO v_next
    FROM public.bst_donation_payment_methods
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_next IS NOT NULL THEN
      UPDATE public.bst_donation_payment_methods
      SET is_active = true, updated_at = now()
      WHERE id = v_next;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.bst_admin_add_payment_method(
  text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.bst_admin_activate_payment_method(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.bst_admin_delete_payment_method(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bst_admin_add_payment_method(
  text,text,text,text,text,text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bst_admin_activate_payment_method(uuid)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.bst_admin_delete_payment_method(uuid)
TO authenticated;
