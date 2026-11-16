
-- BST V40 - Donate field configuration
-- Review and test on staging before applying to production.

CREATE TABLE IF NOT EXISTS public.bst_donate_field_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  max_bills integer NOT NULL DEFAULT 3
    CHECK (max_bills BETWEEN 1 AND 20),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(fields) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.bst_donate_field_settings
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  "bst_donate_fields_read"
  ON public.bst_donate_field_settings;

CREATE POLICY "bst_donate_fields_read"
ON public.bst_donate_field_settings
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS
  "bst_donate_fields_admin_insert"
  ON public.bst_donate_field_settings;

CREATE POLICY "bst_donate_fields_admin_insert"
ON public.bst_donate_field_settings
FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS
  "bst_donate_fields_admin_update"
  ON public.bst_donate_field_settings;

CREATE POLICY "bst_donate_fields_admin_update"
ON public.bst_donate_field_settings
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO public.bst_donate_field_settings (
  id,
  max_bills,
  fields
)
VALUES (
  true,
  3,
  '[
    {
      "key": "display_id",
      "label": "ID HIỂN THỊ",
      "type": "text",
      "visible": true,
      "public": true,
      "required": true,
      "deleted": false,
      "system": true
    },
    {
      "key": "phone",
      "label": "SỐ ĐIỆN THOẠI",
      "type": "text",
      "visible": true,
      "public": false,
      "required": false,
      "deleted": false,
      "system": true
    },
    {
      "key": "amount",
      "label": "SỐ TIỀN DONATE",
      "type": "number",
      "visible": true,
      "public": true,
      "required": true,
      "deleted": false,
      "system": true
    },
    {
      "key": "transfer_date",
      "label": "NGÀY CHUYỂN KHOẢN",
      "type": "date",
      "visible": true,
      "public": false,
      "required": false,
      "deleted": false,
      "system": true
    },
    {
      "key": "kandee_message",
      "label": "LỜI NHẮN CHO CÁC BẠN KANDEE",
      "type": "textarea",
      "visible": true,
      "public": false,
      "required": false,
      "deleted": false,
      "system": true
    },
    {
      "key": "bst_message",
      "label": "LỜI NHẮN DÀNH CHO BINGSU TEAM",
      "type": "textarea",
      "visible": true,
      "public": false,
      "required": false,
      "deleted": false,
      "system": true
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
