-- ============================================
-- JUNGLEFY: Users & Members Schema
-- ============================================

-- ============================================
-- USER ROLES ENUM
-- ============================================

CREATE TYPE user_role AS ENUM (
  'organization_owner',
  'location_owner',
  'location_member',
  'customer'
);

-- ============================================
-- USER PROFILES TABLE
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  phone VARCHAR(50),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_organization ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_location ON organization_members(location_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all organization IDs for current user
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get user role in organization
CREATE OR REPLACE FUNCTION get_user_role(org_id UUID)
RETURNS user_role AS $$
  SELECT role FROM organization_members 
  WHERE user_id = auth.uid() AND organization_id = org_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user is organization owner
CREATE OR REPLACE FUNCTION is_organization_owner(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
      AND organization_id = org_id 
      AND role = 'organization_owner'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if user has access to location
CREATE OR REPLACE FUNCTION has_location_access(loc_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    JOIN locations l ON l.organization_id = om.organization_id
    WHERE om.user_id = auth.uid() 
      AND l.id = loc_id
      AND (
        om.role IN ('organization_owner', 'location_owner')
        OR om.location_id = loc_id
        OR om.location_id IS NULL
      )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- User profiles: Users can see profiles in their organizations
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (
    id = auth.uid() OR
    id IN (
      SELECT user_id FROM organization_members 
      WHERE organization_id IN (SELECT get_user_organization_ids())
    )
  );

-- User profiles: Users can update their own profile
CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Organization members: Users can see members in their organizations
CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Organization members: Only org owners can insert
CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    is_organization_owner(organization_id)
  );

-- Organization members: Only org owners can update
CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE USING (
    is_organization_owner(organization_id)
  );

-- Organization members: Only org owners can delete
CREATE POLICY "org_members_delete" ON organization_members
  FOR DELETE USING (
    is_organization_owner(organization_id)
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
