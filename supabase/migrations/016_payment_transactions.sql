-- ============================================
-- JUNGLEFY: Payment Transactions (Multi-tenant module)
-- ============================================

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_code VARCHAR(50) NOT NULL,
  provider_transaction_id VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status payment_provider_status NOT NULL DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_organization ON payment_transactions(organization_id);
CREATE INDEX idx_payment_transactions_provider ON payment_transactions(provider_code, provider_transaction_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_select" ON payment_transactions
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "payment_transactions_insert" ON payment_transactions
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "payment_transactions_update" ON payment_transactions
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "payment_transactions_delete" ON payment_transactions
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

CREATE TRIGGER payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
