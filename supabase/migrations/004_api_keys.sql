-- ============================================
-- JUNGLEFY: API Keys Schema
-- ============================================

-- ============================================
-- API KEY PERMISSIONS ENUM
-- ============================================

CREATE TYPE api_key_permission AS ENUM (
  -- Products
  'read:products',
  'write:products',
  -- Categories
  'read:categories',
  'write:categories',
  -- Orders
  'read:orders',
  'write:orders',
  -- Customers
  'read:customers',
  'write:customers',
  -- Inventory
  'read:inventory',
  'write:inventory',
  -- Users
  'read:users',
  'write:users',
  -- Full access
  'full_access'
);

-- ============================================
-- API KEYS TABLE
-- ============================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  -- Only store hash, never the actual key
  key_hash VARCHAR(255) NOT NULL,
  -- Store prefix for identification (e.g., "jfy_live_abc123")
  key_prefix VARCHAR(20) NOT NULL,
  -- Granular permissions
  permissions api_key_permission[] NOT NULL DEFAULT ARRAY['full_access']::api_key_permission[],
  -- Optional: restrict to specific locations (NULL = all locations)
  location_ids UUID[] DEFAULT NULL,
  -- Optional: IP whitelist (NULL = all IPs allowed)
  ip_whitelist INET[] DEFAULT NULL,
  -- Metadata
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================
-- API KEY USAGE LOG
-- ============================================

CREATE TABLE api_key_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_key_usage_key ON api_key_usage_log(api_key_id);
CREATE INDEX idx_api_key_usage_created ON api_key_usage_log(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if API key has a specific permission
CREATE OR REPLACE FUNCTION api_key_has_permission(
  key_id UUID,
  required_permission api_key_permission
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM api_keys
    WHERE id = key_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        'full_access' = ANY(permissions)
        OR required_permission = ANY(permissions)
      )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update last_used_at timestamp
CREATE OR REPLACE FUNCTION update_api_key_last_used(key_id UUID)
RETURNS VOID AS $$
  UPDATE api_keys SET last_used_at = NOW() WHERE id = key_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check organization API key limit (max 20)
CREATE OR REPLACE FUNCTION check_api_key_limit()
RETURNS TRIGGER AS $$
DECLARE
  key_count INTEGER;
  max_keys INTEGER := 20;
BEGIN
  SELECT COUNT(*) INTO key_count
  FROM api_keys
  WHERE organization_id = NEW.organization_id AND is_active = true;
  
  IF key_count >= max_keys THEN
    RAISE EXCEPTION 'API key limit reached. Maximum % keys per organization.', max_keys;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_api_key_limit
  BEFORE INSERT ON api_keys
  FOR EACH ROW EXECUTE FUNCTION check_api_key_limit();

-- Validate IP address against whitelist
CREATE OR REPLACE FUNCTION validate_api_key_ip(
  key_id UUID,
  client_ip INET
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM api_keys
    WHERE id = key_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (
        ip_whitelist IS NULL
        OR client_ip <<= ANY(ip_whitelist)
      )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage_log ENABLE ROW LEVEL SECURITY;

-- API Keys: Only org owners and location owners can manage
CREATE POLICY "api_keys_select" ON api_keys
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "api_keys_insert" ON api_keys
  FOR INSERT WITH CHECK (
    is_organization_owner(organization_id)
    OR get_user_role(organization_id) = 'location_owner'
  );

CREATE POLICY "api_keys_update" ON api_keys
  FOR UPDATE USING (
    is_organization_owner(organization_id)
    OR created_by = auth.uid()
  );

CREATE POLICY "api_keys_delete" ON api_keys
  FOR DELETE USING (
    is_organization_owner(organization_id)
    OR created_by = auth.uid()
  );

-- Usage log: Same as api_keys
CREATE POLICY "api_key_usage_select" ON api_key_usage_log
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys 
      WHERE organization_id IN (SELECT get_user_organization_ids())
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
