-- ============================================
-- JUNGLEFY: Products Schema
-- ============================================

-- ============================================
-- CATEGORIES TABLE
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_categories_organization ON categories(organization_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(organization_id, slug);

-- ============================================
-- PRODUCTS TABLE
-- ============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  track_inventory BOOLEAN DEFAULT true,
  inventory_quantity INTEGER DEFAULT 0,
  weight DECIMAL(8,3),
  dimensions JSONB,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, sku),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_products_organization ON products(organization_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_sku ON products(sku);

-- ============================================
-- FAVORITES TABLE
-- ============================================

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_product ON favorites(product_id);
CREATE INDEX idx_favorites_organization ON favorites(organization_id);
CREATE INDEX idx_favorites_created ON favorites(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Categories: Users can see categories in their organizations
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_active = true
  );

-- Categories: Org owners and location owners can manage
CREATE POLICY "categories_insert" ON categories
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

-- Products: Users can see active products in their organizations
CREATE POLICY "products_select" ON products
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_active = true
    AND status = 'active'
  );

-- Products: Org owners and location owners can manage
CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND is_organization_owner(organization_id)
  );

-- Favorites: Users can see their own favorites, org/location owners can see all
CREATE POLICY "favorites_select" ON favorites
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      user_id = auth.uid()
      OR is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

-- Favorites: Users can manage their own favorites
CREATE POLICY "favorites_insert" ON favorites
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (SELECT get_user_organization_ids())
  );

CREATE POLICY "favorites_delete" ON favorites
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
