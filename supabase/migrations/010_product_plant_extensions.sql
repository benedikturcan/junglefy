-- ============================================
-- JUNGLEFY: Product Plant Catalog Link & Plant-specific Product Fields
-- ============================================

ALTER TABLE products
  ADD COLUMN plant_catalog_id UUID REFERENCES plant_catalog(id) ON DELETE SET NULL,
  ADD COLUMN size_category VARCHAR(20) CHECK (size_category IN ('small', 'medium', 'large', 'extra_large')),
  ADD COLUMN height_cm INTEGER,
  ADD COLUMN pot_diameter_cm INTEGER,
  ADD COLUMN requires_climate_packaging BOOLEAN DEFAULT false,
  ADD COLUMN fragile BOOLEAN DEFAULT false,
  ADD COLUMN shipping_restrictions JSONB DEFAULT '{}';

CREATE INDEX idx_products_plant_catalog ON products(plant_catalog_id);
CREATE INDEX idx_products_size_category ON products(size_category);
