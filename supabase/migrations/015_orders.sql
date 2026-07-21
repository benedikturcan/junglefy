-- ============================================
-- JUNGLEFY: Orders & Order Items (Multi-tenant core)
-- ============================================

CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

CREATE TYPE fulfillment_type AS ENUM ('shipping', 'pickup');

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- null = guest order
  guest_token UUID, -- token for guest order tracking

  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  customer_name VARCHAR(255),

  shipping_address JSONB NOT NULL,
  billing_address JSONB,

  fulfillment_type fulfillment_type NOT NULL DEFAULT 'shipping',
  shipping_method_id UUID REFERENCES shipping_methods(id) ON DELETE SET NULL,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,

  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,

  status order_status NOT NULL DEFAULT 'pending',
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  plant_catalog_id UUID REFERENCES plant_catalog(id) ON DELETE SET NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  tax_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_organization ON orders(organization_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_guest_token ON orders(guest_token);
CREATE INDEX idx_orders_status ON orders(organization_id, status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Organization staff can see all orders in their org
CREATE POLICY "orders_select_org" ON orders
  FOR SELECT USING (
    organization_id IN (SELECT get_user_organization_ids())
  );

-- Authenticated customers can see their own orders
CREATE POLICY "orders_select_user" ON orders
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Staff can manage orders in their org
CREATE POLICY "orders_write_org" ON orders
  FOR ALL USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

-- Order items follow parent order visibility
CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders)
  );

CREATE POLICY "order_items_write_org" ON order_items
  FOR ALL USING (
    organization_id IN (SELECT get_user_organization_ids())
    AND (
      is_organization_owner(organization_id)
      OR get_user_role(organization_id) = 'location_owner'
    )
  );

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
