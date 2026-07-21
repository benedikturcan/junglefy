-- ============================================
-- JUNGLEFY: Payment Providers (Multi-tenant module)
-- ============================================

CREATE TYPE payment_provider_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled');

CREATE TABLE payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL, -- e.g. stripe, mollie, paypal
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- provider-specific settings (store secrets encrypted in real apps)
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_providers_select" ON payment_providers
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "payment_providers_insert" ON payment_providers
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

CREATE POLICY "payment_providers_update" ON payment_providers
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

CREATE POLICY "payment_providers_delete" ON payment_providers
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

CREATE TRIGGER payment_providers_updated_at
  BEFORE UPDATE ON payment_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
