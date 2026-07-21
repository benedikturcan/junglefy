-- ============================================
-- JUNGLEFY: Organizations Schema
-- ============================================

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- ============================================
-- LOCATIONS TABLE
-- ============================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  address JSONB,
  contact JSONB,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_locations_organization ON locations(organization_id);
CREATE INDEX idx_locations_slug ON locations(organization_id, slug);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see orgs they belong to
CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Locations: Users can only see locations in their orgs
CREATE POLICY "locations_select" ON locations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
