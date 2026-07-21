-- ============================================
-- JUNGLEFY: Invitations Schema
-- ============================================

-- ============================================
-- INVITATION STATUS ENUM
-- ============================================

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired',
  'revoked'
);

-- ============================================
-- INVITATIONS TABLE
-- ============================================

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  token VARCHAR(255) UNIQUE NOT NULL,
  status invitation_status DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_organization ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status) WHERE status = 'pending';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Invitations: Org owners and location owners can see invitations
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

-- Invitations: Org owners and location owners can create
CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (
    is_organization_owner(organization_id)
    OR get_user_role(organization_id) = 'location_owner'
  );

-- Invitations: Org owners can update
CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE USING (
    is_organization_owner(organization_id)
  );

-- Invitations: Org owners can delete
CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (
    is_organization_owner(organization_id)
  );
