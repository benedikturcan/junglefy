-- ============================================
-- JUNGLEFY: Shipping Methods (Multi-tenant module)
-- ============================================

CREATE TABLE shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(100), -- e.g. dhl, dpd, self
  base_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  free_threshold DECIMAL(10,2), -- cart subtotal above which shipping is free
  zones JSONB DEFAULT '[]', -- array of supported country/region objects
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipping_methods_organization ON shipping_methods(organization_id);
CREATE INDEX idx_shipping_methods_active ON shipping_methods(organization_id, is_active);

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

-- Organization members can read shipping methods
CREATE POLICY "shipping_methods_select" ON shipping_methods
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Only org owners / location owners can manage shipping methods
CREATE POLICY "shipping_methods_insert" ON shipping_methods
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "shipping_methods_update" ON shipping_methods
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "shipping_methods_delete" ON shipping_methods
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE TRIGGER shipping_methods_updated_at
  BEFORE UPDATE ON shipping_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
