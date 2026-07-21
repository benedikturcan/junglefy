-- ============================================
-- JUNGLEFY: Product Images (Multi-tenant)
-- ============================================

-- ============================================
-- PRODUCT IMAGES TABLE
-- ============================================

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, position)
);

CREATE UNIQUE INDEX idx_product_images_one_primary ON product_images(product_id) WHERE is_primary = true;
CREATE INDEX idx_product_images_organization ON product_images(organization_id);
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Users can only see images within their organizations
CREATE POLICY "product_images_select" ON product_images
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Only org owners and location owners can manage images
CREATE POLICY "product_images_insert" ON product_images
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "product_images_update" ON product_images
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "product_images_delete" ON product_images
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- Object path convention: <organization_id>/<product_id>/<filename>
-- ============================================

CREATE POLICY "product_images_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (SELECT get_user_organization_ids()::text)
  );

CREATE POLICY "product_images_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (SELECT get_user_organization_ids()::text)
    AND (
      is_organization_owner((storage.foldername(name))[1]::uuid)
      OR get_user_role((storage.foldername(name))[1]::uuid) = 'location_owner'
    )
  );

CREATE POLICY "product_images_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (SELECT get_user_organization_ids()::text)
    AND (
      is_organization_owner((storage.foldername(name))[1]::uuid)
      OR get_user_role((storage.foldername(name))[1]::uuid) = 'location_owner'
    )
  );

CREATE POLICY "product_images_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] IN (SELECT get_user_organization_ids()::text)
    AND (
      is_organization_owner((storage.foldername(name))[1]::uuid)
      OR get_user_role((storage.foldername(name))[1]::uuid) = 'location_owner'
    )
  );
