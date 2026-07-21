-- ============================================
-- JUNGLEFY: Product Inventory & Availability
-- ============================================

-- ============================================
-- PRODUCT INVENTORY TABLE
-- ============================================

CREATE TABLE product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  allow_backorder BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, location_id, product_id)
);

CREATE INDEX idx_product_inventory_organization ON product_inventory(organization_id);
CREATE INDEX idx_product_inventory_product ON product_inventory(product_id);
CREATE INDEX idx_product_inventory_location ON product_inventory(location_id);
CREATE INDEX idx_product_inventory_available ON product_inventory(available_quantity) WHERE available_quantity > 0;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER product_inventory_updated_at
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Users can only see inventory within their organizations
CREATE POLICY "product_inventory_select" ON product_inventory
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Only org owners and location owners can manage inventory
CREATE POLICY "product_inventory_insert" ON product_inventory
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "product_inventory_update" ON product_inventory
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "product_inventory_delete" ON product_inventory
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

-- ============================================
-- HELPER FUNCTION: Check product availability
-- ============================================

CREATE OR REPLACE FUNCTION is_product_available(
  p_product_id UUID,
  p_organization_id UUID,
  p_location_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  total_available INTEGER;
  allow_backorder BOOLEAN;
BEGIN
  SELECT
    COALESCE(SUM(available_quantity), 0),
    COALESCE(BOOL_OR(allow_backorder), false)
  INTO total_available, allow_backorder
  FROM product_inventory
  WHERE product_id = p_product_id
    AND organization_id = p_organization_id
    AND (p_location_id IS NULL OR location_id = p_location_id);

  RETURN total_available > 0 OR allow_backorder;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
