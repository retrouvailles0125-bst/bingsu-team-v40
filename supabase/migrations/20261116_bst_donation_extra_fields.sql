-- BINGSU TEAM V40
-- Dynamic donation declaration fields
-- Additive migration: preserve existing donations.

ALTER TABLE public.donations
ADD COLUMN IF NOT EXISTS declaration_fields jsonb
NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.donations
DROP CONSTRAINT IF EXISTS donations_declaration_fields_object;

ALTER TABLE public.donations
ADD CONSTRAINT donations_declaration_fields_object
CHECK (jsonb_typeof(declaration_fields) = 'object');

COMMENT ON COLUMN public.donations.declaration_fields IS
'Additional donation declaration values. Private donor data; do not expose through public tracking APIs.';
declaration_fields jsonb NOT NULL DEFAULT '{}'::jsonb