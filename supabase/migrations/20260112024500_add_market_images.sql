-- Add image_url to markets table
ALTER TABLE markets ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for market images
INSERT INTO storage.buckets (id, name, public)
VALUES ('market-images', 'market-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public view
DROP POLICY IF EXISTS "Market images are publicly accessible" ON storage.objects;
CREATE POLICY "Market images are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'market-images' );

-- Policy: Authenticated upload
DROP POLICY IF EXISTS "Authenticated users can upload market images" ON storage.objects;
CREATE POLICY "Authenticated users can upload market images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'market-images'
    AND auth.role() = 'authenticated'
  );
