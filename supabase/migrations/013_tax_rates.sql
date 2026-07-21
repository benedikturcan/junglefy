-- ============================================
-- JUNGLEFY: Tax Rates (Multi-tenant module)
-- ============================================

CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g. "DE MwSt. 19%"
  rate_percent DECIMAL(5,2) NOT NULL CHECK (rate_percent >= 0),
  country VARCHAR(2), -- ISO-3166 alpha-2, null = default
  region VARCHAR(100), -- optional region within country
  applies_to_all BOOLEAN DEFAULT true,
  product_ids UUID[] DEFAULT '{}', -- if empty and applies_to_all = false, applies to none
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- higher priority overrides lower for same product/country
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_rates_organization ON tax_rates(organization_id);
CREATE INDEX idx_tax_rates_country ON tax_rates(organization_id, country);
CREATE INDEX idx_tax_rates_active ON tax_rates(organization_id, is_active);

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_rates_select" ON tax_rates
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "tax_rates_insert" ON tax_rates
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "tax_rates_update" ON tax_rates
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "tax_rates_delete" ON tax_rates
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE TRIGGER tax_rates_updated_at
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
