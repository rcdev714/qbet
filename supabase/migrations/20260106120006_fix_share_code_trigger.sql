-- Fix missing share_code trigger and update to 6-digit hex format

-- Update function to generate 6-digit hex code (0-9, A-F)
CREATE OR REPLACE FUNCTION public.generate_group_code()
RETURNS text
LANGUAGE SQL
AS $$
  SELECT UPPER(LPAD(TO_HEX(FLOOR(RANDOM() * 16777215)::INT), 6, '0'));
$$;

-- Create trigger on groups table (was missing!)
DROP TRIGGER IF EXISTS trg_generate_group_code ON public.groups;
CREATE TRIGGER trg_generate_group_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_generate_group_code_fn();

-- Backfill existing groups with missing share_code
UPDATE public.groups 
SET share_code = UPPER(LPAD(TO_HEX(FLOOR(RANDOM() * 16777215)::INT), 6, '0'))
WHERE share_code IS NULL;
