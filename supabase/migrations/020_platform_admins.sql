-- ============================================
-- JUNGLEFY: Platform / Developer Admins
-- ============================================

CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_admins_user ON platform_admins(user_id);

-- Helper to check if the current authenticated user is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper overload for explicit user_id checks (e.g. from service role context)
CREATE OR REPLACE FUNCTION is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = check_user_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage the table; self-read for own row
CREATE POLICY "platform_admins_select" ON platform_admins
  FOR SELECT USING (
    is_platform_admin() OR user_id = auth.uid()
  );

CREATE POLICY "platform_admins_insert" ON platform_admins
  FOR INSERT WITH CHECK (is_platform_admin());

CREATE POLICY "platform_admins_update" ON platform_admins
  FOR UPDATE USING (is_platform_admin());

CREATE POLICY "platform_admins_delete" ON platform_admins
  FOR DELETE USING (is_platform_admin());
