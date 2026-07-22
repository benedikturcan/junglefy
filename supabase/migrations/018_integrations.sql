-- ============================================
-- JUNGLEFY: Addons / Third-party Integrations
-- ============================================

CREATE TABLE integration_providers (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'webhook_only')),
  capabilities JSONB DEFAULT '[]' NOT NULL,
  config_schema JSONB DEFAULT '{}' NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_code VARCHAR(50) NOT NULL REFERENCES integration_providers(code),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  config JSONB DEFAULT '{}' NOT NULL,
  encrypted_credentials TEXT,
  scopes_granted JSONB DEFAULT '[]' NOT NULL,
  last_used_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider_code)
);

CREATE INDEX idx_integrations_organization ON integrations(organization_id);
CREATE INDEX idx_integrations_provider ON integrations(provider_code);
CREATE INDEX idx_integrations_status ON integrations(organization_id, status);

CREATE TABLE integration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_jobs_pending ON integration_jobs(status, next_run_at) WHERE status IN ('pending', 'running', 'failed');
CREATE INDEX idx_integration_jobs_integration ON integration_jobs(integration_id);
CREATE INDEX idx_integration_jobs_organization ON integration_jobs(organization_id);

CREATE TABLE integration_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  provider_code VARCHAR(50) NOT NULL,
  signature_valid BOOLEAN,
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integration_webhook_logs_org ON integration_webhook_logs(organization_id, created_at DESC);
CREATE INDEX idx_integration_webhook_logs_provider ON integration_webhook_logs(provider_code, created_at DESC);

-- Seed example providers
INSERT INTO integration_providers (code, name, description, auth_type, capabilities, config_schema)
VALUES (
  'outgoing_webhook',
  'Outgoing Webhook',
  'Sends a JSON payload to a configurable HTTPS URL with an optional HMAC signature.',
  'webhook_only',
  '["outgoing_webhook"]',
  '{
    "type": "object",
    "required": ["url"],
    "properties": {
      "url": { "type": "string", "format": "uri" },
      "secret": { "type": "string" },
      "headers": { "type": "object" }
    }
  }'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- Row Level Security
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select" ON integrations
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "integrations_insert" ON integrations
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "integrations_update" ON integrations
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "integrations_delete" ON integrations
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

CREATE POLICY "integration_jobs_select" ON integration_jobs
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "integration_jobs_write" ON integration_jobs
  FOR ALL USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "integration_webhook_logs_select" ON integration_webhook_logs
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "integration_webhook_logs_insert" ON integration_webhook_logs
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Triggers
CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER integration_jobs_updated_at
  BEFORE UPDATE ON integration_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
